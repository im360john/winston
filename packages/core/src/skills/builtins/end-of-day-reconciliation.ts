/**
 * Built-in skill: end-of-day-reconciliation
 *
 * Compares POS inventory records against METRC active packages and flags
 * discrepancies. This is the compliance check dispensaries must perform
 * daily before closing.
 *
 * Steps:
 *   1. fetch-pos-inventory   — load all inventory records with METRC tags
 *   2. fetch-metrc-packages  — load all active METRC packages from DB
 *   3. reconcile             — run in-memory comparison, surface discrepancies
 *   4. fetch-sales-summary   — pull today's sales for context in the report
 *
 * Output: ReconciliationReport (includes discrepancies + daily sales context)
 *
 * Note: This skill reconciles against the *synced* METRC snapshot in the DB.
 * For a live METRC call, the ingestion pipeline should run first.
 */

import type { SkillContext, SkillStep } from '../types';
import type { SkillHandler } from '../engine';
import { makeStep, runStep } from '../engine';
import { listActiveMetrcPackages } from '../../data/repositories/metrc';
import { getSalesSummary } from '../../data/repositories/sales';
import type { SqlContext } from '../../db/types';

// ---- Types ------------------------------------------------------------------

export type DiscrepancyType = 'quantity_mismatch' | 'missing_in_pos' | 'missing_in_metrc';

export interface ReconciliationDiscrepancy {
  metrcTag: string;
  posQuantity: number | null;
  metrcQuantity: number | null;
  delta: number;
  type: DiscrepancyType;
  metrcProductName?: string;
}

export interface DailySalesContext {
  totalTransactions: number;
  totalRevenue: number;
  totalTax: number;
}

export interface ReconciliationReport {
  runAt: string;
  date: string; // YYYY-MM-DD of the reconciliation period
  totalPosRecords: number;
  totalMetrcPackages: number;
  discrepancyCount: number;
  isClean: boolean;
  discrepancies: ReconciliationDiscrepancy[];
  salesContext: DailySalesContext;
}

// ---- Helpers ----------------------------------------------------------------

/**
 * Query inventory records with METRC tags by joining products table.
 * Returns only records where the linked product has a metrc_tag.
 */
async function fetchInventoryWithMetrcTags(
  sql: SqlContext
): Promise<{ id: string; quantityOnHand: number; quantityReserved: number; metrcTag: string }[]> {
  const rows = await sql`
    SELECT
      ir.id,
      ir.quantity_on_hand,
      ir.quantity_reserved,
      p.metrc_tag
    FROM inventory_records ir
    JOIN products p ON p.id = ir.product_id
    WHERE p.metrc_tag IS NOT NULL
      AND p.metrc_tag <> ''
  `;
  return rows.map((r) => ({
    id: r.id as string,
    quantityOnHand: r.quantity_on_hand as number,
    quantityReserved: r.quantity_reserved as number,
    metrcTag: r.metrc_tag as string,
  }));
}

function reconcile(
  posRecords: { id: string; quantityOnHand: number; quantityReserved: number; metrcTag: string }[],
  metrcPackages: { label: string; quantity: number; itemName: string | null }[]
): ReconciliationDiscrepancy[] {
  const discrepancies: ReconciliationDiscrepancy[] = [];

  const posByTag = new Map<string, { id: string; qty: number }>();
  for (const rec of posRecords) {
    posByTag.set(rec.metrcTag, {
      id: rec.id,
      qty: rec.quantityOnHand + rec.quantityReserved,
    });
  }

  const metrcByLabel = new Map<string, { quantity: number; itemName: string | null }>();
  for (const pkg of metrcPackages) {
    metrcByLabel.set(pkg.label, { quantity: pkg.quantity, itemName: pkg.itemName });
  }

  // Pass 1: every METRC package vs POS
  for (const [label, pkg] of metrcByLabel) {
    const pos = posByTag.get(label);
    if (!pos) {
      discrepancies.push({
        metrcTag: label,
        posQuantity: null,
        metrcQuantity: pkg.quantity,
        delta: -pkg.quantity,
        type: 'missing_in_pos',
        metrcProductName: pkg.itemName ?? undefined,
      });
    } else if (pos.qty !== pkg.quantity) {
      discrepancies.push({
        metrcTag: label,
        posQuantity: pos.qty,
        metrcQuantity: pkg.quantity,
        delta: pos.qty - pkg.quantity,
        type: 'quantity_mismatch',
        metrcProductName: pkg.itemName ?? undefined,
      });
    }
  }

  // Pass 2: tagged POS records not in METRC
  for (const [tag, pos] of posByTag) {
    if (!metrcByLabel.has(tag)) {
      discrepancies.push({
        metrcTag: tag,
        posQuantity: pos.qty,
        metrcQuantity: null,
        delta: pos.qty,
        type: 'missing_in_metrc',
      });
    }
  }

  return discrepancies;
}

// ---- Skill ------------------------------------------------------------------

export const endOfDayReconciliationSkill: SkillHandler = {
  definition: {
    id: 'end-of-day-reconciliation',
    name: 'End-of-Day Reconciliation',
    description:
      'Compares POS inventory records against METRC active packages and flags ' +
      'discrepancies (quantity mismatches, packages missing in either system). ' +
      'Also summarizes today\'s sales for the end-of-day report.',
    version: '1.0.0',
    category: 'compliance',
    requiredPermissions: ['compliance:read'],
    parameters: {
      date: {
        type: 'date',
        description:
          'The date to reconcile (YYYY-MM-DD). Defaults to today.',
        required: false,
      },
    },
  },

  async execute(
    params: Record<string, unknown>,
    ctx: SkillContext,
    steps: SkillStep[]
  ): Promise<ReconciliationReport> {
    // Determine the target date
    const targetDateStr =
      typeof params.date === 'string' && params.date
        ? params.date
        : new Date().toISOString().slice(0, 10);

    const dayStart = new Date(`${targetDateStr}T00:00:00.000Z`);
    const dayEnd = new Date(`${targetDateStr}T23:59:59.999Z`);

    // ── Step 1: fetch POS inventory with METRC tags ──────────────────────────
    const posStep = makeStep('fetch-pos-inventory', 'Fetch POS inventory records with METRC tags');
    steps.push(posStep);

    const posRecords = await runStep(posStep, () =>
      fetchInventoryWithMetrcTags(ctx.sql)
    );

    // ── Step 2: fetch active METRC packages ──────────────────────────────────
    const metrcStep = makeStep('fetch-metrc-packages', 'Fetch active METRC packages from sync');
    steps.push(metrcStep);

    const metrcPackages = await runStep(metrcStep, () =>
      listActiveMetrcPackages(ctx.sql, { limit: 2000 })
    );

    // ── Step 3: reconcile ────────────────────────────────────────────────────
    const reconcileStep = makeStep('reconcile', 'Compare POS vs METRC inventory');
    steps.push(reconcileStep);

    const discrepancies = await runStep(reconcileStep, async () =>
      reconcile(
        posRecords as Awaited<ReturnType<typeof fetchInventoryWithMetrcTags>>,
        (metrcPackages as Awaited<ReturnType<typeof listActiveMetrcPackages>>).map((p) => ({
          label: p.label,
          quantity: p.quantity,
          itemName: p.itemName,
        }))
      )
    );

    // ── Step 4: fetch today's sales summary for context ──────────────────────
    const salesStep = makeStep('fetch-sales-summary', 'Fetch daily sales summary for report context');
    steps.push(salesStep);

    const salesSummary = await runStep(salesStep, () =>
      getSalesSummary(ctx.sql, dayStart, dayEnd)
    );

    const report: ReconciliationReport = {
      runAt: new Date().toISOString(),
      date: targetDateStr,
      totalPosRecords: (posRecords as Awaited<ReturnType<typeof fetchInventoryWithMetrcTags>>).length,
      totalMetrcPackages: (metrcPackages as Awaited<ReturnType<typeof listActiveMetrcPackages>>).length,
      discrepancyCount: (discrepancies as ReconciliationDiscrepancy[]).length,
      isClean: (discrepancies as ReconciliationDiscrepancy[]).length === 0,
      discrepancies: discrepancies as ReconciliationDiscrepancy[],
      salesContext: {
        totalTransactions: (salesSummary as Awaited<ReturnType<typeof getSalesSummary>>).totalTransactions,
        totalRevenue: (salesSummary as Awaited<ReturnType<typeof getSalesSummary>>).totalRevenue,
        totalTax: (salesSummary as Awaited<ReturnType<typeof getSalesSummary>>).totalTax,
      },
    };

    return report;
  },
};
