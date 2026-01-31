-- OpenClaw Integration Tables Migration
-- Architecture principle: "OpenClaw executes. KIISHA authorizes."

-- Channel Identities - Map external channel identities to KIISHA users
CREATE TABLE IF NOT EXISTS channelIdentities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  userId INT NOT NULL,
  organizationId INT NOT NULL,
  channelType ENUM('whatsapp', 'telegram', 'slack', 'discord', 'msteams', 'signal', 'imessage', 'matrix', 'googlechat', 'webchat') NOT NULL,
  externalId VARCHAR(255) NOT NULL,
  handle VARCHAR(255),
  displayName VARCHAR(255),
  verificationStatus ENUM('pending', 'verified', 'revoked') DEFAULT 'pending' NOT NULL,
  verificationMethod ENUM('otp', 'email', 'admin_approval', 'magic_link'),
  verificationCode VARCHAR(10),
  verificationExpires TIMESTAMP NULL,
  verifiedAt TIMESTAMP NULL,
  verifiedBy INT,
  lastUsedAt TIMESTAMP NULL,
  revokedAt TIMESTAMP NULL,
  revokedReason VARCHAR(500),
  preferredLanguage VARCHAR(10) DEFAULT 'en',
  timezone VARCHAR(50) DEFAULT 'Africa/Lagos',
  notificationsEnabled BOOLEAN DEFAULT TRUE,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX channel_identity_user_idx (userId),
  INDEX channel_identity_org_idx (organizationId),
  INDEX channel_identity_channel_idx (channelType, externalId),
  UNIQUE KEY unique_channel_identity (channelType, externalId, organizationId)
);

-- Capability Registry - Define available OpenClaw capabilities
CREATE TABLE IF NOT EXISTS capabilityRegistry (
  id INT AUTO_INCREMENT PRIMARY KEY,
  capabilityId VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category ENUM('channel', 'query', 'document', 'operation', 'browser', 'skill', 'cron', 'payment') NOT NULL,
  riskLevel ENUM('low', 'medium', 'high', 'critical') DEFAULT 'low' NOT NULL,
  requiresApproval BOOLEAN DEFAULT FALSE NOT NULL,
  requires2FA BOOLEAN DEFAULT FALSE NOT NULL,
  requiresAdmin BOOLEAN DEFAULT FALSE NOT NULL,
  defaultConstraints JSON,
  isActive BOOLEAN DEFAULT TRUE NOT NULL,
  isBuiltIn BOOLEAN DEFAULT TRUE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX capability_category_idx (category),
  INDEX capability_risk_idx (riskLevel)
);

-- Organization Capabilities - Per-org capability enablement
CREATE TABLE IF NOT EXISTS orgCapabilities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizationId INT NOT NULL,
  capabilityId VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT FALSE NOT NULL,
  customConstraints JSON,
  approvalPolicy ENUM('inherit', 'always', 'never', 'threshold') DEFAULT 'inherit' NOT NULL,
  approvalThreshold JSON,
  dailyLimit INT,
  monthlyLimit INT,
  currentDailyUsage INT DEFAULT 0,
  currentMonthlyUsage INT DEFAULT 0,
  usageResetAt TIMESTAMP NULL,
  enabledBy INT,
  enabledAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX org_capability_org_idx (organizationId),
  INDEX org_capability_cap_idx (capabilityId),
  UNIQUE KEY unique_org_capability (organizationId, capabilityId)
);

-- Approval Requests - Unified approval workflow for sensitive operations
CREATE TABLE IF NOT EXISTS approvalRequests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  requestId VARCHAR(100) NOT NULL UNIQUE,
  organizationId INT NOT NULL,
  requestedBy INT NOT NULL,
  requestedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  channelType ENUM('whatsapp', 'telegram', 'slack', 'discord', 'msteams', 'signal', 'imessage', 'matrix', 'googlechat', 'webchat'),
  channelIdentityId INT,
  capabilityId VARCHAR(100) NOT NULL,
  taskSpec JSON,
  summary TEXT,
  riskAssessment JSON,
  status ENUM('pending', 'approved', 'rejected', 'expired', 'cancelled') DEFAULT 'pending' NOT NULL,
  approvedBy INT,
  approvedAt TIMESTAMP NULL,
  approvalMethod ENUM('web', 'chat', '2fa', 'auto'),
  rejectionReason VARCHAR(500),
  expiresAt TIMESTAMP NULL,
  executedAt TIMESTAMP NULL,
  executionResult JSON,
  auditTrail JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX approval_org_idx (organizationId),
  INDEX approval_status_idx (status),
  INDEX approval_requested_by_idx (requestedBy),
  INDEX approval_capability_idx (capabilityId)
);

-- Security Policies - Per-org security policies for OpenClaw
CREATE TABLE IF NOT EXISTS openclawSecurityPolicies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  organizationId INT NOT NULL UNIQUE,
  allowedChannels JSON,
  requirePairing BOOLEAN DEFAULT TRUE NOT NULL,
  requireAdminApprovalForNewChannels BOOLEAN DEFAULT TRUE NOT NULL,
  dataClassification JSON,
  exportRequiresApproval BOOLEAN DEFAULT TRUE NOT NULL,
  browserAutomationAllowed BOOLEAN DEFAULT FALSE NOT NULL,
  shellExecutionAllowed BOOLEAN DEFAULT FALSE NOT NULL,
  fileUploadAllowed BOOLEAN DEFAULT TRUE NOT NULL,
  allowedHours JSON,
  globalRateLimitPerMinute INT DEFAULT 60,
  globalRateLimitPerDay INT DEFAULT 1000,
  escalationPolicy JSON,
  auditLevel ENUM('minimal', 'standard', 'comprehensive') DEFAULT 'standard' NOT NULL,
  retainConversationsForDays INT DEFAULT 365,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX security_policy_org_idx (organizationId)
);

-- Conversation VATRs - Audit trail for all OpenClaw conversations
CREATE TABLE IF NOT EXISTS conversationVatrs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vatrId VARCHAR(100) NOT NULL UNIQUE,
  organizationId INT NOT NULL,
  userId INT NOT NULL,
  channelIdentityId INT,
  projectId INT,
  channelType ENUM('whatsapp', 'telegram', 'slack', 'discord', 'msteams', 'signal', 'imessage', 'matrix', 'googlechat', 'webchat') NOT NULL,
  externalMessageId VARCHAR(255),
  sessionId VARCHAR(100),
  userMessage TEXT NOT NULL,
  aiResponse TEXT NOT NULL,
  attachments JSON,
  toolsInvoked JSON,
  dataAccessed JSON,
  capabilitiesUsed JSON,
  approvalRequestId INT,
  contentHash VARCHAR(64) NOT NULL,
  previousVatrHash VARCHAR(64),
  signature VARCHAR(512),
  messageReceivedAt TIMESTAMP NOT NULL,
  responseGeneratedAt TIMESTAMP NOT NULL,
  processingTimeMs INT,
  metadata JSON,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX conversation_vatr_org_idx (organizationId),
  INDEX conversation_vatr_user_idx (userId),
  INDEX conversation_vatr_channel_idx (channelType),
  INDEX conversation_vatr_session_idx (sessionId),
  INDEX conversation_vatr_project_idx (projectId),
  INDEX conversation_vatr_hash_idx (contentHash)
);

-- OpenClaw Tasks - Track task execution from OpenClaw
CREATE TABLE IF NOT EXISTS openclawTasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  taskId VARCHAR(100) NOT NULL UNIQUE,
  organizationId INT NOT NULL,
  userId INT NOT NULL,
  channelIdentityId INT,
  conversationVatrId INT,
  approvalRequestId INT,
  taskType ENUM('query', 'document', 'browser', 'skill', 'cron', 'api') NOT NULL,
  capabilityId VARCHAR(100) NOT NULL,
  taskSpec JSON NOT NULL,
  authContext JSON NOT NULL,
  status ENUM('pending', 'sent', 'running', 'success', 'partial', 'failed', 'timeout', 'rejected', 'cancelled') DEFAULT 'pending' NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  sentAt TIMESTAMP NULL,
  startedAt TIMESTAMP NULL,
  completedAt TIMESTAMP NULL,
  timeoutAt TIMESTAMP NULL,
  result JSON,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX openclaw_task_org_idx (organizationId),
  INDEX openclaw_task_user_idx (userId),
  INDEX openclaw_task_status_idx (status),
  INDEX openclaw_task_capability_idx (capabilityId)
);

-- OpenClaw Scheduled Tasks - Cron-based task scheduling
CREATE TABLE IF NOT EXISTS openclawScheduledTasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scheduleId VARCHAR(100) NOT NULL UNIQUE,
  organizationId INT NOT NULL,
  createdBy INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cronExpression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'Africa/Lagos' NOT NULL,
  capabilityId VARCHAR(100) NOT NULL,
  taskSpec JSON NOT NULL,
  notifyOnSuccess BOOLEAN DEFAULT FALSE NOT NULL,
  notifyOnFailure BOOLEAN DEFAULT TRUE NOT NULL,
  notifyChannels JSON,
  enabled BOOLEAN DEFAULT TRUE NOT NULL,
  lastRunAt TIMESTAMP NULL,
  lastRunStatus ENUM('success', 'partial', 'failed', 'timeout'),
  nextRunAt TIMESTAMP NULL,
  runCount INT DEFAULT 0 NOT NULL,
  failureCount INT DEFAULT 0 NOT NULL,
  maxConsecutiveFailures INT DEFAULT 3,
  currentConsecutiveFailures INT DEFAULT 0,
  autoDisableOnFailure BOOLEAN DEFAULT TRUE NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  INDEX scheduled_task_org_idx (organizationId),
  INDEX scheduled_task_enabled_idx (enabled),
  INDEX scheduled_task_next_run_idx (nextRunAt)
);

-- Insert default capabilities
INSERT INTO capabilityRegistry (capabilityId, name, description, category, riskLevel, requiresApproval, requires2FA, requiresAdmin) VALUES
-- Channel capabilities (low risk)
('channel.whatsapp', 'WhatsApp Channel', 'Receive and send WhatsApp messages', 'channel', 'low', FALSE, FALSE, FALSE),
('channel.telegram', 'Telegram Channel', 'Receive and send Telegram messages', 'channel', 'low', FALSE, FALSE, FALSE),
('channel.slack', 'Slack Channel', 'Receive and send Slack messages', 'channel', 'low', FALSE, FALSE, FALSE),
('channel.discord', 'Discord Channel', 'Receive and send Discord messages', 'channel', 'low', FALSE, FALSE, FALSE),
('channel.msteams', 'Microsoft Teams Channel', 'Receive and send Teams messages', 'channel', 'low', FALSE, FALSE, FALSE),
('channel.webchat', 'Web Chat', 'Chat via KIISHA web interface', 'channel', 'low', FALSE, FALSE, FALSE),

-- Query capabilities (low risk)
('kiisha.portfolio.summary', 'Portfolio Summary', 'View portfolio overview with capacity, revenue, and alerts', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.portfolio.metrics', 'Portfolio Metrics', 'View detailed portfolio performance metrics', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.project.details', 'Project Details', 'View project information and status', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.project.list', 'List Projects', 'List all accessible projects', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.documents.status', 'Document Status', 'Check document checklist and verification progress', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.documents.list', 'List Documents', 'List documents for a project', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.alerts.list', 'List Alerts', 'View active alerts across portfolio', 'query', 'low', FALSE, FALSE, FALSE),
('kiisha.tickets.list', 'List Tickets', 'View open maintenance tickets', 'query', 'low', FALSE, FALSE, FALSE),

-- Document capabilities (medium risk)
('kiisha.document.upload', 'Upload Document', 'Upload and categorize documents via chat', 'document', 'medium', TRUE, FALSE, FALSE),
('kiisha.document.extract', 'Extract Document Data', 'Extract data from uploaded documents', 'document', 'medium', TRUE, FALSE, FALSE),

-- Operation capabilities (medium risk)
('kiisha.ticket.create', 'Create Ticket', 'Create maintenance work orders', 'operation', 'medium', TRUE, FALSE, FALSE),
('kiisha.rfi.respond', 'Respond to RFI', 'Respond to Requests for Information', 'operation', 'medium', TRUE, FALSE, FALSE),
('kiisha.alert.acknowledge', 'Acknowledge Alert', 'Acknowledge and resolve alerts', 'operation', 'medium', TRUE, FALSE, FALSE),

-- Browser automation (medium-high risk)
('browser.portal_login', 'Portal Login', 'Login to external vendor portals', 'browser', 'high', TRUE, FALSE, TRUE),
('browser.data_scrape', 'Data Scraping', 'Scrape data from external portals', 'browser', 'high', TRUE, FALSE, TRUE),
('browser.form_submit', 'Form Submission', 'Submit forms on external sites', 'browser', 'critical', TRUE, TRUE, TRUE),

-- Cron capabilities (low-medium risk)
('cron.compliance_check', 'Compliance Check', 'Scheduled compliance obligation checks', 'cron', 'low', FALSE, FALSE, FALSE),
('cron.report_generation', 'Report Generation', 'Scheduled report generation', 'cron', 'medium', TRUE, FALSE, FALSE),
('cron.data_collection', 'Data Collection', 'Scheduled automated data collection', 'cron', 'medium', TRUE, FALSE, FALSE),

-- Payment capabilities (critical risk)
('kiisha.payment.initiate', 'Initiate Payment', 'Initiate payment transactions', 'payment', 'critical', TRUE, TRUE, TRUE),
('kiisha.user.invite', 'Invite User', 'Invite new users to organization', 'operation', 'high', TRUE, FALSE, TRUE),
('kiisha.data.export', 'Export Data', 'Export organization data', 'operation', 'high', TRUE, TRUE, TRUE)

ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description);
