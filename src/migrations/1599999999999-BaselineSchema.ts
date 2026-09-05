import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline schema migration.
 *
 * Reproduces the full schema that TypeORM's `synchronize` previously created
 * in development before the incremental migrations in this directory were
 * introduced. The timestamp is the lowest of all migrations so this runs
 * first and every subsequent migration applies cleanly on top.
 *
 * Generated from the entity metadata via `synchronize` and normalized with
 * `pg_dump --schema-only`.
 */
export class BaselineSchema1599999999999 implements MigrationInterface {
  name = 'BaselineSchema1599999999999';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public
    `);
    await queryRunner.query(`CREATE TYPE public.ab_tests_status_enum AS ENUM (
    'draft',
    'running',
    'completed',
    'cancelled'
)
    `);
    await queryRunner.query(`CREATE TYPE public.achievements_difficulty_enum AS ENUM (
    'easy',
    'medium',
    'hard',
    'legendary'
)
    `);
    await queryRunner.query(`CREATE TYPE public.achievements_type_enum AS ENUM (
    'milestone',
    'challenge',
    'streaks',
    'skill_based',
    'engagement',
    'contribution'
)
    `);
    await queryRunner.query(`CREATE TYPE public.analytics_events_eventtype_enum AS ENUM (
    'signup',
    'login',
    'course_view',
    'purchase',
    'course_enroll',
    'lesson_complete',
    'quiz_attempt',
    'course_complete',
    'search',
    'wishlist_add',
    'review_submit',
    'custom'
)
    `);
    await queryRunner.query(`CREATE TYPE public.assessment_attempt_status_enum AS ENUM (
    'in_progress',
    'submitted',
    'graded',
    'timed_out'
)
    `);
    await queryRunner.query(`CREATE TYPE public.automation_actions_type_enum AS ENUM (
    'send_email',
    'wait',
    'add_tag',
    'remove_tag',
    'add_to_segment',
    'remove_from_segment',
    'update_property',
    'webhook',
    'send_sms',
    'send_push_notification'
)
    `);
    await queryRunner.query(`CREATE TYPE public.automation_triggers_type_enum AS ENUM (
    'user_signup',
    'course_enrolled',
    'course_completed',
    'purchase_made',
    'user_inactive',
    'subscription_created',
    'subscription_cancelled',
    'birthday',
    'custom_event',
    'date_based',
    'segment_entered',
    'segment_left'
)
    `);
    await queryRunner.query(`CREATE TYPE public.automation_workflows_status_enum AS ENUM (
    'draft',
    'active',
    'inactive',
    'archived'
)
    `);
    await queryRunner.query(`CREATE TYPE public.backup_records_backuptype_enum AS ENUM (
    'full',
    'incremental'
)
    `);
    await queryRunner.query(`CREATE TYPE public.backup_records_region_enum AS ENUM (
    'us-east-1',
    'us-west-2'
)
    `);
    await queryRunner.query(`CREATE TYPE public.backup_records_status_enum AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.badges_category_enum AS ENUM (
    'LEARNING',
    'SOCIAL',
    'ACHIEVEMENT',
    'ASSESSMENT',
    'CONTRIBUTION'
)
    `);
    await queryRunner.query(`CREATE TYPE public.badges_criteriatype_enum AS ENUM (
    'COURSES_COMPLETED',
    'LESSONS_WATCHED',
    'LEARNING_STREAK_DAYS',
    'ASSESSMENT_PERFECT_SCORE',
    'ASSESSMENTS_PASSED',
    'POINTS_REACHED',
    'LEVEL_REACHED',
    'REVIEWS_WRITTEN',
    'COURSES_CREATED'
)
    `);
    await queryRunner.query(`CREATE TYPE public.campaign_recipients_status_enum AS ENUM (
    'pending',
    'sent',
    'failed',
    'skipped'
)
    `);
    await queryRunner.query(`CREATE TYPE public.cohort_assignments_status_enum AS ENUM (
    'open',
    'closed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.content_metadata_content_type_enum AS ENUM (
    'image',
    'video',
    'document',
    'audio'
)
    `);
    await queryRunner.query(`CREATE TYPE public.content_metadata_status_enum AS ENUM (
    'uploading',
    'processing',
    'optimized',
    'ready',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.content_reports_reason_enum AS ENUM (
    'spam',
    'abuse',
    'inappropriate'
)
    `);
    await queryRunner.query(`CREATE TYPE public.content_reports_status_enum AS ENUM (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.course_reviews_decision_enum AS ENUM (
    'approved',
    'rejected',
    'changes_requested'
)
    `);
    await queryRunner.query(`CREATE TYPE public.course_status_enum AS ENUM (
    'draft',
    'pending_review',
    'changes_requested',
    'published',
    'rejected',
    'archived'
)
    `);
    await queryRunner.query(`CREATE TYPE public.course_versions_eventtype_enum AS ENUM (
    'created',
    'updated',
    'rolled_back'
)
    `);
    await queryRunner.query(`CREATE TYPE public.course_versions_status_enum AS ENUM (
    'draft',
    'pending_review',
    'changes_requested',
    'published',
    'rejected',
    'archived'
)
    `);
    await queryRunner.query(`CREATE TYPE public.email_campaigns_status_enum AS ENUM (
    'draft',
    'scheduled',
    'sending',
    'sent',
    'paused',
    'cancelled'
)
    `);
    await queryRunner.query(`CREATE TYPE public.email_events_eventtype_enum AS ENUM (
    'sent',
    'delivered',
    'opened',
    'clicked',
    'bounced',
    'soft_bounced',
    'complained',
    'unsubscribed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.experiment_metrics_type_enum AS ENUM (
    'conversion',
    'revenue',
    'engagement',
    'retention',
    'custom'
)
    `);
    await queryRunner.query(`CREATE TYPE public.experiments_status_enum AS ENUM (
    'draft',
    'running',
    'paused',
    'completed',
    'archived'
)
    `);
    await queryRunner.query(`CREATE TYPE public.experiments_type_enum AS ENUM (
    'a_b_test',
    'multivariate',
    'multi_armed_bandit'
)
    `);
    await queryRunner.query(`CREATE TYPE public.incidents_severity_enum AS ENUM (
    'info',
    'warning',
    'critical'
)
    `);
    await queryRunner.query(`CREATE TYPE public.incidents_status_enum AS ENUM (
    'detected',
    'in_progress',
    'resolved',
    'escalated',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.instructor_payouts_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.invoices_status_enum AS ENUM (
    'pending',
    'sent',
    'paid',
    'void',
    'refunded'
)
    `);
    await queryRunner.query(`CREATE TYPE public.notification_templates_channel_enum AS ENUM (
    'email',
    'push',
    'in_app',
    'sms'
)
    `);
    await queryRunner.query(`CREATE TYPE public.notifications_priority_enum AS ENUM (
    'low',
    'medium',
    'high',
    'urgent'
)
    `);
    await queryRunner.query(`CREATE TYPE public.notifications_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'retrying'
)
    `);
    await queryRunner.query(`CREATE TYPE public.notifications_type_enum AS ENUM (
    'email',
    'push',
    'in_app',
    'sms'
)
    `);
    await queryRunner.query(`CREATE TYPE public.onboarding_rewards_type_enum AS ENUM (
    'points',
    'badge',
    'coupon',
    'certificate'
)
    `);
    await queryRunner.query(`CREATE TYPE public.onboarding_steps_status_enum AS ENUM (
    'active',
    'inactive'
)
    `);
    await queryRunner.query(`CREATE TYPE public.onboarding_steps_type_enum AS ENUM (
    'tutorial',
    'profile_setup',
    'course_exploration',
    'first_enrollment',
    'community_intro'
)
    `);
    await queryRunner.query(`CREATE TYPE public.payment_methods_method_enum AS ENUM (
    'credit_card',
    'bank_transfer',
    'paypal',
    'crypto',
    'wallet'
)
    `);
    await queryRunner.query(`CREATE TYPE public.payments_method_enum AS ENUM (
    'credit_card',
    'bank_transfer',
    'paypal',
    'crypto',
    'wallet'
)
    `);
    await queryRunner.query(`CREATE TYPE public.payments_status_enum AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded',
    'cancelled'
)
    `);
    await queryRunner.query(`CREATE TYPE public.question_type_enum AS ENUM (
    'multiple_choice',
    'true_false',
    'coding'
)
    `);
    await queryRunner.query(`CREATE TYPE public.quota_definitions_tier_enum AS ENUM (
    'UNAUTHENTICATED',
    'FREE',
    'PRO',
    'PREMIUM',
    'ENTERPRISE'
)
    `);
    await queryRunner.query(`CREATE TYPE public.recovery_tests_status_enum AS ENUM (
    'pending',
    'running',
    'passed',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.refunds_status_enum AS ENUM (
    'pending',
    'approved',
    'rejected',
    'processed',
    'failed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.remediation_actions_status_enum AS ENUM (
    'queued',
    'in_progress',
    'completed',
    'failed',
    'rolled_back'
)
    `);
    await queryRunner.query(`CREATE TYPE public.runbook_executions_status_enum AS ENUM (
    'scheduled',
    'running',
    'completed',
    'failed',
    'partially_completed'
)
    `);
    await queryRunner.query(`CREATE TYPE public.segment_rules_field_enum AS ENUM (
    'email',
    'first_name',
    'last_name',
    'created_at',
    'last_login',
    'course_count',
    'total_spent',
    'tag',
    'country',
    'subscription_status'
)
    `);
    await queryRunner.query(`CREATE TYPE public.segment_rules_operator_enum AS ENUM (
    'equals',
    'not_equals',
    'contains',
    'not_contains',
    'starts_with',
    'ends_with',
    'greater_than',
    'less_than',
    'greater_or_equal',
    'less_or_equal',
    'is_set',
    'is_not_set',
    'in_list',
    'not_in_list',
    'before',
    'after',
    'between'
)
    `);
    await queryRunner.query(`CREATE TYPE public.subscriptions_interval_enum AS ENUM (
    'monthly',
    'yearly',
    'quarterly',
    'weekly'
)
    `);
    await queryRunner.query(`CREATE TYPE public.subscriptions_status_enum AS ENUM (
    'active',
    'cancelled',
    'past_due',
    'unpaid',
    'trialing',
    'incomplete',
    'paused'
)
    `);
    await queryRunner.query(`CREATE TYPE public.tenant_billing_billingcycle_enum AS ENUM (
    'monthly',
    'quarterly',
    'yearly'
)
    `);
    await queryRunner.query(`CREATE TYPE public.tenants_plan_enum AS ENUM (
    'free',
    'basic',
    'professional',
    'enterprise'
)
    `);
    await queryRunner.query(`CREATE TYPE public.tenants_status_enum AS ENUM (
    'active',
    'suspended',
    'inactive',
    'trial'
)
    `);
    await queryRunner.query(`CREATE TYPE public.user_onboarding_progress_status_enum AS ENUM (
    'not_started',
    'in_progress',
    'completed',
    'skipped'
)
    `);
    await queryRunner.query(`CREATE TYPE public.user_preferences_language_enum AS ENUM (
    'en',
    'fr',
    'es',
    'de',
    'ar'
)
    `);
    await queryRunner.query(`CREATE TYPE public.user_preferences_theme_enum AS ENUM (
    'light',
    'dark',
    'system'
)
    `);
    await queryRunner.query(`CREATE TYPE public.user_quota_usage_tier_enum AS ENUM (
    'UNAUTHENTICATED',
    'FREE',
    'PRO',
    'PREMIUM',
    'ENTERPRISE'
)
    `);
    await queryRunner.query(`CREATE TYPE public.users_status_enum AS ENUM (
    'active',
    'inactive',
    'suspended'
)
    `);
    await queryRunner.query(`CREATE TYPE public.webhook_retries_provider_enum AS ENUM (
    'stripe',
    'paypal'
)
    `);
    await queryRunner.query(`CREATE TYPE public.webhook_retries_status_enum AS ENUM (
    'pending',
    'processing',
    'succeeded',
    'failed',
    'dead_letter'
)
    `);
    await queryRunner.query(`CREATE TABLE public.ab_test_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "abTestId" uuid NOT NULL,
    "tenantId" uuid NOT NULL,
    name character varying NOT NULL,
    subject character varying,
    "templateId" character varying,
    "senderName" character varying,
    weight integer DEFAULT 50 NOT NULL,
    "recipientCount" integer DEFAULT 0 NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.ab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    "campaignId" uuid NOT NULL,
    "testField" character varying NOT NULL,
    "winnerCriteria" character varying DEFAULT 'open_rate'::character varying NOT NULL,
    "sampleSize" integer DEFAULT 20 NOT NULL,
    status public.ab_tests_status_enum DEFAULT 'draft'::public.ab_tests_status_enum NOT NULL,
    "winnerId" character varying,
    "startedAt" timestamp without time zone,
    "endedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.achievement_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "currentProgress" integer DEFAULT 0 NOT NULL,
    "targetProgress" integer DEFAULT 0 NOT NULL,
    "percentageComplete" integer DEFAULT 0 NOT NULL,
    "isUnlocked" boolean DEFAULT false NOT NULL,
    "lastProgressUpdate" timestamp without time zone,
    metadata jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "achievementId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.achievement_statistics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "achievementId" character varying NOT NULL,
    date date NOT NULL,
    "totalUnlocked" integer DEFAULT 0 NOT NULL,
    "unlockedToday" integer DEFAULT 0 NOT NULL,
    "unlockedPercentage" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "averageTimeToUnlock" numeric(10,2),
    "activeTrackers" integer DEFAULT 0 NOT NULL,
    "averageProgress" numeric(5,2) DEFAULT '0'::numeric NOT NULL,
    "engagementTrend" character varying,
    metadata jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.achievements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description character varying NOT NULL,
    "longDescription" text,
    "iconUrl" character varying NOT NULL,
    type public.achievements_type_enum NOT NULL,
    difficulty public.achievements_difficulty_enum NOT NULL,
    "pointsReward" integer DEFAULT 0 NOT NULL,
    "experienceReward" integer DEFAULT 100 NOT NULL,
    criteria jsonb,
    "progressConfig" jsonb,
    "isActive" boolean DEFAULT false NOT NULL,
    "isHidden" boolean DEFAULT false NOT NULL,
    "unlockedBy" integer,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.analytics_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "eventType" public.analytics_events_eventtype_enum NOT NULL,
    category character varying(64) NOT NULL,
    action character varying(64) NOT NULL,
    label character varying(128),
    value numeric(15,2),
    properties jsonb,
    "sessionId" character varying,
    "fingerprintId" character varying,
    user_id uuid,
    "ipAddress" character varying,
    "userAgent" character varying,
    "timestamp" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.answer (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    response json NOT NULL,
    "awardedPoints" integer,
    "attemptId" uuid,
    "questionId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.archived_data (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "entityType" character varying NOT NULL,
    "originalId" character varying NOT NULL,
    data jsonb NOT NULL,
    "archivedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "tableName" character varying
)
    `);
    await queryRunner.query(`CREATE TABLE public.assessment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    title character varying NOT NULL,
    description character varying,
    "durationMinutes" integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.assessment_attempt (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "studentId" character varying NOT NULL,
    status public.assessment_attempt_status_enum NOT NULL,
    score integer,
    "startedAt" timestamp without time zone NOT NULL,
    "submittedAt" timestamp without time zone,
    "assessmentId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.automation_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "workflowId" uuid NOT NULL,
    type public.automation_actions_type_enum NOT NULL,
    config jsonb NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    description text,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.automation_triggers (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "workflowId" uuid NOT NULL,
    type public.automation_triggers_type_enum NOT NULL,
    conditions jsonb,
    description text,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.automation_workflows (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text,
    status public.automation_workflows_status_enum DEFAULT 'draft'::public.automation_workflows_status_enum NOT NULL,
    "executionCount" integer DEFAULT 0 NOT NULL,
    "lastExecutedAt" timestamp without time zone,
    "activatedAt" timestamp without time zone,
    "deactivatedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.backup_records (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "backupType" public.backup_records_backuptype_enum DEFAULT 'full'::public.backup_records_backuptype_enum NOT NULL,
    status public.backup_records_status_enum DEFAULT 'pending'::public.backup_records_status_enum NOT NULL,
    region public.backup_records_region_enum NOT NULL,
    "databaseName" character varying NOT NULL,
    "storageKey" character varying NOT NULL,
    "encryptedStorageKey" character varying,
    "replicatedStorageKey" character varying,
    "kmsKeyId" character varying,
    "backupSizeBytes" bigint,
    "checksumMd5" character varying,
    "checksumSha256" character varying,
    "integrityVerified" boolean DEFAULT false NOT NULL,
    "verifiedAt" timestamp without time zone,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "errorMessage" character varying,
    "completedAt" timestamp without time zone,
    "expiresAt" timestamp without time zone,
    metadata json,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.badges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description character varying NOT NULL,
    "iconUrl" character varying,
    category public.badges_category_enum NOT NULL,
    "criteriaType" public.badges_criteriatype_enum NOT NULL,
    "criteriaValue" jsonb,
    "isActive" boolean DEFAULT true NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.campaign_recipients (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "campaignId" uuid NOT NULL,
    "userId" character varying NOT NULL,
    email character varying NOT NULL,
    status public.campaign_recipients_status_enum DEFAULT 'pending'::public.campaign_recipients_status_enum NOT NULL,
    "sentAt" timestamp without time zone,
    "variantId" character varying,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.challenges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    title character varying NOT NULL,
    description character varying NOT NULL,
    "rewardPoints" integer NOT NULL,
    "goalValue" integer NOT NULL,
    type character varying NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.cohort_assignments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "cohortId" uuid NOT NULL,
    title character varying NOT NULL,
    description text,
    "dueDate" timestamp without time zone,
    status public.cohort_assignments_status_enum DEFAULT 'open'::public.cohort_assignments_status_enum NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.cohort_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "threadId" uuid NOT NULL,
    "authorId" character varying NOT NULL,
    content text NOT NULL,
    "parentId" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.cohort_members (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "cohortId" uuid NOT NULL,
    "userId" character varying NOT NULL,
    role character varying DEFAULT 'member'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.cohort_threads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "cohortId" uuid NOT NULL,
    "authorId" character varying NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.cohorts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    "ownerId" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.content_metadata (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    content_id character varying NOT NULL,
    original_url character varying NOT NULL,
    cdn_url character varying,
    content_type public.content_metadata_content_type_enum NOT NULL,
    file_name character varying NOT NULL,
    mime_type character varying NOT NULL,
    file_size integer NOT NULL,
    optimized_size integer,
    status public.content_metadata_status_enum DEFAULT 'uploading'::public.content_metadata_status_enum NOT NULL,
    etag character varying,
    provider character varying DEFAULT 'cloudflare'::character varying NOT NULL,
    optimization_settings json,
    variants json,
    metadata json,
    owner_id character varying,
    tenant_id character varying,
    error_message character varying,
    retry_count integer DEFAULT 0 NOT NULL,
    last_accessed_at timestamp without time zone,
    access_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.content_reports (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "contentType" character varying NOT NULL,
    "contentId" character varying NOT NULL,
    reason public.content_reports_reason_enum NOT NULL,
    details text,
    reporter_id character varying,
    reviewer_id character varying,
    assigned_moderator_id character varying,
    "escalatedAt" timestamp without time zone,
    status public.content_reports_status_enum DEFAULT 'pending'::public.content_reports_status_enum NOT NULL,
    moderation_item_id integer,
    "resolutionNote" text,
    "resolvedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "reporterId" uuid,
    "reviewerId" uuid,
    "assignedModeratorId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.course (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    status public.course_status_enum DEFAULT 'draft'::public.course_status_enum NOT NULL,
    "thumbnailUrl" character varying,
    category character varying,
    instructor_id character varying NOT NULL,
    "submissionNote" text,
    "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english'::regconfig, (((((COALESCE(title, ''::character varying))::text || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || (COALESCE(category, ''::character varying))::text))) STORED NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone,
    "instructorId" uuid,
    prerequisite_course_id uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.course_module (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    title character varying NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    course_id character varying NOT NULL,
    "deletedAt" timestamp without time zone,
    "courseId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.course_reviews (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id character varying NOT NULL,
    reviewer_id character varying,
    decision public.course_reviews_decision_enum NOT NULL,
    feedback text,
    "previousStatus" character varying(50),
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "courseId" uuid,
    "reviewerId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.course_versions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    course_id character varying NOT NULL,
    "versionNumber" integer NOT NULL,
    "eventType" public.course_versions_eventtype_enum NOT NULL,
    changed_by_user_id character varying,
    title character varying NOT NULL,
    description text NOT NULL,
    price numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "thumbnailUrl" character varying,
    status public.course_versions_status_enum NOT NULL,
    "submissionNote" text,
    changes jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "courseId" uuid,
    "changedById" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.email_campaigns (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    subject character varying NOT NULL,
    "previewText" character varying,
    content text,
    "templateId" uuid,
    "segmentIds" text,
    status public.email_campaigns_status_enum DEFAULT 'draft'::public.email_campaigns_status_enum NOT NULL,
    "scheduledAt" timestamp without time zone,
    "sentAt" timestamp without time zone,
    "totalRecipients" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.email_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "campaignId" character varying NOT NULL,
    "recipientId" character varying NOT NULL,
    "eventType" public.email_events_eventtype_enum NOT NULL,
    "workflowId" character varying,
    metadata jsonb,
    "bounceReason" character varying,
    "complaintType" character varying,
    "reputationScore" integer,
    "occurredAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.email_subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    email character varying NOT NULL,
    "userId" character varying,
    "isSubscribed" boolean DEFAULT true NOT NULL,
    preferences text,
    "unsubscribedAt" timestamp without time zone,
    "unsubscribeReason" character varying,
    "subscribedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.email_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    subject character varying NOT NULL,
    "htmlContent" text NOT NULL,
    "textContent" text,
    category character varying,
    variables text,
    "thumbnailUrl" character varying,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.enrollment (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    user_id character varying NOT NULL,
    course_id character varying NOT NULL,
    progress double precision DEFAULT '0'::double precision NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    "enrolledAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastAccessedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone,
    "userId" uuid,
    "courseId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.experiment_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    type public.experiment_metrics_type_enum DEFAULT 'conversion'::public.experiment_metrics_type_enum NOT NULL,
    configuration json,
    "isPrimary" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "experimentId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.experiment_variants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    configuration json NOT NULL,
    "trafficAllocation" numeric(5,4) DEFAULT '0'::numeric NOT NULL,
    "isControl" boolean DEFAULT false NOT NULL,
    "isWinner" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone,
    "experimentId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.experiments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    type public.experiments_type_enum DEFAULT 'a_b_test'::public.experiments_type_enum NOT NULL,
    status public.experiments_status_enum DEFAULT 'draft'::public.experiments_status_enum NOT NULL,
    "startDate" timestamp without time zone NOT NULL,
    "endDate" timestamp without time zone,
    "trafficAllocation" numeric(5,4) DEFAULT '1'::numeric NOT NULL,
    "autoAllocateTraffic" boolean DEFAULT false NOT NULL,
    "confidenceLevel" integer DEFAULT 95 NOT NULL,
    "minimumSampleSize" integer DEFAULT 80 NOT NULL,
    hypothesis text,
    "targetingCriteria" json,
    "exclusionCriteria" json,
    properties json,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.forum_comments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "threadId" uuid NOT NULL,
    "parentId" character varying,
    content text NOT NULL,
    "authorId" character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.forum_threads (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    "authorId" character varying NOT NULL,
    status character varying DEFAULT 'active'::character varying NOT NULL,
    upvotes integer DEFAULT 0 NOT NULL,
    downvotes integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.forum_votes (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "entityType" character varying NOT NULL,
    "entityId" character varying NOT NULL,
    "authorId" character varying NOT NULL,
    value integer NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.incidents (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    status public.incidents_status_enum DEFAULT 'detected'::public.incidents_status_enum NOT NULL,
    severity public.incidents_severity_enum NOT NULL,
    "triggerMetrics" jsonb,
    "runbookId" character varying,
    "remediationActionIds" text,
    "escalatedTo" character varying,
    "resolvedAt" timestamp without time zone,
    "resolutionNotes" text,
    "detectedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.instructor_payout_profiles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instructor_id uuid NOT NULL,
    "payoutSchedule" character varying DEFAULT 'monthly'::character varying NOT NULL,
    "payoutMethod" character varying DEFAULT 'paypal'::character varying NOT NULL,
    "payoutDetails" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.instructor_payouts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    instructor_id uuid NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    status public.instructor_payouts_status_enum DEFAULT 'pending'::public.instructor_payouts_status_enum NOT NULL,
    "payoutMethod" character varying DEFAULT 'paypal'::character varying NOT NULL,
    "payoutDetails" character varying,
    "payoutDate" timestamp without time zone,
    "failureReason" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.invoices (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "invoiceNumber" character varying NOT NULL,
    amount numeric(10,2) NOT NULL,
    "taxAmount" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "totalAmount" numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    items jsonb NOT NULL,
    status public.invoices_status_enum DEFAULT 'pending'::public.invoices_status_enum NOT NULL,
    "issuedDate" timestamp without time zone NOT NULL,
    "fileUrl" character varying,
    payment_id uuid NOT NULL,
    user_id uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.lessons (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    video_url character varying(2048),
    "order" integer DEFAULT 0 NOT NULL,
    duration_seconds integer DEFAULT 0 NOT NULL,
    module_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT "CHK_9fceacf251b7152e9063994087" CHECK (("order" >= 0)),
    CONSTRAINT "CHK_d54a8f9cfd22126d59f534d0d5" CHECK ((duration_seconds >= 0))
)
    `);
    await queryRunner.query(`CREATE TABLE public.moderation_event (
    id integer NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    score double precision NOT NULL,
    status character varying NOT NULL,
    "timestamp" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE SEQUENCE public.moderation_event_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
    `);
    await queryRunner.query(`ALTER SEQUENCE public.moderation_event_id_seq OWNED BY public.moderation_event.id
    `);
    await queryRunner.query(`CREATE TABLE public.notification_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "userId" uuid NOT NULL,
    "emailEnabled" boolean DEFAULT true NOT NULL,
    "pushEnabled" boolean DEFAULT true NOT NULL,
    "inAppEnabled" boolean DEFAULT true NOT NULL,
    "smsEnabled" boolean DEFAULT false NOT NULL,
    "topicSubscriptions" jsonb,
    "eventFrequency" jsonb,
    "globalUnsubscribe" boolean DEFAULT false NOT NULL,
    "quietTimeStart" character varying DEFAULT '09:00'::character varying NOT NULL,
    "quietTimeEnd" character varying DEFAULT '21:00'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.notification_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    "templateVersion" integer DEFAULT 1 NOT NULL,
    channel public.notification_templates_channel_enum DEFAULT 'email'::public.notification_templates_channel_enum NOT NULL,
    "subjectTemplate" character varying,
    "bodyTemplate" text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.notifications (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "userId" uuid NOT NULL,
    title character varying NOT NULL,
    content text NOT NULL,
    content_hash character varying(64) NOT NULL,
    type public.notifications_type_enum DEFAULT 'in_app'::public.notifications_type_enum NOT NULL,
    status public.notifications_status_enum DEFAULT 'pending'::public.notifications_status_enum NOT NULL,
    priority public.notifications_priority_enum DEFAULT 'medium'::public.notifications_priority_enum NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "deliveryAttempts" integer DEFAULT 0 NOT NULL,
    "lastAttemptAt" timestamp without time zone,
    "failureReason" text,
    "readAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.onboarding_rewards (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text NOT NULL,
    type public.onboarding_rewards_type_enum NOT NULL,
    "pointsValue" integer DEFAULT 0 NOT NULL,
    "badgeId" character varying,
    "couponCode" character varying,
    metadata jsonb,
    "requiredSteps" integer DEFAULT 0 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.onboarding_steps (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    slug character varying NOT NULL,
    title character varying NOT NULL,
    description text NOT NULL,
    type public.onboarding_steps_type_enum NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    content jsonb,
    status public.onboarding_steps_status_enum DEFAULT 'active'::public.onboarding_steps_status_enum NOT NULL,
    "rewardPoints" integer DEFAULT 0 NOT NULL,
    "rewardBadgeId" character varying,
    "isRequired" boolean DEFAULT false NOT NULL,
    "estimatedDurationMinutes" integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.payment_methods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    method public.payment_methods_method_enum NOT NULL,
    provider character varying,
    "displayName" character varying(64),
    last4 character varying(4),
    "expiryMonth" integer,
    "expiryYear" integer,
    "isDefault" boolean DEFAULT false NOT NULL,
    metadata jsonb,
    "userId" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone,
    user_id uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    status public.payments_status_enum DEFAULT 'pending'::public.payments_status_enum NOT NULL,
    method public.payments_method_enum NOT NULL,
    provider character varying,
    "providerPaymentId" character varying,
    metadata jsonb,
    user_id uuid NOT NULL,
    course_id uuid,
    "idempotencyKey" character varying,
    "isSubscription" boolean DEFAULT false NOT NULL,
    "subscriptionId" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.permissions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    resource character varying NOT NULL,
    action character varying NOT NULL,
    description character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.point_transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    points integer NOT NULL,
    "activityType" character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.question (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    type public.question_type_enum NOT NULL,
    prompt character varying NOT NULL,
    options json,
    "correctAnswer" json,
    points integer DEFAULT 1 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone,
    "assessmentId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.quota_definitions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    tier public.quota_definitions_tier_enum,
    "userId" character varying,
    "requestsPerMinute" integer NOT NULL,
    "requestsPerHour" integer NOT NULL,
    "requestsPerDay" integer NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.recovery_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    backup_record_id uuid NOT NULL,
    status public.recovery_tests_status_enum DEFAULT 'pending'::public.recovery_tests_status_enum NOT NULL,
    "testDatabaseName" character varying NOT NULL,
    "validationResults" json,
    "performanceMetrics" json,
    "errorMessage" character varying,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "testCompletedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.refunds (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    amount numeric(10,2),
    reason text,
    "refundMethod" character varying,
    status public.refunds_status_enum DEFAULT 'pending'::public.refunds_status_enum NOT NULL,
    "providerRefundId" character varying,
    "idempotencyKey" character varying,
    metadata jsonb,
    payment_id uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.remediation_actions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "incidentId" uuid NOT NULL,
    "actionType" character varying NOT NULL,
    description text NOT NULL,
    status public.remediation_actions_status_enum DEFAULT 'queued'::public.remediation_actions_status_enum NOT NULL,
    parameters jsonb,
    "executedAt" timestamp without time zone,
    "executionOutput" text,
    "errorMessage" text,
    "autoRollback" boolean DEFAULT false NOT NULL,
    "rolledBackAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.review_item (
    id integer NOT NULL,
    version integer NOT NULL,
    content text NOT NULL,
    "safetyScore" double precision NOT NULL,
    "sourceType" character varying,
    "sourceId" character varying,
    "reportId" character varying,
    status character varying DEFAULT 'pending'::character varying NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE SEQUENCE public.review_item_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
    `);
    await queryRunner.query(`ALTER SEQUENCE public.review_item_id_seq OWNED BY public.review_item.id
    `);
    await queryRunner.query(`CREATE TABLE public.roles (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    description text,
    "isSystem" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.roles_permissions_permissions (
    "rolesId" uuid NOT NULL,
    "permissionsId" uuid NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.runbook_executions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "incidentId" uuid NOT NULL,
    "runbookName" character varying NOT NULL,
    "runbookPath" text NOT NULL,
    status public.runbook_executions_status_enum DEFAULT 'scheduled'::public.runbook_executions_status_enum NOT NULL,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "stepExecutions" jsonb,
    "executionSummary" text,
    "errorDetails" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.segment_destination_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name character varying NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    settings jsonb DEFAULT '{}'::jsonb NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.segment_rules (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "segmentId" uuid NOT NULL,
    field public.segment_rules_field_enum NOT NULL,
    operator public.segment_rules_operator_enum NOT NULL,
    value jsonb NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    "logicalOperator" character varying DEFAULT 'AND'::character varying NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.segments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    name character varying NOT NULL,
    description text,
    "isDynamic" boolean DEFAULT true NOT NULL,
    "staticMemberIds" text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "providerSubscriptionId" character varying,
    status public.subscriptions_status_enum DEFAULT 'active'::public.subscriptions_status_enum NOT NULL,
    "interval" public.subscriptions_interval_enum NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying NOT NULL,
    "currentPeriodStart" timestamp without time zone,
    "currentPeriodEnd" timestamp without time zone,
    "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL,
    "cancelledAt" timestamp without time zone,
    "trialStart" timestamp without time zone,
    "trialEnd" timestamp without time zone,
    properties jsonb,
    user_id uuid NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.tenant_billing (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "tenantId" uuid NOT NULL,
    "billingCycle" public.tenant_billing_billingcycle_enum DEFAULT 'monthly'::public.tenant_billing_billingcycle_enum NOT NULL,
    "monthlyFee" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "currentBalance" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "totalPaid" numeric(10,2) DEFAULT '0'::numeric NOT NULL,
    "lastBillingDate" timestamp without time zone,
    "nextBillingDate" timestamp without time zone,
    "stripeCustomerId" character varying,
    "stripeSubscriptionId" character varying,
    "usageMetrics" jsonb,
    "billingHistory" jsonb,
    "autoRenew" boolean DEFAULT true NOT NULL,
    "paymentMethod" character varying,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.tenant_configs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "tenantId" uuid NOT NULL,
    "defaultLanguage" character varying DEFAULT 'en'::character varying NOT NULL,
    timezone character varying DEFAULT 'UTC'::character varying NOT NULL,
    currency character varying DEFAULT 'USD'::character varying NOT NULL,
    features jsonb,
    notifications jsonb,
    security jsonb,
    integrations jsonb,
    "customSettings" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.tenant_customizations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "tenantId" uuid NOT NULL,
    "logoUrl" character varying,
    "faviconUrl" character varying,
    "primaryColor" character varying,
    "secondaryColor" character varying,
    "accentColor" character varying,
    "fontFamily" character varying,
    theme jsonb,
    "customCss" text,
    "customJs" text,
    "emailTemplates" jsonb,
    "landingPageConfig" jsonb,
    "customDomain" character varying,
    "customDomainVerified" boolean DEFAULT false NOT NULL,
    "domainVerificationToken" character varying,
    "socialLinks" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.tenant_usage_snapshots (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "tenantId" character varying NOT NULL,
    period character varying NOT NULL,
    "userCount" integer DEFAULT 0 NOT NULL,
    "storageUsedMb" integer DEFAULT 0 NOT NULL,
    "apiCallCount" integer DEFAULT 0 NOT NULL,
    "snapshotAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.tenants (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    slug character varying NOT NULL,
    name character varying NOT NULL,
    description character varying,
    domain character varying,
    status public.tenants_status_enum DEFAULT 'trial'::public.tenants_status_enum NOT NULL,
    plan public.tenants_plan_enum DEFAULT 'free'::public.tenants_plan_enum NOT NULL,
    "ownerId" character varying,
    "ownerEmail" character varying,
    "contactEmail" character varying,
    "contactPhone" character varying,
    metadata jsonb,
    "userLimit" integer DEFAULT 0 NOT NULL,
    "storageLimit" integer DEFAULT 0 NOT NULL,
    "currentUserCount" integer DEFAULT 0 NOT NULL,
    "currentStorageUsage" integer DEFAULT 0 NOT NULL,
    "trialEndsAt" timestamp without time zone,
    "subscriptionStartsAt" timestamp without time zone,
    "subscriptionEndsAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.translations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    namespace character varying NOT NULL,
    key character varying NOT NULL,
    locale character varying NOT NULL,
    value text NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.unsubscribe_tokens (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    token character varying NOT NULL,
    email character varying NOT NULL,
    "userId" character varying,
    "emailType" character varying,
    used boolean DEFAULT false NOT NULL,
    "expiresAt" timestamp without time zone NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_achievements (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "unlockedAt" timestamp without time zone NOT NULL,
    "unlockedMetadata" jsonb,
    "pointsEarned" integer DEFAULT 0 NOT NULL,
    "experienceEarned" integer DEFAULT 0 NOT NULL,
    "notificationSent" boolean DEFAULT false NOT NULL,
    "isHidden" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "achievementId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_badges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    "earnedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_challenges (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "progressValue" integer DEFAULT 0 NOT NULL,
    "isCompleted" boolean DEFAULT false NOT NULL,
    "completedAt" timestamp without time zone,
    "userId" uuid,
    "challengeId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_onboarding_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    user_id character varying NOT NULL,
    step_id character varying NOT NULL,
    status public.user_onboarding_progress_status_enum DEFAULT 'not_started'::public.user_onboarding_progress_status_enum NOT NULL,
    "progressPercentage" double precision DEFAULT '0'::double precision NOT NULL,
    "startedAt" timestamp without time zone,
    "completedAt" timestamp without time zone,
    "skippedAt" timestamp without time zone,
    "timeSpentSeconds" integer DEFAULT 0 NOT NULL,
    metadata jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "userId" uuid,
    "stepId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_preferences (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" uuid NOT NULL,
    theme public.user_preferences_theme_enum DEFAULT 'system'::public.user_preferences_theme_enum NOT NULL,
    language public.user_preferences_language_enum DEFAULT 'en'::public.user_preferences_language_enum NOT NULL,
    "emailNotifications" boolean DEFAULT true NOT NULL,
    "pushNotifications" boolean DEFAULT true NOT NULL,
    "inAppNotifications" boolean DEFAULT true NOT NULL,
    "marketingEmails" boolean DEFAULT false NOT NULL,
    "courseUpdates" boolean DEFAULT true NOT NULL,
    "weeklyDigest" boolean DEFAULT true NOT NULL,
    "customSettings" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_progress (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    "totalPoints" integer DEFAULT 0 NOT NULL,
    level integer DEFAULT 1 NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    "userId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.user_quota_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    "userId" character varying NOT NULL,
    tier public.user_quota_usage_tier_enum DEFAULT 'FREE'::public.user_quota_usage_tier_enum NOT NULL,
    period character varying NOT NULL,
    count integer DEFAULT 0 NOT NULL,
    "windowStart" timestamp without time zone NOT NULL,
    "windowEnd" timestamp without time zone NOT NULL,
    "isBlocked" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    email character varying NOT NULL,
    username character varying,
    password character varying,
    provider character varying,
    "providerId" character varying,
    "providerAccessToken" character varying,
    "providerRefreshToken" character varying,
    "firstName" character varying NOT NULL,
    "lastName" character varying NOT NULL,
    status public.users_status_enum DEFAULT 'active'::public.users_status_enum NOT NULL,
    "tenantId" character varying,
    "profilePicture" character varying,
    "isEmailVerified" boolean DEFAULT false NOT NULL,
    "emailVerificationToken" character varying,
    "emailVerificationExpires" timestamp without time zone,
    "passwordResetToken" character varying,
    "passwordResetExpires" timestamp without time zone,
    "refreshToken" character varying,
    "passwordHistory" text[] DEFAULT '{}'::text[] NOT NULL,
    "lastLoginAt" timestamp without time zone,
    "isMfaEnabled" boolean DEFAULT false NOT NULL,
    "totpSecret" text,
    "mfaRecoveryCodes" text[] DEFAULT '{}'::text[] NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "deletedAt" timestamp without time zone
)
    `);
    await queryRunner.query(`CREATE TABLE public.users_roles_roles (
    "usersId" uuid NOT NULL,
    "rolesId" uuid NOT NULL
)
    `);
    await queryRunner.query(`CREATE TABLE public.variant_metrics (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    value numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    "sampleSize" integer DEFAULT 0 NOT NULL,
    "conversionRate" numeric(10,4),
    "standardDeviation" numeric(10,4),
    "confidenceIntervalLower" numeric(10,4),
    "confidenceIntervalUpper" numeric(10,4),
    "pValue" numeric(10,4),
    "isStatisticallySignificant" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "variantId" uuid
)
    `);
    await queryRunner.query(`CREATE TABLE public.webhook_retries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    version integer NOT NULL,
    provider public.webhook_retries_provider_enum NOT NULL,
    "externalEventId" character varying NOT NULL,
    status public.webhook_retries_status_enum DEFAULT 'pending'::public.webhook_retries_status_enum NOT NULL,
    payload jsonb,
    signature text,
    "retryCount" integer DEFAULT 0 NOT NULL,
    "maxRetries" integer DEFAULT 3 NOT NULL,
    "nextRetryTime" timestamp without time zone,
    "lastError" text,
    "errorDetails" jsonb,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    "processedAt" timestamp without time zone,
    headers jsonb
)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.moderation_event ALTER COLUMN id SET DEFAULT nextval('public.moderation_event_id_seq'::regclass)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.review_item ALTER COLUMN id SET DEFAULT nextval('public.review_item_id_seq'::regclass)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_templates
    ADD CONSTRAINT "PK_06c564c515d8cdb40b6f3bfbbb4" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.recovery_tests
    ADD CONSTRAINT "PK_086105f93f0a3431d57265371b3" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT "PK_0ca139216824d745a930065706a" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.backup_records
    ADD CONSTRAINT "PK_13c40e36547fe8bc4903891715b" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.ab_test_variants
    ADD CONSTRAINT "PK_1852d233f32a6c278d1c12591a4" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiment_variants
    ADD CONSTRAINT "PK_1ab87aafc77c9f29445722fcdd8" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.quota_definitions
    ADD CONSTRAINT "PK_1b54df16f86533774dcbdab23c9" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT "PK_1bc19c37c6249f70186f318d71d" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT "PK_1c6a5d4a235dbc8b2a6b4342938" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.forum_comments
    ADD CONSTRAINT "PK_1c860feac1713d199c00ce1e9d1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT "PK_1e664e93171e20fe4d6125466af" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.question
    ADD CONSTRAINT "PK_21e5786aa0ea704ae185a79b2d5" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_events
    ADD CONSTRAINT "PK_2ab38c98c3ca9385eff428134c2" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT "PK_2dc117d5b688a2040125a09d1f1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT "PK_30d346f6af084aa7b916945a4f1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT "PK_34f9b8c6dfb4ac3559f7e2820d1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT "PK_38ce39ab347624dee46e0d11e95" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_billing
    ADD CONSTRAINT "PK_3adf5b4ad55795a97a1c8d122b2" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT "PK_3d94aba7e9ed55365f68b5e77fa" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT "PK_48578f5993178c101adf54458d7" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_comments
    ADD CONSTRAINT "PK_509181b7a136bfd36ceadb4327c" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "PK_5106efb01eeda7e49a78b869738" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.segment_destination_configs
    ADD CONSTRAINT "PK_5302ab1192e7887b615a56c01cd" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "PK_53be67a04681c66b87ee27c9321" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_metadata
    ADD CONSTRAINT "PK_54d3611149cd0967d26687a0f5e" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.moderation_event
    ADD CONSTRAINT "PK_58724d91318a54243203d035ac1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_customizations
    ADD CONSTRAINT "PK_5c5cbe00df045c9d65b8dbf934d" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT "PK_5d643d67a09b55653e98616f421" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.instructor_payout_profiles
    ADD CONSTRAINT "PK_601f21b309c899b981ce2bd225c" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_assignments
    ADD CONSTRAINT "PK_6244076d7882c63bca9240b9d09" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT "PK_6407e80f75bae845a54c6a43a32" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.achievement_statistics
    ADD CONSTRAINT "PK_64890e6c50faf8c4fbf539ac6e8" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "PK_668cef7c22a427fd822cc1be3ce" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.instructor_payouts
    ADD CONSTRAINT "PK_6abdfa69192c194b9e793e50d88" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.users_roles_roles
    ADD CONSTRAINT "PK_6c1a055682c229f5a865f2080c1" PRIMARY KEY ("usersId", "rolesId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT "PK_6c59a68146cdde8de564ee649c1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT "PK_72bad329795785308e66d562350" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT "PK_76f0fc48b8d057d2ae7f3a2848a" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.segment_rules
    ADD CONSTRAINT "PK_7b56809897e557776b43c0b4ecd" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT "PK_7b5eb2436efb0051fdf05cbe839" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_challenges
    ADD CONSTRAINT "PK_7c111333fc0e3a23528503498de" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.automation_actions
    ADD CONSTRAINT "PK_7d56180c080e74cb362d0db9dee" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.remediation_actions
    ADD CONSTRAINT "PK_7e1dec69a65387daab5794eed7d" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.enrollment
    ADD CONSTRAINT "PK_7e200c699fa93865cdcdd025885" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_threads
    ADD CONSTRAINT "PK_7ecfc73fb36e6339f64cd3ee982" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT "PK_8932d378eb87a6b613241dacc4c" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.ab_tests
    ADD CONSTRAINT "PK_897aac79b4b31d3d500c15a6810" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.badges
    ADD CONSTRAINT "PK_8a651318b8de577e8e217676466" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.runbook_executions
    ADD CONSTRAINT "PK_8f4b3993172cbd65648ff8294c1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.achievement_progress
    ADD CONSTRAINT "PK_901cc379a8dbe909f3d617c0da1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.review_item
    ADD CONSTRAINT "PK_91cdf1e8bef5fd3c1c8352e1873" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.answer
    ADD CONSTRAINT "PK_9232db17b63fb1e94f97e5c224f" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.unsubscribe_tokens
    ADD CONSTRAINT "PK_9622754f6a1b81e3f361abb6287" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.webhook_retries
    ADD CONSTRAINT "PK_9b89e71d6573afc3f1441ed734e" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_module
    ADD CONSTRAINT "PK_9d04c56010223c5997cc71093b4" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT "PK_aa1c75812d27f2d79ba3306d0c1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT "PK_aafe1321d916fac58ba06ad8178" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.translations
    ADD CONSTRAINT "PK_aca248c72ae1fb2390f1bf4cd87" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.assessment_attempt
    ADD CONSTRAINT "PK_aca670ae50c57355f5cfbf57064" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.roles_permissions_permissions
    ADD CONSTRAINT "PK_b2f4e3f7fbeb7e5b495dd819842" PRIMARY KEY ("rolesId", "permissionsId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.automation_workflows
    ADD CONSTRAINT "PK_b8ccdbd937062e34ce781e47fab" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.segments
    ADD CONSTRAINT "PK_beff1eec19679fe8ad4f291f04e" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course
    ADD CONSTRAINT "PK_bf95180dd756fd204fb01ce4916" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.assessment
    ADD CONSTRAINT "PK_c511a7dc128256876b6b1719401" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.onboarding_rewards
    ADD CONSTRAINT "PK_c7c9a7640c58e58bdeb54bcc780" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.archived_data
    ADD CONSTRAINT "PK_c82de7ef69aa6e4a10c8789d409" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_versions
    ADD CONSTRAINT "PK_cc9e77578136a62e599f33d15ff" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT "PK_ceb5185b63f070e23d65509b0a7" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_members
    ADD CONSTRAINT "PK_d0caa8ae723dba3e41fe36a4faf" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT "PK_d7cbc8d9a41ce2b2cadd6f08929" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_usage_snapshots
    ADD CONSTRAINT "PK_e1a2a6d3b678a6fac4631c4d4ba" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.variant_metrics
    ADD CONSTRAINT "PK_e33bbdb963d8b135607a6508ae1" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_subscriptions
    ADD CONSTRAINT "PK_e60e3a09d341892b331d0e14e98" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT "PK_e8cfb5b31af61cd363a6b6d7c25" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "PK_e94e2b543f2f218ee68e4f4fad2" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_quota_usage
    ADD CONSTRAINT "PK_f5a9e8470a155d6b43d187a4313" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohorts
    ADD CONSTRAINT "PK_fd38f76b135e907b834fda1e752" PRIMARY KEY (id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT "REL_b5d0e1b57bc6c761fb49e79bf8" UNIQUE ("userId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT "REL_b6202d1cacc63a0b9c8dac2abd" UNIQUE ("userId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "REL_b70c44e8b00757584a39322559" UNIQUE ("userId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.ab_tests
    ADD CONSTRAINT "REL_d59c4bf6cb19f01d0438973463" UNIQUE ("campaignId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "UQ_1b692560d438e5fc6edebbb27dd" UNIQUE ("idempotencyKey")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT "UQ_2310ecc5cb8be427097154b18fc" UNIQUE (slug)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.onboarding_steps
    ADD CONSTRAINT "UQ_238b7a7accc697f9dc38bb2fa6e" UNIQUE (slug)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "UQ_2eeb6283285e7ffc0afed6606a7" UNIQUE ("providerSubscriptionId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_customizations
    ADD CONSTRAINT "UQ_31864fcad0db05f8624f8bc3b8e" UNIQUE ("customDomain")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.unsubscribe_tokens
    ADD CONSTRAINT "UQ_423597e129f4f9402c976acce2a" UNIQUE (token)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.forum_votes
    ADD CONSTRAINT "UQ_61ca502616bea958499dbb1c7f6" UNIQUE ("entityType", "entityId", "authorId")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.roles
    ADD CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE (name)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "UQ_743b9fb1d2a059f2f7860418e4e" UNIQUE ("idempotencyKey")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.segment_destination_configs
    ADD CONSTRAINT "UQ_7e12359558f5263f9215c36ea65" UNIQUE (name)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT "UQ_89456a09b598ce8915c702c5283" UNIQUE (resource)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_subscriptions
    ADD CONSTRAINT "UQ_8e8eebc384627fb6fa7fd3993fd" UNIQUE (email)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.users
    ADD CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE (email)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.badges
    ADD CONSTRAINT "UQ_9c91fc9c4a4ae01712baad1e9f6" UNIQUE (name)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.translations
    ADD CONSTRAINT "UQ_a0bfd1bdc0bb9fd2a2093028ea5" UNIQUE (namespace, key, locale)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "UQ_bf8e0f9dd4558ef209ec111782d" UNIQUE ("invoiceNumber")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiments
    ADD CONSTRAINT "UQ_c697ebe6ea1b865670e8bf253bf" UNIQUE (name)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.instructor_payout_profiles
    ADD CONSTRAINT "UQ_e0a5c10dfd4a71af0f150204e98" UNIQUE (instructor_id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_metadata
    ADD CONSTRAINT "UQ_e352b4f29ef956f97c5577c948b" UNIQUE (content_id)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_044801224a107532ec72863c77" ON public.notification_templates USING btree (name, "templateVersion", channel)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_201b6e34825dc5bd06181320bd" ON public.user_badges USING btree (user_id, badge_id)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5d0d509445abda22b52a7646d8" ON public.user_onboarding_progress USING btree (user_id, step_id)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_7dcd253a269d9c7809feda085d" ON public.achievement_progress USING btree ("userId", "achievementId")
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8e8eebc384627fb6fa7fd3993f" ON public.email_subscriptions USING btree (email)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_a34a641b43a91c958b94a26bcf" ON public.webhook_retries USING btree (provider, "externalEventId")
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_b6202d1cacc63a0b9c8dac2abd" ON public.user_preferences USING btree ("userId")
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_c1acd69cf91b1e353634c152dd" ON public.user_achievements USING btree ("userId", "achievementId")
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e352b4f29ef956f97c5577c948" ON public.content_metadata USING btree (content_id)
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e865d6f59667897a7fb67ff69a" ON public.user_quota_usage USING btree ("userId", period)
    `);
    await queryRunner.query(`CREATE INDEX idx_notifications_dedup ON public.notifications USING btree ("userId", type, content_hash, "createdAt")
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_02781c49b25ceb502571f0315f6" FOREIGN KEY (payment_id) REFERENCES public.payments(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.remediation_actions
    ADD CONSTRAINT "FK_1373fc6f0bbd68c756ef8c75ca5" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_assignments
    ADD CONSTRAINT "FK_16a0f89062ed4edd4cce26cc5e6" FOREIGN KEY ("cohortId") REFERENCES public.cohorts(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.achievement_progress
    ADD CONSTRAINT "FK_20adca3c4217744bfd8a485e98d" FOREIGN KEY ("achievementId") REFERENCES public.achievements(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT "FK_26daf5e433d6fb88ee32ce93637" FOREIGN KEY (user_id) REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT "FK_2e14b15c1658e0b78a86df473d9" FOREIGN KEY ("courseId") REFERENCES public.course(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course
    ADD CONSTRAINT "FK_32d94af473bb59d808d9a68e17b" FOREIGN KEY ("instructorId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.lessons
    ADD CONSTRAINT "FK_35fb2307535d90a6ed290af1f4a" FOREIGN KEY (module_id) REFERENCES public.course_module(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT "FK_3ac6bc9da3e8a56f3f7082012dd" FOREIGN KEY ("userId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_threads
    ADD CONSTRAINT "FK_3d8ef5f5715cb3d50315007aee5" FOREIGN KEY ("cohortId") REFERENCES public.cohorts(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.campaign_recipients
    ADD CONSTRAINT "FK_3e9c3dcf81739170d74e9265e1b" FOREIGN KEY ("campaignId") REFERENCES public.email_campaigns(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiment_metrics
    ADD CONSTRAINT "FK_40cda44d91beb827b9f4bfb2840" FOREIGN KEY ("experimentId") REFERENCES public.experiments(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "FK_427785468fb7d2733f59e7d7d39" FOREIGN KEY (user_id) REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_customizations
    ADD CONSTRAINT "FK_42bbd07a91fea7e34f175b19fea" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT "FK_557e0c8c5a7a1a449723de76822" FOREIGN KEY ("userId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.automation_actions
    ADD CONSTRAINT "FK_5a953fa7c5b5b963b27e5c47449" FOREIGN KEY ("workflowId") REFERENCES public.automation_workflows(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_challenges
    ADD CONSTRAINT "FK_640161d2f02abec6529e6f04104" FOREIGN KEY ("challengeId") REFERENCES public.challenges(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.recovery_tests
    ADD CONSTRAINT "FK_66893187eeb7c3198e3d07c5950" FOREIGN KEY (backup_record_id) REFERENCES public.backup_records(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT "FK_692a909ee0fa9383e7859f9b406" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT "FK_6a5a5816f54d0044ba5f3dc2b74" FOREIGN KEY ("achievementId") REFERENCES public.achievements(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.segment_rules
    ADD CONSTRAINT "FK_6bf07ed351de4f3a7fba1a4b41e" FOREIGN KEY ("segmentId") REFERENCES public.segments(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT "FK_715b81e610ab276ff6603cfc8e8" FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT "FK_76bf58bc457c1b7cbb471e98a59" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_versions
    ADD CONSTRAINT "FK_7a6c6e6402470c0448c890c1109" FOREIGN KEY ("changedById") REFERENCES public.users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT "FK_7f48aa5d56c42aeb495db016683" FOREIGN KEY (payment_id) REFERENCES public.payments(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.variant_metrics
    ADD CONSTRAINT "FK_87a6c14cf9314c8d5c1b659c42e" FOREIGN KEY ("variantId") REFERENCES public.experiment_variants(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.instructor_payouts
    ADD CONSTRAINT "FK_8dacda0f101c97b73304ddf0fc4" FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.achievement_progress
    ADD CONSTRAINT "FK_93f082fa43fdce4811582a4e3cd" FOREIGN KEY ("userId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course
    ADD CONSTRAINT "FK_9678cf7b818267a347774678be7" FOREIGN KEY (prerequisite_course_id) REFERENCES public.course(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT "FK_99485b9a6ac529679aacf397a98" FOREIGN KEY ("assignedModeratorId") REFERENCES public.users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.ab_test_variants
    ADD CONSTRAINT "FK_a2b9c64f3a34d35742e4168e852" FOREIGN KEY ("abTestId") REFERENCES public.ab_tests(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.answer
    ADD CONSTRAINT "FK_a4013f10cd6924793fbd5f0d637" FOREIGN KEY ("questionId") REFERENCES public.question(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.experiment_variants
    ADD CONSTRAINT "FK_a5408d0f8f271922f7aadd01d24" FOREIGN KEY ("experimentId") REFERENCES public.experiments(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.email_campaigns
    ADD CONSTRAINT "FK_ac1a8d28ac7e2f7aff92b573183" FOREIGN KEY ("templateId") REFERENCES public.email_templates(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_versions
    ADD CONSTRAINT "FK_afedc5469f7b236608580a4fe94" FOREIGN KEY ("courseId") REFERENCES public.course(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.users_roles_roles
    ADD CONSTRAINT "FK_b2f0366aa9349789527e0c36d97" FOREIGN KEY ("rolesId") REFERENCES public.roles(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_challenges
    ADD CONSTRAINT "FK_b5566f854f08d7c88e6ebc71eb1" FOREIGN KEY ("userId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT "FK_b5d0e1b57bc6c761fb49e79bf89" FOREIGN KEY ("userId") REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_preferences
    ADD CONSTRAINT "FK_b6202d1cacc63a0b9c8dac2abd4" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT "FK_b70c44e8b00757584a393225593" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_comments
    ADD CONSTRAINT "FK_ba56e0a5617605dcc62cb33f117" FOREIGN KEY ("threadId") REFERENCES public.cohort_threads(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_reviews
    ADD CONSTRAINT "FK_bd91d18bd636b093927b337c240" FOREIGN KEY ("reviewerId") REFERENCES public.users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.assessment_attempt
    ADD CONSTRAINT "FK_be7568295d6479a34017ffbe8e0" FOREIGN KEY ("assessmentId") REFERENCES public.assessment(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT "FK_c49704abb1730ae4121d5ac9f5e" FOREIGN KEY (user_id) REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payments
    ADD CONSTRAINT "FK_c5fa169d2de9407d99f2c6e4fab" FOREIGN KEY (course_id) REFERENCES public.course(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.automation_triggers
    ADD CONSTRAINT "FK_cc7bcfed749f38cd30960f124bb" FOREIGN KEY ("workflowId") REFERENCES public.automation_workflows(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.question
    ADD CONSTRAINT "FK_cc93e703bbc40e60a53db016b39" FOREIGN KEY ("assessmentId") REFERENCES public.assessment(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.forum_comments
    ADD CONSTRAINT "FK_cd0efc698e697e6530e704d39e5" FOREIGN KEY ("threadId") REFERENCES public.forum_threads(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT "FK_d0a95ef8a28188364c546eb65c1" FOREIGN KEY (user_id) REFERENCES public.users(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.enrollment
    ADD CONSTRAINT "FK_d1a599a7740b4f4bd1120850f04" FOREIGN KEY ("courseId") REFERENCES public.course(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.runbook_executions
    ADD CONSTRAINT "FK_d4364b5f4c7a2498b9ea0d76a66" FOREIGN KEY ("incidentId") REFERENCES public.incidents(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.ab_tests
    ADD CONSTRAINT "FK_d59c4bf6cb19f01d0438973463c" FOREIGN KEY ("campaignId") REFERENCES public.email_campaigns(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT "FK_d687e5407cb85be0c24463f86ea" FOREIGN KEY ("reporterId") REFERENCES public.users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.payment_methods
    ADD CONSTRAINT "FK_d7d7fb15569674aaadcfbc0428c" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_onboarding_progress
    ADD CONSTRAINT "FK_d89ca46064e19b57da7167efd57" FOREIGN KEY ("stepId") REFERENCES public.onboarding_steps(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.roles_permissions_permissions
    ADD CONSTRAINT "FK_dc2b9d46195bb3ed28abbf7c9e3" FOREIGN KEY ("rolesId") REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.answer
    ADD CONSTRAINT "FK_df3b92aa295640d070922ebc382" FOREIGN KEY ("attemptId") REFERENCES public.assessment_attempt(id)
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.users_roles_roles
    ADD CONSTRAINT "FK_df951a64f09865171d2d7a502b1" FOREIGN KEY ("usersId") REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.cohort_members
    ADD CONSTRAINT "FK_e00ea7965d1ed8c53b3c85a56e9" FOREIGN KEY ("cohortId") REFERENCES public.cohorts(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.instructor_payout_profiles
    ADD CONSTRAINT "FK_e0a5c10dfd4a71af0f150204e98" FOREIGN KEY (instructor_id) REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_billing
    ADD CONSTRAINT "FK_e20f751a4d8faf089b1922eaf53" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.course_module
    ADD CONSTRAINT "FK_e27b3a3cf92fd9b32f152a4f7fc" FOREIGN KEY ("courseId") REFERENCES public.course(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.enrollment
    ADD CONSTRAINT "FK_e97ecbf11356b5173ce7fb0b060" FOREIGN KEY ("userId") REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT "FK_f1221d9b1aaa64b1f3c98ed46d3" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT "FK_f6da62af798600a20370bb2e251" FOREIGN KEY ("reviewerId") REFERENCES public.users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.tenant_configs
    ADD CONSTRAINT "FK_fd467ff7c6435655c8d715f2211" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON DELETE CASCADE
    `);
    await queryRunner.query(`ALTER TABLE ONLY public.roles_permissions_permissions
    ADD CONSTRAINT "FK_fd4d5d4c7f7ff16c57549b72c6f" FOREIGN KEY ("permissionsId") REFERENCES public.permissions(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping the entire baseline schema is handled by `migration:revert`
    // in reverse order; the tables are dropped as their corresponding
    // migrations are reverted.
  }
}
