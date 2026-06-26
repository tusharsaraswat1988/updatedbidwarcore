export * from "./types.js";
export { extractMergeVariables, findUnknownVariables, renderMergeTemplate, highlightUnknownVariables, buildSampleMergeData } from "./merge-variables.js";
export {
  getTemplateByKey,
  getTemplateById,
  getTemplateByEventType,
  listTemplates,
  createTemplateVersion,
  getTemplateVersion,
  logCommunicationAction,
  countTemplates,
} from "./template-service.js";
export {
  createCommunicationJob,
  getJobById,
  updateJobStatus,
  queueJob,
  revalidateAndRefreshJob,
  updateJobRecipient,
  listJobs,
  countJobs,
  createResendJob,
  cancelJob,
  getEntityCommunicationHistory,
} from "./job-service.js";
export { validateJobForSend } from "./validation.js";
export {
  recoverPendingJobsForEntity,
  sweepPendingJobsForRecovery,
  recoverJobsForTeamEmailUpdate,
  recoverJobsForPlayerEmailUpdate,
  recoverJobsForOrganizerEmailUpdate,
} from "./recovery.js";
export { createJobFromBusinessEvent, enqueueCommunicationFromEvent } from "./event-bridge.js";
export { startCommunicationWorker, stopCommunicationWorker } from "./worker.js";
export { getDashboardStats, resolveBulkRecipients, queueBulkCommunication, getSettings, updateSetting, getBulkTargets } from "./dashboard-service.js";
export { buildMergeDataForRecipient, refreshJobMergeData } from "./merge-data-builder.js";
export { seedCommunicationDefaults } from "./seed-templates.js";
