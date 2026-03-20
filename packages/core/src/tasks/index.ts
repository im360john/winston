/**
 * Winston Tasks — public entry point.
 *
 * Wires together the store, executor, and all built-in task handlers.
 * Import this module once at server startup to register handlers and
 * start the background worker.
 *
 * Usage:
 *   import './tasks';  // registers handlers + starts worker as a side effect
 *   import { taskStore, startTaskWorker } from './tasks';
 */

export { taskStore } from './store';
export {
  startTaskWorker,
  stopTaskWorker,
  registerTaskHandler,
  getTaskHandler,
  listTaskHandlers,
} from './executor';
export type {
  WinstonTask,
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskContext,
  TaskHandler,
  TaskStep,
  CreateTaskInput,
} from './types';
export { VALID_TASK_TYPES, VALID_PRIORITIES } from './types';

// ---- Register built-in handlers (side effect) --------------------------------

import { registerTaskHandler, startTaskWorker } from './executor';
import { complianceReportHandler } from './handlers/compliance-report';
import { restockRecommendationHandler } from './handlers/restock-recommendation';
import { customerSegmentAnalysisHandler } from './handlers/customer-segment-analysis';

registerTaskHandler(complianceReportHandler);
registerTaskHandler(restockRecommendationHandler);
registerTaskHandler(customerSegmentAnalysisHandler);

// Start the background worker immediately on import.
startTaskWorker();
