/**
 * Task handler: customer-segment-analysis
 *
 * Analyzes customer purchase history and segments customers into behavioral
 * tiers based on recency, frequency, and spend (RFM-lite).
 *
 * Segments:
 *   - champions    — high frequency, high spend, recent visit
 *   - loyalists    — regular visitors, moderate-to-high spend
 *   - at_risk      — previously active, no recent visit (>60 days)
 *   - new          — first visit within the last 30 days
 *   - dormant      — no visit in >90 days
 *
 * Required permissions: sales:read
 *
 * Steps:
 *   1. fetch-customer-stats   — aggregate visit counts, spend, recency per customer
 *   2. segment-customers      — classify each customer into a segment
 *   3. build-report           — summarize segment counts and top customers
 */

import type { TaskHandler, TaskContext, TaskStep } from '../types';
import { makeStep, runStep } from '../../skills/engine';

// ---- Types ------------------------------------------------------------------

export type CustomerSegment =
  | 'champions'
  | 'loyalists'
  | 'at_risk'
  | 'new'
  | 'dormant';

export interface CustomerSegmentRecord {
  customerId: string;
  segment: CustomerSegment;
  visitCount: number;
  totalSpend: number;
  daysSinceLastVisit: number | null;
}

export interface SegmentSummary {
  segment: CustomerSegment;
  count: number;
  averageSpend: number;
  averageVisits: number;
}

export interface CustomerSegmentAnalysisOutput {
  runAt: string;
  totalCustomersAnalyzed: number;
  segments: SegmentSummary[];
  /** Top 10 customers by spend (excluding PII: no name/email). */
  topCustomersBySpend: CustomerSegmentRecord[];
}

// ---- Segmentation logic -----------------------------------------------------

function classifyCustomer(
  visitCount: number,
  totalSpend: number,
  daysSinceLastVisit: number | null
): CustomerSegment {
  const isRecent = daysSinceLastVisit !== null && daysSinceLastVisit <= 30;
  const isActive = daysSinceLastVisit !== null && daysSinceLastVisit <= 60;
  const isNew = visitCount <= 2 && isRecent;
  const isDormant = daysSinceLastVisit === null || daysSinceLastVisit > 90;

  if (isNew) return 'new';
  if (isDormant) return 'dormant';
  if (!isActive) return 'at_risk';
  if (visitCount >= 10 && totalSpend >= 500) return 'champions';
  return 'loyalists';
}

// ---- Handler ----------------------------------------------------------------

export const customerSegmentAnalysisHandler: TaskHandler = {
  type: 'customer-segment-analysis',
  requiredPermissions: ['sales:read'],

  async execute(
    _params: Record<string, unknown>,
    ctx: TaskContext,
    steps: TaskStep[]
  ): Promise<CustomerSegmentAnalysisOutput> {
    const runAt = new Date().toISOString();
    const now = new Date();

    // ── Step 1: fetch customer stats ─────────────────────────────────────────
    const fetchStep = makeStep('fetch-customer-stats', 'Fetch customer visit and spend statistics');
    steps.push(fetchStep);

    type CustomerRow = {
      id: string;
      visit_count: number;
      total_spend: number;
      last_visit_at: Date | null;
    };

    const customerRows = await runStep(fetchStep, async () => {
      const rows = await ctx.sql`
        SELECT
          id,
          visit_count,
          total_spend,
          last_visit_at
        FROM customers
        WHERE visit_count > 0
        ORDER BY total_spend DESC
        LIMIT 5000
      `;
      return rows as CustomerRow[];
    });

    // ── Step 2: segment customers ────────────────────────────────────────────
    const segmentStep = makeStep('segment-customers', 'Classify customers into behavioral segments');
    steps.push(segmentStep);

    const segmented = await runStep(segmentStep, async () => {
      return (customerRows as CustomerRow[]).map((row): CustomerSegmentRecord => {
        const daysSinceLastVisit =
          row.last_visit_at
            ? Math.floor((now.getTime() - new Date(row.last_visit_at).getTime()) / (1000 * 60 * 60 * 24))
            : null;

        return {
          customerId: row.id,
          segment: classifyCustomer(
            Number(row.visit_count),
            Number(row.total_spend),
            daysSinceLastVisit
          ),
          visitCount: Number(row.visit_count),
          totalSpend: Number(row.total_spend),
          daysSinceLastVisit,
        };
      });
    });

    // ── Step 3: build report ─────────────────────────────────────────────────
    const reportStep = makeStep('build-report', 'Aggregate segment statistics');
    steps.push(reportStep);

    const output = await runStep(reportStep, async () => {
      const records = segmented as CustomerSegmentRecord[];

      // Aggregate by segment
      const segmentMap = new Map<CustomerSegment, CustomerSegmentRecord[]>();
      for (const r of records) {
        const bucket = segmentMap.get(r.segment) ?? [];
        bucket.push(r);
        segmentMap.set(r.segment, bucket);
      }

      const ALL_SEGMENTS: CustomerSegment[] = [
        'champions', 'loyalists', 'at_risk', 'new', 'dormant',
      ];

      const segments: SegmentSummary[] = ALL_SEGMENTS.map((seg) => {
        const members = segmentMap.get(seg) ?? [];
        const avgSpend =
          members.length > 0
            ? members.reduce((s, r) => s + r.totalSpend, 0) / members.length
            : 0;
        const avgVisits =
          members.length > 0
            ? members.reduce((s, r) => s + r.visitCount, 0) / members.length
            : 0;
        return {
          segment: seg,
          count: members.length,
          averageSpend: Math.round(avgSpend * 100) / 100,
          averageVisits: Math.round(avgVisits * 10) / 10,
        };
      });

      // Top 10 by spend (no PII)
      const topCustomersBySpend = records
        .sort((a, b) => b.totalSpend - a.totalSpend)
        .slice(0, 10);

      return {
        runAt,
        totalCustomersAnalyzed: records.length,
        segments,
        topCustomersBySpend,
      };
    });

    return output as CustomerSegmentAnalysisOutput;
  },
};
