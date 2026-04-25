export const QUEUE_NAMES = {
  EMAIL: 'email',
  EMAIL_MARKETING: 'email-marketing',
  SYNC_TASKS: 'sync-tasks',
  BACKUP_PROCESSING: 'backup-processing',
  MESSAGE_QUEUE: 'message-queue',
  MEDIA_PROCESSING: 'media-processing',
  DEFAULT: 'default',
  USER_DATA_EXPORT: 'user-data-export',
  SUBSCRIPTIONS: 'subscriptions',
  WEBHOOKS: 'webhooks',
} as const;

export const JOB_NAMES = {
  // Email queue
  SEND_EMAIL: 'send-email',

  // Email marketing queue
  SEND_CAMPAIGN: 'send-campaign',
  PROCESS_CAMPAIGN: 'process-campaign',
  RESUME_CAMPAIGN: 'resume-campaign',
  SEND_AUTOMATION_EMAIL: 'send-automation-email',
  CONTINUE_AUTOMATION: 'continue-automation',
  CALL_WEBHOOK: 'call-webhook',

  // Sync tasks queue
  CONSISTENCY_CHECK: 'consistency-check',
  REPLICATE_DATA: 'replicate-data',

  // Backup processing queue
  CREATE_BACKUP: 'create-backup',
  VERIFY_BACKUP: 'verify-backup',
  RECOVERY_TEST: 'recovery-test',
  DELETE_BACKUP: 'delete-backup',

  // Media processing queue
  TRANSCODE_VIDEO: 'transcode-video',

  // Payments queues
  PROCESS_SUBSCRIPTION: 'process_subscription',
  PROCESS_WEBHOOK: 'process-webhook',
} as const;
