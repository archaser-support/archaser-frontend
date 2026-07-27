import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from "prom-client";

// Create a Registry which registers the metrics
const register = new Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: "archaser-app",
});

// Enable the collection of default metrics
collectDefaultMetrics({ register });

// ============================================================
// HTTP Request Metrics
// ============================================================
export const httpRequestCounter = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
});

export const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    registers: [register],
});

// ============================================================
// Cron Job Health Metrics
// ============================================================
export const cronJobsTotal = new Gauge({
    name: "archaser_cron_jobs_total",
    help: "Total number of cron jobs",
    registers: [register],
});

export const cronJobsRunning = new Gauge({
    name: "archaser_cron_jobs_running",
    help: "Number of currently running cron jobs",
    registers: [register],
});

export const cronJobsOverdue = new Gauge({
    name: "archaser_cron_jobs_overdue",
    help: "Number of overdue cron jobs",
    registers: [register],
});

export const cronJobsNotRun24h = new Gauge({
    name: "archaser_cron_jobs_not_run_24h",
    help: "Number of cron jobs not run in the last 24 hours",
    registers: [register],
});

export const cronJobSuccessRate = new Gauge({
    name: "archaser_cron_job_success_rate",
    help: "Overall cron job success rate (30 days)",
    registers: [register],
});

export const cronJobExecutions = new Counter({
    name: "archaser_cron_job_executions_total",
    help: "Total cron job executions",
    labelNames: ["job_name", "status"],
    registers: [register],
});

export const cronJobDuration = new Gauge({
    name: "archaser_cron_job_duration_seconds",
    help: "Last execution duration of cron jobs in seconds",
    labelNames: ["job_name"],
    registers: [register],
});

export const cronJobLastRun = new Gauge({
    name: "archaser_cron_job_last_run_timestamp_seconds",
    help: "Timestamp of the last cron job run",
    labelNames: ["job_name"],
    registers: [register],
});

export const cronJobNextRun = new Gauge({
    name: "archaser_cron_job_next_run_timestamp_seconds",
    help: "Timestamp of the next scheduled cron job run",
    labelNames: ["job_name"],
    registers: [register],
});

// ============================================================
// Email/SMS Activity Metrics
// ============================================================
export const emailsSent = new Gauge({
    name: "archaser_emails_sent_24h",
    help: "Emails sent in the last 24 hours",
    registers: [register],
});

export const emailsFailed = new Gauge({
    name: "archaser_emails_failed_24h",
    help: "Emails failed in the last 24 hours",
    registers: [register],
});

export const emailsBounced = new Gauge({
    name: "archaser_emails_bounced_24h",
    help: "Emails bounced in the last 24 hours",
    registers: [register],
});

export const emailContactsTotal24h = new Gauge({
    name: "archaser_email_contacts_total_24h",
    help: "Total email contacts processed in the last 24 hours",
    registers: [register],
});

export const emailContactsDelivered24h = new Gauge({
    name: "archaser_email_contacts_delivered_24h",
    help: "Email contacts delivered in the last 24 hours",
    registers: [register],
});

export const emailContactsOpened24h = new Gauge({
    name: "archaser_email_contacts_opened_24h",
    help: "Email contacts opened in the last 24 hours",
    registers: [register],
});

export const emailContactsClicked24h = new Gauge({
    name: "archaser_email_contacts_clicked_24h",
    help: "Email contacts clicked in the last 24 hours",
    registers: [register],
});

export const emailContactsBounced24h = new Gauge({
    name: "archaser_email_contacts_bounced_24h",
    help: "Email contacts bounced in the last 24 hours",
    registers: [register],
});

export const emailContactsFailed24h = new Gauge({
    name: "archaser_email_contacts_failed_24h",
    help: "Email contacts failed in the last 24 hours",
    registers: [register],
});

export const smsSent = new Gauge({
    name: "archaser_sms_sent_24h",
    help: "SMS sent in the last 24 hours",
    registers: [register],
});

export const smsFailed = new Gauge({
    name: "archaser_sms_failed_24h",
    help: "SMS failed in the last 24 hours",
    registers: [register],
});

export const emailSmtpConnected = new Gauge({
    name: "archaser_email_smtp_connected",
    help: "SMTP connection status (1 = connected, 0 = disconnected/misconfigured)",
    registers: [register],
});

export const emailSesConnected = new Gauge({
    name: "archaser_email_ses_connected",
    help: "SES connection status via SMTP compatibility (1 = connected, 0 = disconnected/misconfigured)",
    registers: [register],
});

export const smsProviderStatus = new Gauge({
    name: "archaser_sms_provider_status",
    help: "Per-provider SMS connection status (2=connected, 1=misconfigured, 0=disconnected)",
    labelNames: ["provider_id", "provider_name", "provider_type"],
    registers: [register],
});

export const smsProvidersConfiguredTotal = new Gauge({
    name: "archaser_sms_providers_configured_total",
    help: "Total active SMS providers configured",
    registers: [register],
});

export const activitiesStuck = new Gauge({
    name: "archaser_activities_stuck",
    help: "Number of stuck activities",
    registers: [register],
});

export const systemActivitiesCreated24h = new Gauge({
    name: "archaser_system_activities_created_24h",
    help: "Number of system-generated activities created in the last 24 hours",
    registers: [register],
});

export const hoursSinceLastSystemActivity = new Gauge({
    name: "archaser_hours_since_last_system_activity",
    help: "Hours since the last system-generated activity was created",
    registers: [register],
});

// ============================================================
// Import Job Metrics
// ============================================================
export const importJobsPending = new Gauge({
    name: "archaser_import_jobs_pending",
    help: "Number of pending import jobs",
    registers: [register],
});

export const importJobsStuck = new Gauge({
    name: "archaser_import_jobs_stuck",
    help: "Number of stuck import jobs (pending > 1 hour)",
    registers: [register],
});

export const importJobsSuccess24h = new Gauge({
    name: "archaser_import_jobs_24h",
    help: "Import jobs in the last 24 hours",
    registers: [register],
});

export const importSuccessRate = new Gauge({
    name: "archaser_import_success_rate",
    help: "Overall import success rate",
    registers: [register],
});

export const importRecordsPerHour = new Gauge({
    name: "archaser_import_records_per_hour",
    help: "Import processing rate (records per hour)",
    registers: [register],
});

// ============================================================
// Error/Log Metrics
// ============================================================
export const applicationErrors1h = new Gauge({
    name: "archaser_errors_1h",
    help: "Application errors in the last hour",
    registers: [register],
});

export const applicationErrors24h = new Gauge({
    name: "archaser_errors_24h",
    help: "Application errors in the last 24 hours",
    registers: [register],
});

export const applicationWarnings24h = new Gauge({
    name: "archaser_warnings_24h",
    help: "Application warnings in the last 24 hours",
    registers: [register],
});

// ============================================================
// Collection Period Health Metrics
// ============================================================
export const activeCollectionPeriods = new Gauge({
    name: "archaser_active_collection_periods",
    help: "Number of active collection periods",
    registers: [register],
});

export const automationStuckNoContacts = new Gauge({
    name: "archaser_automation_stuck_no_contacts",
    help: "Collection periods stuck due to no contacts",
    registers: [register],
});

export const periodsWithoutActivities = new Gauge({
    name: "archaser_periods_without_activities",
    help: "Automated periods without scheduled activities",
    registers: [register],
});

export const overdueActivityCreation = new Gauge({
    name: "archaser_overdue_activity_creation",
    help: "Collection periods with overdue activity creation",
    registers: [register],
});

// ============================================================
// Dispute Metrics
// ============================================================
export const disputesOpen = new Gauge({
    name: "archaser_disputes_open",
    help: "Number of open disputes",
    registers: [register],
});

export const disputesPending = new Gauge({
    name: "archaser_disputes_pending",
    help: "Number of pending disputes (open + in progress)",
    registers: [register],
});

export const disputesCreated24h = new Gauge({
    name: "archaser_disputes_created_24h",
    help: "Disputes created in the last 24 hours",
    registers: [register],
});

export const disputesResolved24h = new Gauge({
    name: "archaser_disputes_resolved_24h",
    help: "Disputes resolved in the last 24 hours",
    registers: [register],
});

export const disputesStale = new Gauge({
    name: "archaser_disputes_stale",
    help: "Disputes older than 7 days (potentially stuck)",
    registers: [register],
});

// ============================================================
// Promise to Pay Metrics
// ============================================================
export const ptpActive = new Gauge({
    name: "archaser_ptp_active",
    help: "Active Promise to Pay commitments",
    registers: [register],
});

export const ptpDueToday = new Gauge({
    name: "archaser_ptp_due_today",
    help: "Promise to Pay due today",
    registers: [register],
});

export const ptpBroken = new Gauge({
    name: "archaser_ptp_broken",
    help: "Broken Promise to Pay (past due with outstanding balance)",
    registers: [register],
});

// ============================================================
// Contact Health Metrics
// ============================================================
export const contactsHighBounce = new Gauge({
    name: "archaser_contacts_high_bounce",
    help: "Contacts with high email bounce count (>=3)",
    registers: [register],
});

export const contactsHighSMSFailure = new Gauge({
    name: "archaser_contacts_high_sms_failure",
    help: "Contacts with high SMS failure count (>=3)",
    registers: [register],
});

export const contactsLowCommScore = new Gauge({
    name: "archaser_contacts_low_comm_score",
    help: "Contacts with low communication score (<0.5)",
    registers: [register],
});

export const recentEmailBounces = new Gauge({
    name: "archaser_recent_email_bounces_24h",
    help: "Contacts with email bounces in the last 24 hours",
    registers: [register],
});

export const recentSMSFailures = new Gauge({
    name: "archaser_recent_sms_failures_24h",
    help: "Contacts with SMS failures in the last 24 hours",
    registers: [register],
});

// ============================================================
// Database Health Metrics
// ============================================================
export const dbPostgresConnected = new Gauge({
    name: "archaser_db_postgres_connected",
    help: "PostgreSQL connection status (1 = connected, 0 = disconnected)",
    registers: [register],
});

export const dbPostgresConnections = new Gauge({
    name: "archaser_db_postgres_connections",
    help: "Number of active PostgreSQL connections",
    registers: [register],
});

export const dbMongodbConnected = new Gauge({
    name: "archaser_db_mongodb_connected",
    help: "MongoDB connection status (1 = connected, 0 = disconnected)",
    registers: [register],
});

export const dbMongodbConnections = new Gauge({
    name: "archaser_db_mongodb_connections",
    help: "Number of active MongoDB connections",
    registers: [register],
});

// ============================================================
// Security Metrics
// ============================================================
export const securityAttacksTotal = new Counter({
    name: "archaser_security_attacks_total",
    help: "Total number of malicious payloads or security attacks detected",
    labelNames: ["type", "source"],
    registers: [register],
});

// ============================================================
// Billing Connector Metrics
// ============================================================
export const billingConnectorSyncTotal = new Counter({
    name: "archaser_billing_connector_sync_total",
    help: "Total billing connector sync runs",
    labelNames: ["provider", "status", "sync_mode", "trigger"],
    registers: [register],
});

export const billingConnectorSyncDuration = new Histogram({
    name: "archaser_billing_connector_sync_duration_seconds",
    help: "Billing connector sync duration in seconds",
    labelNames: ["provider", "sync_mode"],
    registers: [register],
});

export const billingConnectorErrorsTotal = new Counter({
    name: "archaser_billing_connector_errors_total",
    help: "Billing connector errors by type",
    labelNames: ["provider", "error_type", "sync_mode"],
    registers: [register],
});

export const billingConnectorRecordsProcessed = new Counter({
    name: "archaser_billing_connector_records_processed_total",
    help: "Billing connector records processed",
    labelNames: ["provider", "entity_type", "result"],
    registers: [register],
});

export const billingConnectorConnectorsInError = new Gauge({
    name: "archaser_billing_connector_connectors_in_error",
    help: "Number of billing connectors in Error status",
    labelNames: ["provider"],
    registers: [register],
});

export const billingConnectorLastCheckpointTimestamp = new Gauge({
    name: "archaser_billing_connector_last_checkpoint_timestamp",
    help: "Unix timestamp of the most recent connector checkpoint",
    labelNames: ["provider"],
    registers: [register],
});

export const billingConnectorStaleRunningCount = new Gauge({
    name: "archaser_billing_connector_stale_running_count",
    help: "Number of stale RUNNING connector sync executions",
    registers: [register],
});

export { register };
