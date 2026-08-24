/**
 * Local product-API path peels for Next `rewrites()`.
 *
 * Local UI always calls same-origin `/api/*`. This module is how those
 * requests reach Nest: main API (:3002) by default, with optional peels for
 * SMS (:3004), connectors (:3005), and reports (:3006).
 *
 * /api/auth stays on Next. /api/ws is Nest-owned (SSE).
 *
 * Flip flags: USE_SMS_NEST_REWRITE, USE_CONNECTORS_NEST_REWRITE,
 * USE_REPORTS_NEST_REWRITE (set "false" to send reports back to main API).
 * Reports default ON: the main API no longer mounts /api/reports.
 */

/** @type {readonly string[]} */
const NEST_API_REWRITE_TOP_LEVEL = [
    "accounts",
    "activities",
    "activity-attachments",
    "activitySequences",
    "admin",
    "agents",
    "bank-accounts",
    "business-units",
    "communication-intelligence",
    "country",
    "credit-insurance",
    "customers",
    "debug",
    "email",
    "entities",
    "errors",
    "import",
    "internalEmailTemplates",
    "invoices",
    "logs",
    "operations",
    "permissions",
    "portal",
    "reports",
    "roles",
    "search",
    "sequenceContainers",
    "settings",
    "sms",
    "state",
    "system",
    "test-auth",
    "upload",
    "user-preferences",
    "alert-details",
    "contact-response",
    "metrics",
];

/** @type {ReadonlySet<string>} */
const NEST_API_REWRITE_KEEP_ON_NEXT = new Set(["auth"]);

/**
 * @returns {boolean}
 */
function isNestApiRewriteEnabled() {
    return (
        process.env.NODE_ENV === "development" &&
        process.env.USE_NEST_API_REWRITE === "true"
    );
}

/**
 * @returns {boolean}
 */
function isSmsNestRewriteEnabled() {
    return process.env.USE_SMS_NEST_REWRITE === "true";
}

/**
 * @returns {string}
 */
function getNestApiRewriteTarget() {
    const raw =
        process.env.NEST_API_REWRITE_TARGET || "http://127.0.0.1:3002";
    return raw.replace(/\/$/, "");
}

/**
 * @returns {string}
 */
function getSmsNestRewriteTarget() {
    const raw =
        process.env.SMS_NEST_REWRITE_TARGET ||
        `http://127.0.0.1:${process.env.SMS_PORT || 3004}`;
    return raw.replace(/\/$/, "");
}

/**
 * @returns {boolean}
 */
function isConnectorsNestRewriteEnabled() {
    return process.env.USE_CONNECTORS_NEST_REWRITE === "true";
}

/**
 * @returns {string}
 */
function getConnectorsNestRewriteTarget() {
    const raw =
        process.env.CONNECTORS_NEST_REWRITE_TARGET ||
        `http://127.0.0.1:${process.env.CONNECTORS_PORT || 3005}`;
    return raw.replace(/\/$/, "");
}

/**
 * @returns {boolean}
 */
function isReportsNestRewriteEnabled() {
    // Reports live on @archaser/reports (:3006). Opt out with =false.
    return process.env.USE_REPORTS_NEST_REWRITE !== "false";
}

/**
 * @returns {string}
 */
function getReportsNestRewriteTarget() {
    const raw =
        process.env.REPORTS_NEST_REWRITE_TARGET ||
        `http://127.0.0.1:${process.env.REPORTS_PORT || 3006}`;
    return raw.replace(/\/$/, "");
}

/**
 * Next.js `beforeFiles` rewrites so Nest wins over pages/api for proxied paths.
 * @returns {Array<{ source: string, destination: string }>}
 */
function buildNestApiRewrites() {
    if (!isNestApiRewriteEnabled()) {
        return [];
    }
    const target = getNestApiRewriteTarget();
    const smsTarget = getSmsNestRewriteTarget();
    const smsSplit = isSmsNestRewriteEnabled();
    const connectorsTarget = getConnectorsNestRewriteTarget();
    const connectorsSplit = isConnectorsNestRewriteEnabled();
    const reportsTarget = getReportsNestRewriteTarget();
    const reportsSplit = isReportsNestRewriteEnabled();
    /** @type {Array<{ source: string, destination: string }>} */
    const rules = [];

    if (connectorsSplit) {
        rules.push({
            source: `/api/accounts`,
            destination: `${connectorsTarget}/api/accounts`,
        });
        rules.push({
            source: `/api/accounts/:path*`,
            destination: `${connectorsTarget}/api/accounts/:path*`,
        });
        // Narrow peel only — bank-accounts / business-units stay on main Nest API.
        rules.push({
            source: `/api/entities/accounts/:accountId/billing-connector`,
            destination: `${connectorsTarget}/api/entities/accounts/:accountId/billing-connector`,
        });
        rules.push({
            source: `/api/entities/accounts/:accountId/billing-connector/:path*`,
            destination: `${connectorsTarget}/api/entities/accounts/:accountId/billing-connector/:path*`,
        });
        rules.push({
            source: `/api/entities/accounts/:accountId/notification-rule-sets`,
            destination: `${connectorsTarget}/api/entities/accounts/:accountId/notification-rule-sets`,
        });
        rules.push({
            source: `/api/entities/accounts/:accountId/notification-rule-sets/:path*`,
            destination: `${connectorsTarget}/api/entities/accounts/:accountId/notification-rule-sets/:path*`,
        });
    }

    for (const top of NEST_API_REWRITE_TOP_LEVEL) {
        if (NEST_API_REWRITE_KEEP_ON_NEXT.has(top)) {
            continue;
        }
        if (top === "sms" && smsSplit) {
            rules.push({
                source: `/api/sms`,
                destination: `${smsTarget}/api/sms`,
            });
            rules.push({
                source: `/api/sms/:path*`,
                destination: `${smsTarget}/api/sms/:path*`,
            });
            continue;
        }
        if (top === "reports" && reportsSplit) {
            rules.push({
                source: `/api/reports`,
                destination: `${reportsTarget}/api/reports`,
            });
            rules.push({
                source: `/api/reports/:path*`,
                destination: `${reportsTarget}/api/reports/:path*`,
            });
            continue;
        }
        if (
            connectorsSplit &&
            top === "accounts"
        ) {
            continue;
        }
        rules.push({
            source: `/api/${top}`,
            destination: `${target}/api/${top}`,
        });
        rules.push({
            source: `/api/${top}/:path*`,
            destination: `${target}/api/${top}/:path*`,
        });
    }

    rules.push({
        source: "/api/ws",
        destination: `${target}/api/ws`,
    });
    rules.push({
        source: "/api/ws/:path*",
        destination: `${target}/api/ws/:path*`,
    });

    return rules;
}

module.exports = {
    NEST_API_REWRITE_TOP_LEVEL,
    NEST_API_REWRITE_KEEP_ON_NEXT,
    isNestApiRewriteEnabled,
    isSmsNestRewriteEnabled,
    isConnectorsNestRewriteEnabled,
    isReportsNestRewriteEnabled,
    getNestApiRewriteTarget,
    getSmsNestRewriteTarget,
    getConnectorsNestRewriteTarget,
    getReportsNestRewriteTarget,
    buildNestApiRewrites,
};
