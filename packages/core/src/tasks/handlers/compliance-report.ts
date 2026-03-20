/**
 * Task handler: compliance-report
 *
 * Delegates to the compliance-check skill to produce a full compliance report
 * covering METRC package lab testing, use-by dates, and license status.
 *
 * Required permissions: compliance:read
 * Output: ComplianceReport (see skills/builtins/compliance-check.ts)
 */

import type { TaskHandler, TaskContext, TaskStep } from '../types';
import { complianceCheckSkill } from '../../skills/builtins/compliance-check';

export const complianceReportHandler: TaskHandler = {
  type: 'compliance-report',
  requiredPermissions: ['compliance:read'],

  execute(
    params: Record<string, unknown>,
    ctx: TaskContext,
    steps: TaskStep[]
  ): Promise<unknown> {
    return complianceCheckSkill.execute(params, ctx, steps);
  },
};
