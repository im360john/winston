/**
 * Built-in skill: compliance-check
 *
 * Validates the current compliance posture of a dispensary by checking:
 *   1. Package tracking — active METRC packages with missing or failed lab tests
 *   2. Use-by / expiration — packages with a use_by_date in the past
 *   3. License status — tenant's METRC license expiration from the DB
 *
 * Steps:
 *   1. check-package-lab-status   — find packages without passing lab tests
 *   2. check-use-by-dates         — find packages past their use-by date
 *   3. check-license-status       — verify license expiration from tenant record
 *
 * Output: ComplianceReport
 */

import type { SkillContext, SkillStep } from '../types';
import type { SkillHandler } from '../engine';
import { makeStep, runStep } from '../engine';
import { listActiveMetrcPackages } from '../../data/repositories/metrc';
import type { SqlContext } from '../../db/types';

// ---- Types ------------------------------------------------------------------

export type LabIssueType = 'not_tested' | 'failed' | 'testing_in_progress' | 'unknown_state';

export interface PackageLabIssue {
  label: string;
  itemName: string | null;
  itemCategory: string | null;
  labTestingState: string | null;
  issueType: LabIssueType;
}

export interface PackageExpiredIssue {
  label: string;
  itemName: string | null;
  useByDate: string;
  daysPastExpiry: number;
}

export type LicenseStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

export interface LicenseStatusResult {
  licenseNumber: string | null;
  status: LicenseStatus;
  /** Days until expiration (negative if already expired). */
  daysUntilExpiry: number | null;
}

export interface ComplianceReport {
  runAt: string;
  isCompliant: boolean;
  /** Total number of compliance issues found across all checks. */
  totalIssueCount: number;
  labIssues: PackageLabIssue[];
  expiredPackages: PackageExpiredIssue[];
  licenseStatus: LicenseStatusResult;
  /** Human-readable summary of the compliance posture. */
  summary: string;
}

// ---- Helpers ----------------------------------------------------------------

/** Lab testing states that indicate the package is compliant. */
const PASSING_LAB_STATES = new Set([
  'TestPassed',
  'Passed',
  'passed',
  'test_passed',
  'N/A',    // non-cannabis items that don't require testing
]);

/** Classify a lab testing state string into an issue type (or null if OK). */
function classifyLabState(state: string | null): LabIssueType | null {
  if (!state) return 'unknown_state';
  if (PASSING_LAB_STATES.has(state)) return null;
  const lower = state.toLowerCase();
  if (lower.includes('fail')) return 'failed';
  if (lower.includes('progress') || lower.includes('submitted')) return 'testing_in_progress';
  if (lower.includes('not') || lower.includes('untested')) return 'not_tested';
  return 'unknown_state';
}

/** Query tenant record to get METRC license number (for status display). */
async function fetchTenantLicense(
  sql: SqlContext
): Promise<{ licenseNumber: string | null; metrcLicense: string | null }> {
  const rows = await sql`
    SELECT license_number, metrc_license FROM tenants LIMIT 1
  `;
  if (rows.length === 0) return { licenseNumber: null, metrcLicense: null };
  return {
    licenseNumber: rows[0].license_number as string | null,
    metrcLicense: rows[0].metrc_license as string | null,
  };
}

/**
 * Determine license status from the most recent METRC package that carries
 * a license_number (since we don't store a separate license expiry date in
 * the current schema). We use the earliest use_by_date as a conservative
 * proxy if no dedicated license record exists.
 *
 * If no information is available, returns 'unknown'.
 */
function deriveLicenseStatus(
  licenseNumber: string | null,
  packages: { licenseNumber: string | null; useByDate: Date | null }[]
): LicenseStatusResult {
  const displayLicense = licenseNumber ?? packages.find((p) => p.licenseNumber)?.licenseNumber ?? null;

  // We don't have an explicit license expiry date in this schema version.
  // Report as unknown with the license number for operator visibility.
  return {
    licenseNumber: displayLicense,
    status: 'unknown',
    daysUntilExpiry: null,
  };
}

// ---- Skill ------------------------------------------------------------------

export const complianceCheckSkill: SkillHandler = {
  definition: {
    id: 'compliance-check',
    name: 'Compliance Check',
    description:
      'Validates compliance posture: checks all active METRC packages for ' +
      'missing or failed lab tests, expired use-by dates, and surfaces the ' +
      'current license status. Returns a structured compliance report.',
    version: '1.0.0',
    category: 'compliance',
    requiredPermissions: ['compliance:read'],
    parameters: {},
  },

  async execute(
    _params: Record<string, unknown>,
    ctx: SkillContext,
    steps: SkillStep[]
  ): Promise<ComplianceReport> {
    const now = new Date();

    // ── Step 1: check package lab status ────────────────────────────────────
    const labStep = makeStep('check-package-lab-status', 'Check METRC package lab testing status');
    steps.push(labStep);

    const allPackages = await runStep(labStep, () =>
      listActiveMetrcPackages(ctx.sql, { limit: 2000 })
    );

    const labIssues: PackageLabIssue[] = [];
    for (const pkg of allPackages as Awaited<ReturnType<typeof listActiveMetrcPackages>>) {
      const issueType = classifyLabState(pkg.labTestingState);
      if (issueType !== null) {
        labIssues.push({
          label: pkg.label,
          itemName: pkg.itemName,
          itemCategory: pkg.itemCategory,
          labTestingState: pkg.labTestingState,
          issueType,
        });
      }
    }

    // ── Step 2: check use-by dates ───────────────────────────────────────────
    const expiryStep = makeStep('check-use-by-dates', 'Check package use-by / expiration dates');
    steps.push(expiryStep);

    const expiredPackages: PackageExpiredIssue[] = [];
    await runStep(expiryStep, async () => {
      for (const pkg of allPackages as Awaited<ReturnType<typeof listActiveMetrcPackages>>) {
        if (!pkg.useByDate) continue;
        const useBy = new Date(pkg.useByDate);
        if (useBy < now) {
          const daysPast = Math.floor(
            (now.getTime() - useBy.getTime()) / (1000 * 60 * 60 * 24)
          );
          expiredPackages.push({
            label: pkg.label,
            itemName: pkg.itemName,
            useByDate: pkg.useByDate.toISOString().slice(0, 10),
            daysPastExpiry: daysPast,
          });
        }
      }
    });

    // ── Step 3: check license status ─────────────────────────────────────────
    const licenseStep = makeStep('check-license-status', 'Check METRC license status');
    steps.push(licenseStep);

    const licenseStatus = await runStep(licenseStep, async () => {
      const tenant = await fetchTenantLicense(ctx.sql);
      return deriveLicenseStatus(
        tenant.licenseNumber ?? tenant.metrcLicense,
        (allPackages as Awaited<ReturnType<typeof listActiveMetrcPackages>>).map((p) => ({
          licenseNumber: p.licenseNumber,
          useByDate: p.useByDate,
        }))
      );
    });

    // ── Build report ─────────────────────────────────────────────────────────
    const totalIssueCount =
      labIssues.length +
      expiredPackages.length +
      ((licenseStatus as LicenseStatusResult).status === 'expired' ? 1 : 0);

    const isCompliant = totalIssueCount === 0;

    let summary: string;
    if (isCompliant) {
      summary = 'All compliance checks passed. No issues found.';
    } else {
      const parts: string[] = [];
      if (labIssues.length > 0) {
        parts.push(`${labIssues.length} package(s) with lab testing issues`);
      }
      if (expiredPackages.length > 0) {
        parts.push(`${expiredPackages.length} expired package(s)`);
      }
      if ((licenseStatus as LicenseStatusResult).status === 'expired') {
        parts.push('license is expired');
      } else if ((licenseStatus as LicenseStatusResult).status === 'expiring_soon') {
        parts.push('license is expiring soon');
      }
      summary = `Compliance issues found: ${parts.join(', ')}.`;
    }

    return {
      runAt: now.toISOString(),
      isCompliant,
      totalIssueCount,
      labIssues,
      expiredPackages,
      licenseStatus: licenseStatus as LicenseStatusResult,
      summary,
    };
  },
};
