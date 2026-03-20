/**
 * Winston agent runtime tests.
 *
 * We mock @anthropic-ai/sdk to avoid real API calls. The tests validate:
 *   - Tool-use loop executes and feeds results back
 *   - Final answer is returned in AgentResponse
 *   - Source attribution is populated from called tools
 *   - Session memory persists across calls with the same sessionId
 *   - Tool errors are handled gracefully (not thrown)
 */

import { WinstonAgent } from '../../src/agent/runtime';
import { sessionMemory } from '../../src/agent/memory';
import type { AgentContext } from '../../src/agent/types';

// ---- Mock @anthropic-ai/sdk ------------------------------------------------
// Use a module-level mock object so jest.mock hoisting doesn't cause
// "cannot access before initialization" errors.

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  // Intercepted at construction time via mockCreate reference through closure
  // won't work with hoisting — use a getter approach instead.
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

// ---- Mock data repositories ------------------------------------------------

jest.mock('../../src/data/repositories/sales', () => ({
  getSalesSummary: jest.fn().mockResolvedValue({
    totalTransactions: 142,
    totalRevenue: 18340.5,
    totalTax: 2200.86,
    totalDiscount: 450.0,
    averageBasket: 129.16,
    byPaymentMethod: { cash: { count: 80, revenue: 9800 }, debit: { count: 62, revenue: 8540.5 } },
  }),
  getTopSellingProducts: jest.fn().mockResolvedValue([
    { productId: 'p1', productName: 'Blue Dream 1g', totalQty: 88, totalRevenue: 3520 },
    { productId: 'p2', productName: 'OG Kush 3.5g', totalQty: 44, totalRevenue: 3080 },
  ]),
}));

jest.mock('../../src/data/repositories/inventory', () => ({
  getLowStockItems: jest.fn().mockResolvedValue([
    {
      productId: 'p3',
      productName: 'Sour Diesel Cart',
      category: 'Vape',
      locationName: 'Main Floor',
      quantityAvailable: 2,
      reorderPoint: 10,
      reorderQuantity: 25,
    },
  ]),
  listInventory: jest.fn().mockResolvedValue([]),
}));

jest.mock('../../src/data/repositories/metrc', () => ({
  listActiveMetrcPackages: jest.fn().mockResolvedValue([]),
  getMetrcPackageByLabel: jest.fn().mockResolvedValue({
    id: 'mp1',
    tenantId: 't1',
    label: '1A4060300002DB8000000001',
    packageType: 'Product',
    itemName: 'Blue Dream Flower',
    itemCategory: 'Flower',
    quantity: 28.0,
    unitOfMeasure: 'Grams',
    isActive: true,
    packagedDate: new Date('2024-01-10'),
    useByDate: null,
    labTestingState: 'TestPassed',
    thcPercentage: 22.4,
    cbdPercentage: 0.1,
    sourceHarvestName: 'Harvest-001',
    licenseNumber: 'C11-0000001-LIC',
    syncedAt: new Date(),
    updatedAt: new Date(),
  }),
}));

// ---- Shared test context ---------------------------------------------------

const mockSql = jest.fn() as unknown as AgentContext['sql'];

const ctx: AgentContext = {
  tenantId: 'tenant-test-001',
  sql: mockSql,
};

// ---- Helpers ---------------------------------------------------------------

/** Build a mock response that asks Claude to call a tool. */
function toolUseResponse(toolName: string, toolId: string, toolInput: Record<string, unknown>) {
  return {
    stop_reason: 'tool_use',
    content: [
      { type: 'tool_use', id: toolId, name: toolName, input: toolInput },
    ],
  };
}

/** Build a mock response with a final text answer. */
function textResponse(text: string) {
  return {
    stop_reason: 'end_turn',
    content: [{ type: 'text', text }],
  };
}

// ---- Tests -----------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  // Clear session memory between tests
  (sessionMemory as unknown as { store: Map<string, unknown> }).store.clear();
});

describe('WinstonAgent.ask()', () => {
  it('returns a direct answer when no tools are needed', async () => {
    mockCreate.mockResolvedValueOnce(textResponse('Today is a great day to run your dispensary.'));

    const agent = new WinstonAgent();
    const result = await agent.ask({ question: 'Hello, what can you help me with?' }, ctx);

    expect(result.answer).toBe('Today is a great day to run your dispensary.');
    expect(result.sources).toHaveLength(0);
    expect(result.toolInvocations).toHaveLength(0);
    expect(result.sessionId).toBeTruthy();
  });

  it('executes a tool and returns an answer with source attribution', async () => {
    mockCreate
      .mockResolvedValueOnce(
        toolUseResponse('get_top_selling_products', 'tu1', {
          start_date: '2024-01-01',
          end_date: '2024-01-07',
        })
      )
      .mockResolvedValueOnce(
        textResponse('Your top seller this week was Blue Dream 1g with $3,520 in revenue.')
      );

    const agent = new WinstonAgent();
    const result = await agent.ask(
      { question: "What's my top-selling product this week?" },
      ctx
    );

    expect(result.answer).toContain('Blue Dream');
    expect(result.sources).toContain('POS sales data');
    expect(result.toolInvocations).toHaveLength(1);
    expect(result.toolInvocations[0].tool).toBe('get_top_selling_products');
  });

  it('handles multiple sequential tool calls', async () => {
    mockCreate
      .mockResolvedValueOnce(
        toolUseResponse('get_sales_summary', 'tu1', {
          start_date: '2024-01-01',
          end_date: '2024-01-07',
        })
      )
      .mockResolvedValueOnce(
        toolUseResponse('get_low_stock_items', 'tu2', {})
      )
      .mockResolvedValueOnce(
        textResponse('Revenue this week: $18,340. Also, Sour Diesel Cart is low on stock.')
      );

    const agent = new WinstonAgent();
    const result = await agent.ask({ question: 'Give me a weekly summary.' }, ctx);

    expect(result.toolInvocations).toHaveLength(2);
    expect(result.sources).toContain('POS sales data');
    expect(result.sources).toContain('POS inventory data');
  });

  it('checks a METRC package and includes compliance source', async () => {
    mockCreate
      .mockResolvedValueOnce(
        toolUseResponse('check_metrc_package', 'tu1', {
          package_label: '1A4060300002DB8000000001',
        })
      )
      .mockResolvedValueOnce(
        textResponse(
          'Package 1A4060300002DB8000000001 is active, lab testing passed, THC 22.4%.'
        )
      );

    const agent = new WinstonAgent();
    const result = await agent.ask(
      { question: 'Am I compliant on package 1A4060300002DB8000000001?' },
      ctx
    );

    expect(result.sources).toContain('METRC compliance records');
    expect(result.toolInvocations[0].tool).toBe('check_metrc_package');
  });

  it('preserves session history across multiple turns', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse('Your revenue last week was $18,340.'))
      .mockResolvedValueOnce(textResponse('That is a 12% increase from the prior week.'));

    const agent = new WinstonAgent();
    const first = await agent.ask({ question: 'What was my revenue last week?' }, ctx);
    const second = await agent.ask(
      { question: 'How does that compare to the week before?', sessionId: first.sessionId },
      ctx
    );

    expect(second.sessionId).toBe(first.sessionId);
    // On the second call, messages should include the prior turn
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    expect(secondCallMessages.length).toBeGreaterThan(1);
  });

  it('handles tool execution errors gracefully', async () => {
    const { getSalesSummary } = await import('../../src/data/repositories/sales');
    (getSalesSummary as jest.Mock).mockRejectedValueOnce(new Error('DB connection failed'));

    mockCreate
      .mockResolvedValueOnce(
        toolUseResponse('get_sales_summary', 'tu1', {
          start_date: '2024-01-01',
          end_date: '2024-01-07',
        })
      )
      .mockResolvedValueOnce(
        textResponse('I was unable to retrieve sales data due to a database error.')
      );

    const agent = new WinstonAgent();
    const result = await agent.ask({ question: 'What are my sales?' }, ctx);

    // Should not throw — error is passed as tool result content
    expect(result.answer).toContain('unable');
    const invocation = result.toolInvocations[0];
    expect((invocation.output as { error: string }).error).toBe('DB connection failed');
  });
});
