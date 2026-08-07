-- CreateTable
CREATE TABLE `organizations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Jakarta',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `organizations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sites` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `logo_url` VARCHAR(191) NULL,
    `widget_color` VARCHAR(191) NOT NULL DEFAULT '#D4AF37',
    `ai_name` VARCHAR(191) NOT NULL DEFAULT 'Clara',
    `greeting` TEXT NOT NULL,
    `offline_message` TEXT NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'id',
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Jakarta',
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sites_site_key_key`(`site_key`),
    INDEX `sites_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_domains` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `site_domains_site_id_domain_key`(`site_id`, `domain`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_settings` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `widget_enabled` BOOLEAN NOT NULL DEFAULT true,
    `ai_enabled` BOOLEAN NOT NULL DEFAULT true,
    `human_chat_enabled` BOOLEAN NOT NULL DEFAULT true,
    `bubble_position` VARCHAR(191) NOT NULL DEFAULT 'bottom-right',
    `pre_chat_form_enabled` BOOLEAN NOT NULL DEFAULT false,
    `pre_chat_form_fields` JSON NULL,
    `quick_replies` JSON NULL,
    `suggested_questions` JSON NULL,
    `show_agent_button` BOOLEAN NOT NULL DEFAULT true,
    `allow_attachments` BOOLEAN NOT NULL DEFAULT true,
    `allowed_file_types` JSON NULL,
    `max_file_size_bytes` INTEGER NOT NULL DEFAULT 10485760,
    `privacy_notice_url` VARCHAR(191) NULL,
    `terms_url` VARCHAR(191) NULL,
    `rating_form_enabled` BOOLEAN NOT NULL DEFAULT true,
    `show_ai_sources_to_customer` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `site_settings_site_id_key`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `failed_login_count` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `supervisor_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `users_organization_id_idx`(`organization_id`),
    UNIQUE INDEX `users_organization_id_email_key`(`organization_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `is_system` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `roles_organization_id_slug_key`(`organization_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,

    UNIQUE INDEX `permissions_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` VARCHAR(191) NOT NULL,
    `role_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `role_id` VARCHAR(191) NOT NULL,
    `permission_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`role_id`, `permission_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_family` VARCHAR(191) NOT NULL,
    `refresh_hash` VARCHAR(191) NOT NULL,
    `user_agent` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `revoked_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sessions_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invitations` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role_slug` VARCHAR(191) NOT NULL,
    `invited_by_id` VARCHAR(191) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `accepted_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invitations_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `teams` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Jakarta',
    `capacity_per_agent` INTEGER NOT NULL DEFAULT 5,
    `routing_priority` INTEGER NOT NULL DEFAULT 0,
    `supervisor_id` VARCHAR(191) NULL,
    `escalation_team_id` VARCHAR(191) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `teams_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `team_members` (
    `team_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`team_id`, `user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_profiles` (
    `user_id` VARCHAR(191) NOT NULL,
    `availability` VARCHAR(191) NOT NULL DEFAULT 'OFFLINE',
    `max_concurrent_chats` INTEGER NOT NULL DEFAULT 5,
    `active_chat_count` INTEGER NOT NULL DEFAULT 0,
    `last_status_change_at` DATETIME(3) NULL,

    PRIMARY KEY (`user_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agent_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `changed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `agent_status_history_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `working_hours` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `team_id` VARCHAR(191) NULL,
    `day_of_week` INTEGER NOT NULL,
    `start_time` VARCHAR(191) NOT NULL,
    `end_time` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `visitors` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `visitor_key` VARCHAR(191) NOT NULL,
    `first_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_ip_hash` VARCHAR(191) NULL,
    `last_user_agent` TEXT NULL,
    `metadata` JSON NULL,

    UNIQUE INDEX `visitors_site_id_visitor_key_key`(`site_id`, `visitor_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `external_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `account_status` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_site_id_email_idx`(`site_id`, `email`),
    UNIQUE INDEX `customers_site_id_external_id_key`(`site_id`, `external_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_identities` (
    `id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NOT NULL,
    `jti` VARCHAR(191) NOT NULL,
    `issued_at` DATETIME(3) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_identities_jti_key`(`jti`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL DEFAULT '#888888',

    UNIQUE INDEX `tags_organization_id_name_key`(`organization_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_tags` (
    `customer_id` VARCHAR(191) NOT NULL,
    `tag_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`customer_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `visitor_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'NEW',
    `handler_type` VARCHAR(191) NOT NULL DEFAULT 'AI',
    `assigned_agent_id` VARCHAR(191) NULL,
    `assigned_team_id` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `channel` VARCHAR(191) NOT NULL DEFAULT 'WIDGET',
    `language` VARCHAR(191) NOT NULL DEFAULT 'id',
    `intent` VARCHAR(191) NULL,
    `sentiment` VARCHAR(191) NULL,
    `ai_confidence` DOUBLE NULL,
    `handoff_reason` VARCHAR(191) NULL,
    `rating_score` INTEGER NULL,
    `rating_comment` TEXT NULL,
    `first_message_at` DATETIME(3) NULL,
    `first_response_at` DATETIME(3) NULL,
    `assigned_at` DATETIME(3) NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,
    `last_message_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `conversations_organization_id_status_idx`(`organization_id`, `status`),
    INDEX `conversations_site_id_status_idx`(`site_id`, `status`),
    INDEX `conversations_assigned_agent_id_idx`(`assigned_agent_id`),
    INDEX `conversations_assigned_team_id_idx`(`assigned_team_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_participants` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `participant_type` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `joined_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `left_at` DATETIME(3) NULL,

    INDEX `conversation_participants_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NULL,
    `team_id` VARCHAR(191) NULL,
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `assigned_by_id` VARCHAR(191) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `unassigned_at` DATETIME(3) NULL,

    INDEX `conversation_assignments_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_events` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `actor_type` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_events_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_contexts` (
    `conversation_id` VARCHAR(191) NOT NULL,
    `page_url` TEXT NULL,
    `page_title` VARCHAR(191) NULL,
    `referrer` TEXT NULL,
    `utm_source` VARCHAR(191) NULL,
    `utm_medium` VARCHAR(191) NULL,
    `utm_campaign` VARCHAR(191) NULL,
    `custom_context` JSON NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`conversation_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_summaries` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `customer_goal` TEXT NOT NULL,
    `important_facts` JSON NOT NULL,
    `actions_taken` JSON NOT NULL,
    `open_issues` JSON NOT NULL,
    `sensitive_data_detected` BOOLEAN NOT NULL DEFAULT false,
    `trigger` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `conversation_summaries_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `sender_type` VARCHAR(191) NOT NULL,
    `sender_id` VARCHAR(191) NULL,
    `message_type` VARCHAR(191) NOT NULL DEFAULT 'TEXT',
    `content` TEXT NOT NULL,
    `content_sanitized` TEXT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `reply_to_message_id` VARCHAR(191) NULL,
    `client_message_id` VARCHAR(191) NULL,
    `ai_run_id` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `messages_conversation_id_created_at_idx`(`conversation_id`, `created_at`),
    UNIQUE INDEX `messages_conversation_id_client_message_id_key`(`conversation_id`, `client_message_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_attachments` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `storage_key` VARCHAR(191) NOT NULL,
    `file_name` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NOT NULL,
    `size_bytes` INTEGER NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT false,
    `scan_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_receipts` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `reader_type` VARCHAR(191) NOT NULL,
    `reader_id` VARCHAR(191) NULL,
    `read_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `message_receipts_message_id_reader_type_reader_id_key`(`message_id`, `reader_type`, `reader_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_reactions` (
    `id` VARCHAR(191) NOT NULL,
    `message_id` VARCHAR(191) NOT NULL,
    `actor_type` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `reaction` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_number` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `customer_id` VARCHAR(191) NULL,
    `conversation_id` VARCHAR(191) NULL,
    `category` VARCHAR(191) NOT NULL,
    `subject` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `assigned_team_id` VARCHAR(191) NULL,
    `assigned_agent_id` VARCHAR(191) NULL,
    `sla_due_at` DATETIME(3) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `resolution` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `resolved_at` DATETIME(3) NULL,
    `closed_at` DATETIME(3) NULL,

    UNIQUE INDEX `tickets_ticket_number_key`(`ticket_number`),
    INDEX `tickets_organization_id_status_idx`(`organization_id`, `status`),
    INDEX `tickets_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_comments` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `author_id` VARCHAR(191) NULL,
    `content` TEXT NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_comments_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_assignments` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NULL,
    `team_id` VARCHAR(191) NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_events` (
    `id` VARCHAR(191) NOT NULL,
    `ticket_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_events_ticket_id_idx`(`ticket_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NULL,
    `customer_id` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `purpose` VARCHAR(191) NULL,
    `product_interest` VARCHAR(191) NULL,
    `consent_given` BOOLEAN NOT NULL DEFAULT false,
    `source` VARCHAR(191) NOT NULL DEFAULT 'WIDGET',
    `crm_lead_id` VARCHAR(191) NULL,
    `sync_status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `sync_error` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `leads_organization_id_idx`(`organization_id`),
    INDEX `leads_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_events` (
    `id` VARCHAR(191) NOT NULL,
    `lead_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_events_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_categories` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_categories_organization_id_slug_key`(`organization_id`, `slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_documents` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `category_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `summary` TEXT NULL,
    `tags` JSON NULL,
    `audience` VARCHAR(191) NOT NULL DEFAULT 'PUBLIC',
    `status` VARCHAR(191) NOT NULL DEFAULT 'DRAFT',
    `effective_date` DATETIME(3) NULL,
    `expired_date` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_by_id` VARCHAR(191) NULL,
    `reviewed_by_id` VARCHAR(191) NULL,
    `approved_by_id` VARCHAR(191) NULL,
    `published_at` DATETIME(3) NULL,
    `source_url` VARCHAR(191) NULL,
    `source_file` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `checksum` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `knowledge_documents_site_id_status_idx`(`site_id`, `status`),
    UNIQUE INDEX `knowledge_documents_site_id_slug_key`(`site_id`, `slug`),
    FULLTEXT INDEX `knowledge_documents_title_content_idx`(`title`, `content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_document_versions` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `changed_by_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_document_versions_document_id_version_key`(`document_id`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_chunks` (
    `id` VARCHAR(191) NOT NULL,
    `document_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `chunk_index` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `token_count` INTEGER NOT NULL,
    `embedding` JSON NULL,
    `embedding_model` VARCHAR(191) NULL,
    `embedding_dimension` INTEGER NULL,
    `checksum` VARCHAR(191) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `knowledge_chunks_document_id_idx`(`document_id`),
    INDEX `knowledge_chunks_site_id_idx`(`site_id`),
    FULLTEXT INDEX `knowledge_chunks_content_idx`(`content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_tags` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `knowledge_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_document_tags` (
    `document_id` VARCHAR(191) NOT NULL,
    `tag_id` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`document_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_configurations` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `provider` VARCHAR(191) NOT NULL DEFAULT 'mock',
    `classifier_model` VARCHAR(191) NOT NULL DEFAULT 'gpt-4o-mini',
    `answer_model` VARCHAR(191) NOT NULL DEFAULT 'gpt-4o-mini',
    `summary_model` VARCHAR(191) NOT NULL DEFAULT 'gpt-4o-mini',
    `suggested_reply_model` VARCHAR(191) NOT NULL DEFAULT 'gpt-4o-mini',
    `embedding_model` VARCHAR(191) NOT NULL DEFAULT 'text-embedding-3-small',
    `confidence_threshold` DOUBLE NOT NULL DEFAULT 0.6,
    `max_tokens` INTEGER NOT NULL DEFAULT 800,
    `timeout_ms` INTEGER NOT NULL DEFAULT 20000,
    `max_retries` INTEGER NOT NULL DEFAULT 2,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_prompts` (
    `id` VARCHAR(191) NOT NULL,
    `ai_configuration_id` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_runs` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `purpose` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'SUCCESS',
    `input_tokens` INTEGER NULL,
    `output_tokens` INTEGER NULL,
    `latency_ms` INTEGER NULL,
    `confidence` DOUBLE NULL,
    `intent` VARCHAR(191) NULL,
    `handoff_required` BOOLEAN NULL,
    `error_message` TEXT NULL,
    `request_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_runs_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ai_run_id` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_tool_calls` (
    `id` VARCHAR(191) NOT NULL,
    `ai_run_id` VARCHAR(191) NOT NULL,
    `tool_name` VARCHAR(191) NOT NULL,
    `input` JSON NULL,
    `output` JSON NULL,
    `allowed` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_feedback` (
    `id` VARCHAR(191) NOT NULL,
    `ai_run_id` VARCHAR(191) NOT NULL,
    `agent_id` VARCHAR(191) NULL,
    `helpful` BOOLEAN NOT NULL,
    `used` BOOLEAN NOT NULL DEFAULT false,
    `edited` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_usage_daily` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `run_count` INTEGER NOT NULL DEFAULT 0,
    `estimated_cost_usd` DECIMAL(10, 4) NOT NULL DEFAULT 0,

    UNIQUE INDEX `ai_usage_daily_organization_id_site_id_date_provider_model_key`(`organization_id`, `site_id`, `date`, `provider`, `model`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `routing_rules` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 0,
    `conditions` JSON NOT NULL,
    `target_team_id` VARCHAR(191) NULL,
    `strategy` VARCHAR(191) NOT NULL DEFAULT 'ROUND_ROBIN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `routing_rules_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handoff_rules` (
    `id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `target_team_id` VARCHAR(191) NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'NORMAL',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `handoff_rules_site_id_idx`(`site_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `response_templates` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `shortcut` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `language` VARCHAR(191) NOT NULL DEFAULT 'id',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `response_templates_organization_id_shortcut_key`(`organization_id`, `shortcut`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integrations` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `config` JSON NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `integration_id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `encrypted_value` TEXT NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `integration_credentials_integration_id_key_key`(`integration_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integration_logs` (
    `id` VARCHAR(191) NOT NULL,
    `integration_id` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `idempotency_key` VARCHAR(191) NULL,
    `request_payload` JSON NULL,
    `response_payload` JSON NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `integration_logs_integration_id_idx`(`integration_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhooks` (
    `id` VARCHAR(191) NOT NULL,
    `integration_id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `secret` VARCHAR(191) NOT NULL,
    `events` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_deliveries` (
    `id` VARCHAR(191) NOT NULL,
    `webhook_id` VARCHAR(191) NOT NULL,
    `event` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `status_code` INTEGER NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `attempt` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_feedback` (
    `id` VARCHAR(191) NOT NULL,
    `conversation_id` VARCHAR(191) NOT NULL,
    `score` INTEGER NOT NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `analytics_daily` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `site_id` VARCHAR(191) NULL,
    `date` DATE NOT NULL,
    `conversation_count` INTEGER NOT NULL DEFAULT 0,
    `unique_visitor_count` INTEGER NOT NULL DEFAULT 0,
    `new_customer_count` INTEGER NOT NULL DEFAULT 0,
    `ai_answered_count` INTEGER NOT NULL DEFAULT 0,
    `ai_resolved_count` INTEGER NOT NULL DEFAULT 0,
    `handoff_count` INTEGER NOT NULL DEFAULT 0,
    `unresolved_count` INTEGER NOT NULL DEFAULT 0,
    `avg_first_response_sec` INTEGER NULL,
    `avg_resolution_sec` INTEGER NULL,
    `csat_avg` DOUBLE NULL,
    `lead_count` INTEGER NOT NULL DEFAULT 0,
    `ticket_count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `analytics_daily_organization_id_site_id_date_key`(`organization_id`, `site_id`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `actor_type` VARCHAR(191) NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `resource_type` VARCHAR(191) NOT NULL,
    `resource_id` VARCHAR(191) NULL,
    `before_data` JSON NULL,
    `after_data` JSON NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` TEXT NULL,
    `request_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organization_id_created_at_idx`(`organization_id`, `created_at`),
    INDEX `audit_logs_resource_type_resource_id_idx`(`resource_type`, `resource_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `security_events` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL DEFAULT 'LOW',
    `actor_id` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `details` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `security_events_organization_id_created_at_idx`(`organization_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `rate_limit_events` (
    `id` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `route` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `rate_limit_events_scope_key_created_at_idx`(`scope`, `key`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `feature_flags` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NULL,
    `key` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `feature_flags_organization_id_key_key`(`organization_id`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sites` ADD CONSTRAINT `sites_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_domains` ADD CONSTRAINT `site_domains_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `site_settings` ADD CONSTRAINT `site_settings_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_supervisor_id_fkey` FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `roles` ADD CONSTRAINT `roles_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_invited_by_id_fkey` FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `teams` ADD CONSTRAINT `teams_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `team_members` ADD CONSTRAINT `team_members_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_profiles` ADD CONSTRAINT `agent_profiles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_status_history` ADD CONSTRAINT `agent_status_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `agent_profiles`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `working_hours` ADD CONSTRAINT `working_hours_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `working_hours` ADD CONSTRAINT `working_hours_team_id_fkey` FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `visitors` ADD CONSTRAINT `visitors_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_identities` ADD CONSTRAINT `customer_identities_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_tags` ADD CONSTRAINT `customer_tags_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_tags` ADD CONSTRAINT `customer_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_visitor_id_fkey` FOREIGN KEY (`visitor_id`) REFERENCES `visitors`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_assigned_team_id_fkey` FOREIGN KEY (`assigned_team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_assignments` ADD CONSTRAINT `conversation_assignments_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_events` ADD CONSTRAINT `conversation_events_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_contexts` ADD CONSTRAINT `conversation_contexts_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_summaries` ADD CONSTRAINT `conversation_summaries_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_attachments` ADD CONSTRAINT `message_attachments_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_receipts` ADD CONSTRAINT `message_receipts_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_reactions` ADD CONSTRAINT `message_reactions_message_id_fkey` FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tickets` ADD CONSTRAINT `tickets_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_events` ADD CONSTRAINT `ticket_events_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_events` ADD CONSTRAINT `lead_events_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_categories` ADD CONSTRAINT `knowledge_categories_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_document_versions` ADD CONSTRAINT `knowledge_document_versions_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_document_tags` ADD CONSTRAINT `knowledge_document_tags_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_document_tags` ADD CONSTRAINT `knowledge_document_tags_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `knowledge_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_configurations` ADD CONSTRAINT `ai_configurations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_configurations` ADD CONSTRAINT `ai_configurations_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_prompts` ADD CONSTRAINT `ai_prompts_ai_configuration_id_fkey` FOREIGN KEY (`ai_configuration_id`) REFERENCES `ai_configurations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_runs` ADD CONSTRAINT `ai_runs_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_messages` ADD CONSTRAINT `ai_messages_ai_run_id_fkey` FOREIGN KEY (`ai_run_id`) REFERENCES `ai_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_tool_calls` ADD CONSTRAINT `ai_tool_calls_ai_run_id_fkey` FOREIGN KEY (`ai_run_id`) REFERENCES `ai_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_feedback` ADD CONSTRAINT `ai_feedback_ai_run_id_fkey` FOREIGN KEY (`ai_run_id`) REFERENCES `ai_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `routing_rules` ADD CONSTRAINT `routing_rules_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handoff_rules` ADD CONSTRAINT `handoff_rules_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handoff_rules` ADD CONSTRAINT `handoff_rules_target_team_id_fkey` FOREIGN KEY (`target_team_id`) REFERENCES `teams`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `response_templates` ADD CONSTRAINT `response_templates_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integrations` ADD CONSTRAINT `integrations_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_credentials` ADD CONSTRAINT `integration_credentials_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `integration_logs` ADD CONSTRAINT `integration_logs_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_integration_id_fkey` FOREIGN KEY (`integration_id`) REFERENCES `integrations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_id_fkey` FOREIGN KEY (`webhook_id`) REFERENCES `webhooks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_feedback` ADD CONSTRAINT `customer_feedback_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `analytics_daily` ADD CONSTRAINT `analytics_daily_site_id_fkey` FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `feature_flags` ADD CONSTRAINT `feature_flags_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
