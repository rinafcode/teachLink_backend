import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReconcileSchemaDrift1796000000001 implements MigrationInterface {
  name = 'ReconcileSchemaDrift1796000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "forum_votes" DROP CONSTRAINT "FK_forum_votes_authorId_users"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "FK_course_bulk_ops_initiator"',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_levels" DROP CONSTRAINT "FK_rubric_levels_criterion"',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_criteria" DROP CONSTRAINT "FK_rubric_criteria_rubric"',
    );
    await queryRunner.query(
      'ALTER TABLE "criterion_grades" DROP CONSTRAINT "FK_criterion_grades_grade"',
    );
    await queryRunner.query(
      'ALTER TABLE "submission_grades" DROP CONSTRAINT "FK_submission_grades_rubric"',
    );
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_entity"');
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_ip_address"');
    await queryRunner.query('DROP INDEX "public"."UQ_forum_votes_entityType_entityId_authorId"');
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" ADD COLUMN IF NOT EXISTS "undone_by_id" uuid',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" ADD COLUMN IF NOT EXISTS "reason" character varying(255)',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" ADD COLUMN IF NOT EXISTS "notes" text',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT \'1\'',
    );
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_action_timestamp"');
    await queryRunner.query(
      'ALTER TYPE "public"."audit_logs_action_enum" RENAME TO "audit_logs_action_enum_old"',
    );
    await queryRunner.query(
      "CREATE TYPE \"public\".\"audit_logs_action_enum\" AS ENUM('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'EMAIL_VERIFIED', 'TOKEN_REFRESH', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED', 'DATA_VIEWED', 'DATA_CREATED', 'DATA_UPDATED', 'DATA_DELETED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'FILE_SHARED', 'API_CALLED', 'API_RATE_LIMITED', 'API_ERROR', 'PERMISSION_DENIED', 'SUSPICIOUS_ACTIVITY', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_FAILED', 'CONFIG_CHANGED', 'SETTING_UPDATED', 'BACKUP_CREATED', 'BACKUP_RESTORED', 'RBAC_ROLE_ASSIGNED', 'RBAC_ROLE_REVOKED', 'RBAC_PERMISSION_GRANTED', 'RBAC_PERMISSION_REVOKED', 'RBAC_ROLE_CREATED', 'RBAC_ROLE_UPDATED', 'RBAC_ROLE_DELETED', 'RBAC_PERMISSION_CREATED', 'RBAC_PERMISSION_UPDATED', 'RBAC_PERMISSION_DELETED', 'DATA_RETENTION_APPLIED', 'AUDIT_LOG_EXPORTED', 'REPORT_GENERATED', 'PAYMENT_RECONCILIATION_MISMATCH')",
    );
    await queryRunner.query(
      'ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_logs_action_enum" USING "action"::"text"::"public"."audit_logs_action_enum"',
    );
    await queryRunner.query('DROP TYPE "public"."audit_logs_action_enum_old"');
    await queryRunner.query('ALTER TABLE "course" DROP COLUMN "searchVector"');
    await queryRunner.query('ALTER TABLE "course" ALTER COLUMN "search_vector" SET NOT NULL');
    await queryRunner.query(
      "INSERT INTO \"typeorm_metadata\"(\"database\", \"schema\", \"table\", \"type\", \"name\", \"value\") SELECT current_database(), 'public', 'course', 'GENERATED_COLUMN', 'search_vector', 'to_tsvector(''english'', coalesce(\"title\", '''') || '' '' || coalesce(\"description\", '''') || '' '' || coalesce(\"category\", ''''))'",
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3dad32ba0ff20feee98b1b0c43" ON "lessons" ("title") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_633a748d9720d4c3c25f0fc120" ON "lessons" ("order") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_35fb2307535d90a6ed290af1f4" ON "lessons" ("module_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d80cf66830a0231b8104893b67" ON "lessons" ("deleted_at") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_65395710ac88af450c5123f030" ON "course_module" ("course_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fc17c7e94154a17e767b7674f1" ON "enrollment" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dd1ce01d1164c8bbdda052ced7" ON "enrollment" ("course_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_46ad51ba4f4bb7db2817d75419" ON "enrollment" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_756e18fc1918b63fb4d79b4db6" ON "enrollment" ("enrolledAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d03f18ea29009de1e37a6d156b" ON "enrollment" ("course_id", "enrolledAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_91e3503740d174a4599e81ad8a" ON "enrollment" ("user_id", "enrolledAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d6e7a6c84587eb7809c5b910f8" ON "enrollment" ("course_id", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c2c4377a3e7773772bf670eb47" ON "enrollment" ("user_id", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_1f69fdcbd7ea5f0e52c3230c00" ON "course_reviews" ("course_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_34cbd320b458b8cf9e0d580304" ON "course_versions" ("course_id") ',
    );
    await queryRunner.query('CREATE INDEX "IDX_ac5edecc1aefa58ed0237a7ee4" ON "course" ("title") ');
    await queryRunner.query(
      'CREATE INDEX "IDX_baccb82c6179dca139f6b8c768" ON "course" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_deca5c9911b3b2100b36106082" ON "course" ("instructor_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_2bd3a6327596cc908d574a8219" ON "course" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_72058429360b0daed61d94fb4f" ON "course" ("instructor_id", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a27a3c9d6a41c0fa0fd1cb3f85" ON "course" ("status", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_da04f89054f39981438894dfe3" ON "permissions" ("createdAt") ',
    );
    await queryRunner.query('CREATE INDEX "IDX_648e3f5447f725579d7d4ffdfb" ON "roles" ("name") ');
    await queryRunner.query(
      'CREATE INDEX "IDX_4d018866397b1e7e78d03b4566" ON "roles" ("createdAt") ',
    );
    await queryRunner.query('CREATE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") ');
    await queryRunner.query(
      'CREATE INDEX "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fab34e0791096b2a0a1bf8bd7f" ON "users" ("providerId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c58f7e88c286e5e3478960a998" ON "users" ("tenantId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_5fb386b7d3d50fd5657ef76c3d" ON "audit_logs" ("retention_until") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_ip_address" ON "audit_logs" ("ip_address", "timestamp") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "timestamp") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_action_timestamp" ON "audit_logs" ("action", "timestamp") ',
    );
    await queryRunner.query('CREATE INDEX "IDX_2310ecc5cb8be427097154b18f" ON "tenants" ("slug") ');
    await queryRunner.query(
      'CREATE INDEX "IDX_cfd29d0da332d5c46d9b073863" ON "tenant_usage_snapshots" ("tenantId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_616c8b49254550dbee7f917f3a" ON "tenant_usage_snapshots" ("tenantId", "period") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_42bbd07a91fea7e34f175b19fe" ON "tenant_customizations" ("tenantId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fd467ff7c6435655c8d715f221" ON "tenant_configs" ("tenantId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e20f751a4d8faf089b1922eaf5" ON "tenant_billing" ("tenantId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dfc023bb093b1afcbc91798837" ON "user_quota_usage" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_69752e0d44a35a0dce9d9f06d0" ON "quota_definitions" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_8d5af5c5dbdc0d91ce1178a004" ON "quota_definitions" ("tier", "isActive") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_6ccf973355b70645eff37774de" ON "subscriptions" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d0a95ef8a28188364c546eb65c" ON "subscriptions" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_1a15756e257e0eaf01edc85645" ON "subscriptions" ("user_id", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_32b41cdb985a296213e9a928b5" ON "payments" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_427785468fb7d2733f59e7d7d3" ON "payments" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c5fa169d2de9407d99f2c6e4fa" ON "payments" ("course_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_743b9fb1d2a059f2f7860418e4" ON "payments" ("idempotencyKey") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c2a89b63635ae2b4cc76f17a08" ON "payments" ("user_id", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_1b692560d438e5fc6edebbb27d" ON "refunds" ("idempotencyKey") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_8dacda0f101c97b73304ddf0fc" ON "instructor_payouts" ("instructor_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_7684def1bb4135f494082b34ee" ON "instructor_payouts" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e0a5c10dfd4a71af0f150204e9" ON "instructor_payout_profiles" ("instructor_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_580f1dbf7bceb9c2cde8baf7ff" ON "payment_methods" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fcd49f4739a516d59675b8134e" ON "payment_methods" ("userId", "isDefault") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_bf8e0f9dd4558ef209ec111782" ON "invoices" ("invoiceNumber") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ac0f09364e3701d9ed35435288" ON "invoices" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_02781c49b25ceb502571f0315f" ON "invoices" ("payment_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_26daf5e433d6fb88ee32ce9363" ON "invoices" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_238b7a7accc697f9dc38bb2fa6" ON "onboarding_steps" ("slug") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b76aaa5336dcdff6ca464044b6" ON "onboarding_steps" ("type") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_0cab16d7274814ef7b9b021c64" ON "onboarding_steps" ("order") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_4b459011ef4d3e4f8618b404c0" ON "user_onboarding_progress" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d9da1249e3125778f926607e9d" ON "user_onboarding_progress" ("step_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c0dda6108b7bbd68c6823d4983" ON "user_onboarding_progress" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_cdef16da64ce64a5bf79062ec1" ON "user_onboarding_progress" ("completedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a0fa8c64807caecc993a5d399d" ON "user_onboarding_progress" ("user_id", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b3676e630f8875765de2bd587e" ON "onboarding_rewards" ("name") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c93297fa63b08ac2e83972bd5a" ON "onboarding_rewards" ("type") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b1cc4fe47a41d78d10f26589be" ON "onboarding_rewards" ("isActive") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_692a909ee0fa9383e7859f9b40" ON "notifications" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ac27b070934c64650ab339f4c6" ON "notifications" ("updatedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_467f6869324eebd9de644f4c28" ON "content_reports" ("contentType") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_79782456f7ad0ce730435a950a" ON "content_reports" ("contentId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_0aababfebc5662624a4a66b639" ON "content_reports" ("reporter_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c001c66a488dafe7aa8aa19402" ON "content_reports" ("assigned_moderator_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ec4970e90eebcc7a16efb37816" ON "content_reports" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_6c7e0cec7358f74ca9222628a1" ON "content_reports" ("moderation_item_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_translations_namespace_locale" ON "translations" ("namespace", "locale") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_6e199fc01241bcb8ec806e0c6a" ON "incidents" ("detectedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e2102fc64215f0a1fcb9ad4879" ON "incidents" ("status", "severity") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_0c4a4e0584c4d08a779239d250" ON "runbook_executions" ("startedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_041cd4f77805d53e3408cb4ae6" ON "runbook_executions" ("incidentId", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_43bd09d8fa296ece993503b6f2" ON "remediation_actions" ("executedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_f9614fbc7820536559cdc65147" ON "remediation_actions" ("incidentId", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b5d0e1b57bc6c761fb49e79bf8" ON "user_progress" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_014bd57abd7a916e466c5aaf80" ON "user_progress" ("totalPoints") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_7a5ad30aa2b8be04ca4a6d724a" ON "user_progress" ("level") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_22498516df46fa90e200915793" ON "user_progress" ("xp") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c0085fb66787d45eb374ddef38" ON "badges" ("category") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_f1221d9b1aaa64b1f3c98ed46d" ON "user_badges" ("user_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_423597e129f4f9402c976acce2" ON "unsubscribe_tokens" ("token") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_428c3f972502e77d9e2c79051b" ON "unsubscribe_tokens" ("email") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_57833e6da94a22790e6913a509" ON "email_events" ("workflowId", "eventType") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_a07f0454cce5637fd109a105dd" ON "email_events" ("recipientId", "eventType") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_9036fb7240edcc5f620ceff406" ON "email_events" ("campaignId", "eventType") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3f28c2b1ce5590ea0892267033" ON "campaign_recipients" ("campaignId", "status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d3e1023a52cb7875b6c10d3a15" ON "email_campaigns" ("name") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d9b4760e416c3767d44e5be0fd" ON "email_campaigns" ("subject") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ac1a8d28ac7e2f7aff92b57318" ON "email_campaigns" ("templateId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fc77d3d8f8101ab793cf17986f" ON "email_campaigns" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_862a5402a4d18274a07a2a7ccc" ON "email_campaigns" ("scheduledAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_5d23a7a8f43556bcd03a18a2b6" ON "email_campaigns" ("sentAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d3f089bf865364504bda9c2ff6" ON "archived_data" ("entityType") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e0b0b69779afb474ee220573c8" ON "archived_data" ("originalId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d16a377e285494ac71048f2b84" ON "archived_data" ("archivedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_92fd74dcbe9b1adad11ff3091d" ON "archived_data" ("entityType", "originalId") ',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_eda643b345dd73d5fc1a456a4b" ON "course_bulk_operations" ("undone_by_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_4d55d5b6642e4e9677c5af16b3" ON "course_bulk_operations" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_62e0da442361b07616d26593b3" ON "course_bulk_operations" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e00ea7965d1ed8c53b3c85a56e" ON "cohort_members" ("cohortId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_9360325be3f332793f1734704e" ON "cohort_members" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_e607ca8d8c3d11ccdc725a3dd0" ON "cohort_members" ("cohortId", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ba56e0a5617605dcc62cb33f11" ON "cohort_comments" ("threadId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3d8ef5f5715cb3d50315007aee" ON "cohort_threads" ("cohortId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_177b41bfa4c6574e30e95da04e" ON "cohort_threads" ("cohortId", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_16a0f89062ed4edd4cce26cc5e" ON "cohort_assignments" ("cohortId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_c2e0f2c83c50446d23955dff0a" ON "cohort_assignments" ("cohortId", "createdAt") ',
    );
    await queryRunner.query('CREATE INDEX "IDX_d1865366170f468d8eb720f8c8" ON "cohorts" ("name") ');
    await queryRunner.query(
      'CREATE INDEX "IDX_a8707945701186685e1b5e9c51" ON "content_metadata" ("expires_at") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_cd5b89a167f9f9821b70ff88bf" ON "content_metadata" ("content_type") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_21202b13906bffe54448b2a553" ON "content_metadata" ("status") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ee13cd8cabbac2258203bb1c95" ON "backup_records" ("completedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d2faa8fa665e7cdbd602d557df" ON "backup_records" ("region") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_1ff95d74c5186613b05e651802" ON "backup_records" ("status", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_f1d4afbdb77bbb26a461726b68" ON "recovery_tests" ("testCompletedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_66893187eeb7c3198e3d07c595" ON "recovery_tests" ("backup_record_id") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_06ed7514e57cb8bd0c09ce3be0" ON "recovery_tests" ("status", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_4185366a8d6033a3aad864621d" ON "assessment" ("title") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d146560603e5ee3716c519b103" ON "assessment" ("durationMinutes") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3a50f773964d78f404d73bcb36" ON "assessment" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_91578dceeb42466b9285f29e4b" ON "question" ("type") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_5649f3ee460ee3d00ce2114fc5" ON "question" ("prompt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ec14ddf4e267af8aa908806a97" ON "question" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d6e8c39a1de2c9b659b227c9e6" ON "analytics_events" ("timestamp") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_38c954e266791189dfd7b6ffc4" ON "analytics_events" ("eventType", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_d4b972aafe44b57154abba8db3" ON "analytics_events" ("user_id", "eventType", "createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_93f082fa43fdce4811582a4e3c" ON "achievement_progress" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_20adca3c4217744bfd8a485e98" ON "achievement_progress" ("achievementId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_629092c0eb5931f28a88932b45" ON "achievement_progress" ("isUnlocked") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_3ac6bc9da3e8a56f3f7082012d" ON "user_achievements" ("userId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_6a5a5816f54d0044ba5f3dc2b7" ON "user_achievements" ("achievementId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_1b62007f50cea2887ba68ea710" ON "user_achievements" ("unlockedAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_258ef1682aba959da9301e5dee" ON "achievement_statistics" ("achievementId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fb0b9985fcfe901ed223a5468a" ON "achievement_statistics" ("date") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_139af264ff823c0f6e17be7c8e" ON "achievement_statistics" ("achievementId", "date") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ef31ae63719e8ca42b0a658438" ON "webhook_retries" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_5ff375f35bf59b074f1a64f1b2" ON "webhook_retries" ("status", "nextRetryTime") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_ba7c709a66f7360180c4d1bcd9" ON "rubrics" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_82294735678621182b86847277" ON "feedback_templates" ("createdAt") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_dc2b9d46195bb3ed28abbf7c9e" ON "roles_permissions_permissions" ("rolesId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_fd4d5d4c7f7ff16c57549b72c6" ON "roles_permissions_permissions" ("permissionsId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_df951a64f09865171d2d7a502b" ON "users_roles_roles" ("usersId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_b2f0366aa9349789527e0c36d9" ON "users_roles_roles" ("rolesId") ',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "CHK_63a6345d11ef40993abe0af7d7" CHECK ("failureCount" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "CHK_454249837abfcca2dce79a2941" CHECK ("successCount" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "CHK_dffedab4e655d35cc59b4ef18f" CHECK ("totalCount" >= 0); EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'ALTER TABLE "forum_votes" ADD CONSTRAINT "FK_930875619d15f219f30923b724c" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "FK_1af4ba5bb120d226b6a4f994209" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'DO $$ BEGIN ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "FK_eda643b345dd73d5fc1a456a4bf" FOREIGN KEY ("undone_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION; EXCEPTION WHEN duplicate_object THEN NULL; END $$;',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_levels" ADD CONSTRAINT "FK_8c0b069d24a8380f5356d22e427" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_criteria" ADD CONSTRAINT "FK_67d38effbc57ecb21bc2901057e" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "criterion_grades" ADD CONSTRAINT "FK_e63fa5de1df5c92236101dcfc4b" FOREIGN KEY ("grade_id") REFERENCES "submission_grades"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "submission_grades" ADD CONSTRAINT "FK_37bd4055f0a14a276992573e103" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "submission_grades" DROP CONSTRAINT "FK_37bd4055f0a14a276992573e103"',
    );
    await queryRunner.query(
      'ALTER TABLE "criterion_grades" DROP CONSTRAINT "FK_e63fa5de1df5c92236101dcfc4b"',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_criteria" DROP CONSTRAINT "FK_67d38effbc57ecb21bc2901057e"',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_levels" DROP CONSTRAINT "FK_8c0b069d24a8380f5356d22e427"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "FK_eda643b345dd73d5fc1a456a4bf"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "FK_1af4ba5bb120d226b6a4f994209"',
    );
    await queryRunner.query(
      'ALTER TABLE "forum_votes" DROP CONSTRAINT "FK_930875619d15f219f30923b724c"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "CHK_dffedab4e655d35cc59b4ef18f"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "CHK_454249837abfcca2dce79a2941"',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" DROP CONSTRAINT "CHK_63a6345d11ef40993abe0af7d7"',
    );
    await queryRunner.query('DROP INDEX "public"."IDX_b2f0366aa9349789527e0c36d9"');
    await queryRunner.query('DROP INDEX "public"."IDX_df951a64f09865171d2d7a502b"');
    await queryRunner.query('DROP INDEX "public"."IDX_fd4d5d4c7f7ff16c57549b72c6"');
    await queryRunner.query('DROP INDEX "public"."IDX_dc2b9d46195bb3ed28abbf7c9e"');
    await queryRunner.query('DROP INDEX "public"."IDX_82294735678621182b86847277"');
    await queryRunner.query('DROP INDEX "public"."IDX_ba7c709a66f7360180c4d1bcd9"');
    await queryRunner.query('DROP INDEX "public"."IDX_5ff375f35bf59b074f1a64f1b2"');
    await queryRunner.query('DROP INDEX "public"."IDX_ef31ae63719e8ca42b0a658438"');
    await queryRunner.query('DROP INDEX "public"."IDX_139af264ff823c0f6e17be7c8e"');
    await queryRunner.query('DROP INDEX "public"."IDX_fb0b9985fcfe901ed223a5468a"');
    await queryRunner.query('DROP INDEX "public"."IDX_258ef1682aba959da9301e5dee"');
    await queryRunner.query('DROP INDEX "public"."IDX_1b62007f50cea2887ba68ea710"');
    await queryRunner.query('DROP INDEX "public"."IDX_6a5a5816f54d0044ba5f3dc2b7"');
    await queryRunner.query('DROP INDEX "public"."IDX_3ac6bc9da3e8a56f3f7082012d"');
    await queryRunner.query('DROP INDEX "public"."IDX_629092c0eb5931f28a88932b45"');
    await queryRunner.query('DROP INDEX "public"."IDX_20adca3c4217744bfd8a485e98"');
    await queryRunner.query('DROP INDEX "public"."IDX_93f082fa43fdce4811582a4e3c"');
    await queryRunner.query('DROP INDEX "public"."IDX_d4b972aafe44b57154abba8db3"');
    await queryRunner.query('DROP INDEX "public"."IDX_38c954e266791189dfd7b6ffc4"');
    await queryRunner.query('DROP INDEX "public"."IDX_d6e8c39a1de2c9b659b227c9e6"');
    await queryRunner.query('DROP INDEX "public"."IDX_ec14ddf4e267af8aa908806a97"');
    await queryRunner.query('DROP INDEX "public"."IDX_5649f3ee460ee3d00ce2114fc5"');
    await queryRunner.query('DROP INDEX "public"."IDX_91578dceeb42466b9285f29e4b"');
    await queryRunner.query('DROP INDEX "public"."IDX_3a50f773964d78f404d73bcb36"');
    await queryRunner.query('DROP INDEX "public"."IDX_d146560603e5ee3716c519b103"');
    await queryRunner.query('DROP INDEX "public"."IDX_4185366a8d6033a3aad864621d"');
    await queryRunner.query('DROP INDEX "public"."IDX_06ed7514e57cb8bd0c09ce3be0"');
    await queryRunner.query('DROP INDEX "public"."IDX_66893187eeb7c3198e3d07c595"');
    await queryRunner.query('DROP INDEX "public"."IDX_f1d4afbdb77bbb26a461726b68"');
    await queryRunner.query('DROP INDEX "public"."IDX_1ff95d74c5186613b05e651802"');
    await queryRunner.query('DROP INDEX "public"."IDX_d2faa8fa665e7cdbd602d557df"');
    await queryRunner.query('DROP INDEX "public"."IDX_ee13cd8cabbac2258203bb1c95"');
    await queryRunner.query('DROP INDEX "public"."IDX_21202b13906bffe54448b2a553"');
    await queryRunner.query('DROP INDEX "public"."IDX_cd5b89a167f9f9821b70ff88bf"');
    await queryRunner.query('DROP INDEX "public"."IDX_a8707945701186685e1b5e9c51"');
    await queryRunner.query('DROP INDEX "public"."IDX_d1865366170f468d8eb720f8c8"');
    await queryRunner.query('DROP INDEX "public"."IDX_c2e0f2c83c50446d23955dff0a"');
    await queryRunner.query('DROP INDEX "public"."IDX_16a0f89062ed4edd4cce26cc5e"');
    await queryRunner.query('DROP INDEX "public"."IDX_177b41bfa4c6574e30e95da04e"');
    await queryRunner.query('DROP INDEX "public"."IDX_3d8ef5f5715cb3d50315007aee"');
    await queryRunner.query('DROP INDEX "public"."IDX_ba56e0a5617605dcc62cb33f11"');
    await queryRunner.query('DROP INDEX "public"."IDX_e607ca8d8c3d11ccdc725a3dd0"');
    await queryRunner.query('DROP INDEX "public"."IDX_9360325be3f332793f1734704e"');
    await queryRunner.query('DROP INDEX "public"."IDX_e00ea7965d1ed8c53b3c85a56e"');
    await queryRunner.query('DROP INDEX "public"."IDX_62e0da442361b07616d26593b3"');
    await queryRunner.query('DROP INDEX "public"."IDX_4d55d5b6642e4e9677c5af16b3"');
    await queryRunner.query('DROP INDEX "public"."IDX_eda643b345dd73d5fc1a456a4b"');
    await queryRunner.query('DROP INDEX "public"."IDX_92fd74dcbe9b1adad11ff3091d"');
    await queryRunner.query('DROP INDEX "public"."IDX_d16a377e285494ac71048f2b84"');
    await queryRunner.query('DROP INDEX "public"."IDX_e0b0b69779afb474ee220573c8"');
    await queryRunner.query('DROP INDEX "public"."IDX_d3f089bf865364504bda9c2ff6"');
    await queryRunner.query('DROP INDEX "public"."IDX_5d23a7a8f43556bcd03a18a2b6"');
    await queryRunner.query('DROP INDEX "public"."IDX_862a5402a4d18274a07a2a7ccc"');
    await queryRunner.query('DROP INDEX "public"."IDX_fc77d3d8f8101ab793cf17986f"');
    await queryRunner.query('DROP INDEX "public"."IDX_ac1a8d28ac7e2f7aff92b57318"');
    await queryRunner.query('DROP INDEX "public"."IDX_d9b4760e416c3767d44e5be0fd"');
    await queryRunner.query('DROP INDEX "public"."IDX_d3e1023a52cb7875b6c10d3a15"');
    await queryRunner.query('DROP INDEX "public"."IDX_3f28c2b1ce5590ea0892267033"');
    await queryRunner.query('DROP INDEX "public"."IDX_9036fb7240edcc5f620ceff406"');
    await queryRunner.query('DROP INDEX "public"."IDX_a07f0454cce5637fd109a105dd"');
    await queryRunner.query('DROP INDEX "public"."IDX_57833e6da94a22790e6913a509"');
    await queryRunner.query('DROP INDEX "public"."IDX_428c3f972502e77d9e2c79051b"');
    await queryRunner.query('DROP INDEX "public"."IDX_423597e129f4f9402c976acce2"');
    await queryRunner.query('DROP INDEX "public"."IDX_f1221d9b1aaa64b1f3c98ed46d"');
    await queryRunner.query('DROP INDEX "public"."IDX_c0085fb66787d45eb374ddef38"');
    await queryRunner.query('DROP INDEX "public"."IDX_22498516df46fa90e200915793"');
    await queryRunner.query('DROP INDEX "public"."IDX_7a5ad30aa2b8be04ca4a6d724a"');
    await queryRunner.query('DROP INDEX "public"."IDX_014bd57abd7a916e466c5aaf80"');
    await queryRunner.query('DROP INDEX "public"."IDX_b5d0e1b57bc6c761fb49e79bf8"');
    await queryRunner.query('DROP INDEX "public"."IDX_f9614fbc7820536559cdc65147"');
    await queryRunner.query('DROP INDEX "public"."IDX_43bd09d8fa296ece993503b6f2"');
    await queryRunner.query('DROP INDEX "public"."IDX_041cd4f77805d53e3408cb4ae6"');
    await queryRunner.query('DROP INDEX "public"."IDX_0c4a4e0584c4d08a779239d250"');
    await queryRunner.query('DROP INDEX "public"."IDX_e2102fc64215f0a1fcb9ad4879"');
    await queryRunner.query('DROP INDEX "public"."IDX_6e199fc01241bcb8ec806e0c6a"');
    await queryRunner.query('DROP INDEX "public"."IDX_translations_namespace_locale"');
    await queryRunner.query('DROP INDEX "public"."IDX_6c7e0cec7358f74ca9222628a1"');
    await queryRunner.query('DROP INDEX "public"."IDX_ec4970e90eebcc7a16efb37816"');
    await queryRunner.query('DROP INDEX "public"."IDX_c001c66a488dafe7aa8aa19402"');
    await queryRunner.query('DROP INDEX "public"."IDX_0aababfebc5662624a4a66b639"');
    await queryRunner.query('DROP INDEX "public"."IDX_79782456f7ad0ce730435a950a"');
    await queryRunner.query('DROP INDEX "public"."IDX_467f6869324eebd9de644f4c28"');
    await queryRunner.query('DROP INDEX "public"."IDX_ac27b070934c64650ab339f4c6"');
    await queryRunner.query('DROP INDEX "public"."IDX_692a909ee0fa9383e7859f9b40"');
    await queryRunner.query('DROP INDEX "public"."IDX_b1cc4fe47a41d78d10f26589be"');
    await queryRunner.query('DROP INDEX "public"."IDX_c93297fa63b08ac2e83972bd5a"');
    await queryRunner.query('DROP INDEX "public"."IDX_b3676e630f8875765de2bd587e"');
    await queryRunner.query('DROP INDEX "public"."IDX_a0fa8c64807caecc993a5d399d"');
    await queryRunner.query('DROP INDEX "public"."IDX_cdef16da64ce64a5bf79062ec1"');
    await queryRunner.query('DROP INDEX "public"."IDX_c0dda6108b7bbd68c6823d4983"');
    await queryRunner.query('DROP INDEX "public"."IDX_d9da1249e3125778f926607e9d"');
    await queryRunner.query('DROP INDEX "public"."IDX_4b459011ef4d3e4f8618b404c0"');
    await queryRunner.query('DROP INDEX "public"."IDX_0cab16d7274814ef7b9b021c64"');
    await queryRunner.query('DROP INDEX "public"."IDX_b76aaa5336dcdff6ca464044b6"');
    await queryRunner.query('DROP INDEX "public"."IDX_238b7a7accc697f9dc38bb2fa6"');
    await queryRunner.query('DROP INDEX "public"."IDX_26daf5e433d6fb88ee32ce9363"');
    await queryRunner.query('DROP INDEX "public"."IDX_02781c49b25ceb502571f0315f"');
    await queryRunner.query('DROP INDEX "public"."IDX_ac0f09364e3701d9ed35435288"');
    await queryRunner.query('DROP INDEX "public"."IDX_bf8e0f9dd4558ef209ec111782"');
    await queryRunner.query('DROP INDEX "public"."IDX_fcd49f4739a516d59675b8134e"');
    await queryRunner.query('DROP INDEX "public"."IDX_580f1dbf7bceb9c2cde8baf7ff"');
    await queryRunner.query('DROP INDEX "public"."IDX_e0a5c10dfd4a71af0f150204e9"');
    await queryRunner.query('DROP INDEX "public"."IDX_7684def1bb4135f494082b34ee"');
    await queryRunner.query('DROP INDEX "public"."IDX_8dacda0f101c97b73304ddf0fc"');
    await queryRunner.query('DROP INDEX "public"."IDX_1b692560d438e5fc6edebbb27d"');
    await queryRunner.query('DROP INDEX "public"."IDX_c2a89b63635ae2b4cc76f17a08"');
    await queryRunner.query('DROP INDEX "public"."IDX_743b9fb1d2a059f2f7860418e4"');
    await queryRunner.query('DROP INDEX "public"."IDX_c5fa169d2de9407d99f2c6e4fa"');
    await queryRunner.query('DROP INDEX "public"."IDX_427785468fb7d2733f59e7d7d3"');
    await queryRunner.query('DROP INDEX "public"."IDX_32b41cdb985a296213e9a928b5"');
    await queryRunner.query('DROP INDEX "public"."IDX_1a15756e257e0eaf01edc85645"');
    await queryRunner.query('DROP INDEX "public"."IDX_d0a95ef8a28188364c546eb65c"');
    await queryRunner.query('DROP INDEX "public"."IDX_6ccf973355b70645eff37774de"');
    await queryRunner.query('DROP INDEX "public"."IDX_8d5af5c5dbdc0d91ce1178a004"');
    await queryRunner.query('DROP INDEX "public"."IDX_69752e0d44a35a0dce9d9f06d0"');
    await queryRunner.query('DROP INDEX "public"."IDX_dfc023bb093b1afcbc91798837"');
    await queryRunner.query('DROP INDEX "public"."IDX_e20f751a4d8faf089b1922eaf5"');
    await queryRunner.query('DROP INDEX "public"."IDX_fd467ff7c6435655c8d715f221"');
    await queryRunner.query('DROP INDEX "public"."IDX_42bbd07a91fea7e34f175b19fe"');
    await queryRunner.query('DROP INDEX "public"."IDX_616c8b49254550dbee7f917f3a"');
    await queryRunner.query('DROP INDEX "public"."IDX_cfd29d0da332d5c46d9b073863"');
    await queryRunner.query('DROP INDEX "public"."IDX_2310ecc5cb8be427097154b18f"');
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_action_timestamp"');
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_entity"');
    await queryRunner.query('DROP INDEX "public"."IDX_audit_logs_ip_address"');
    await queryRunner.query('DROP INDEX "public"."IDX_5fb386b7d3d50fd5657ef76c3d"');
    await queryRunner.query('DROP INDEX "public"."IDX_c58f7e88c286e5e3478960a998"');
    await queryRunner.query('DROP INDEX "public"."IDX_fab34e0791096b2a0a1bf8bd7f"');
    await queryRunner.query('DROP INDEX "public"."IDX_fe0bb3f6520ee0469504521e71"');
    await queryRunner.query('DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"');
    await queryRunner.query('DROP INDEX "public"."IDX_4d018866397b1e7e78d03b4566"');
    await queryRunner.query('DROP INDEX "public"."IDX_648e3f5447f725579d7d4ffdfb"');
    await queryRunner.query('DROP INDEX "public"."IDX_da04f89054f39981438894dfe3"');
    await queryRunner.query('DROP INDEX "public"."IDX_a27a3c9d6a41c0fa0fd1cb3f85"');
    await queryRunner.query('DROP INDEX "public"."IDX_72058429360b0daed61d94fb4f"');
    await queryRunner.query('DROP INDEX "public"."IDX_2bd3a6327596cc908d574a8219"');
    await queryRunner.query('DROP INDEX "public"."IDX_deca5c9911b3b2100b36106082"');
    await queryRunner.query('DROP INDEX "public"."IDX_baccb82c6179dca139f6b8c768"');
    await queryRunner.query('DROP INDEX "public"."IDX_ac5edecc1aefa58ed0237a7ee4"');
    await queryRunner.query('DROP INDEX "public"."IDX_34cbd320b458b8cf9e0d580304"');
    await queryRunner.query('DROP INDEX "public"."IDX_1f69fdcbd7ea5f0e52c3230c00"');
    await queryRunner.query('DROP INDEX "public"."IDX_c2c4377a3e7773772bf670eb47"');
    await queryRunner.query('DROP INDEX "public"."IDX_d6e7a6c84587eb7809c5b910f8"');
    await queryRunner.query('DROP INDEX "public"."IDX_91e3503740d174a4599e81ad8a"');
    await queryRunner.query('DROP INDEX "public"."IDX_d03f18ea29009de1e37a6d156b"');
    await queryRunner.query('DROP INDEX "public"."IDX_756e18fc1918b63fb4d79b4db6"');
    await queryRunner.query('DROP INDEX "public"."IDX_46ad51ba4f4bb7db2817d75419"');
    await queryRunner.query('DROP INDEX "public"."IDX_dd1ce01d1164c8bbdda052ced7"');
    await queryRunner.query('DROP INDEX "public"."IDX_fc17c7e94154a17e767b7674f1"');
    await queryRunner.query('DROP INDEX "public"."IDX_65395710ac88af450c5123f030"');
    await queryRunner.query('DROP INDEX "public"."IDX_d80cf66830a0231b8104893b67"');
    await queryRunner.query('DROP INDEX "public"."IDX_35fb2307535d90a6ed290af1f4"');
    await queryRunner.query('DROP INDEX "public"."IDX_633a748d9720d4c3c25f0fc120"');
    await queryRunner.query('DROP INDEX "public"."IDX_3dad32ba0ff20feee98b1b0c43"');
    await queryRunner.query(
      "CREATE TYPE \"public\".\"audit_logs_action_enum_old\" AS ENUM('LOGIN', 'LOGIN_FAILED', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET', 'PASSWORD_CHANGE', 'EMAIL_VERIFIED', 'TOKEN_REFRESH', 'SESSION_EXPIRED', 'SESSION_REVOKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_ROLE_CHANGED', 'USER_STATUS_CHANGED', 'DATA_VIEWED', 'DATA_CREATED', 'DATA_UPDATED', 'DATA_DELETED', 'DATA_EXPORTED', 'DATA_IMPORTED', 'FILE_UPLOADED', 'FILE_DOWNLOADED', 'FILE_DELETED', 'FILE_SHARED', 'API_CALLED', 'API_RATE_LIMITED', 'API_ERROR', 'PERMISSION_DENIED', 'SUSPICIOUS_ACTIVITY', 'MFA_ENABLED', 'MFA_DISABLED', 'MFA_FAILED', 'CONFIG_CHANGED', 'SETTING_UPDATED', 'BACKUP_CREATED', 'BACKUP_RESTORED', 'DATA_RETENTION_APPLIED', 'AUDIT_LOG_EXPORTED', 'REPORT_GENERATED')",
    );
    await queryRunner.query(
      'ALTER TABLE "audit_logs" ALTER COLUMN "action" TYPE "public"."audit_logs_action_enum_old" USING "action"::"text"::"public"."audit_logs_action_enum_old"',
    );
    await queryRunner.query('DROP TYPE "public"."audit_logs_action_enum"');
    await queryRunner.query(
      'ALTER TYPE "public"."audit_logs_action_enum_old" RENAME TO "audit_logs_action_enum"',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_action_timestamp" ON "audit_logs" ("action", "timestamp") ',
    );
    await queryRunner.query('ALTER TABLE "course_bulk_operations" DROP COLUMN "version"');
    await queryRunner.query('ALTER TABLE "course_bulk_operations" DROP COLUMN "notes"');
    await queryRunner.query('ALTER TABLE "course_bulk_operations" DROP COLUMN "reason"');
    await queryRunner.query('ALTER TABLE "course_bulk_operations" DROP COLUMN "undone_by_id"');
    await queryRunner.query(
      'CREATE UNIQUE INDEX "UQ_forum_votes_entityType_entityId_authorId" ON "forum_votes" ("entityType", "entityId", "authorId") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_ip_address" ON "audit_logs" ("ip_address") ',
    );
    await queryRunner.query(
      'CREATE INDEX "IDX_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id") ',
    );
    await queryRunner.query(
      'ALTER TABLE "submission_grades" ADD CONSTRAINT "FK_submission_grades_rubric" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "criterion_grades" ADD CONSTRAINT "FK_criterion_grades_grade" FOREIGN KEY ("grade_id") REFERENCES "submission_grades"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_criteria" ADD CONSTRAINT "FK_rubric_criteria_rubric" FOREIGN KEY ("rubric_id") REFERENCES "rubrics"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "rubric_levels" ADD CONSTRAINT "FK_rubric_levels_criterion" FOREIGN KEY ("criterion_id") REFERENCES "rubric_criteria"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "course_bulk_operations" ADD CONSTRAINT "FK_course_bulk_ops_initiator" FOREIGN KEY ("initiated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'ALTER TABLE "forum_votes" ADD CONSTRAINT "FK_forum_votes_authorId_users" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    );
    await queryRunner.query(
      'DELETE FROM "typeorm_metadata" WHERE "type" = \'GENERATED_COLUMN\' AND "name" = \'search_vector\' AND "database" = current_database() AND "schema" = \'public\' AND "table" = \'course\'',
    );
    await queryRunner.query('ALTER TABLE "course" ALTER COLUMN "search_vector" DROP NOT NULL');
    await queryRunner.query(
      "ALTER TABLE \"course\" ADD \"searchVector\" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce(\"title\", '') || ' ' || coalesce(\"description\", '') || ' ' || coalesce(\"category\", ''))) STORED",
    );
  }
}
