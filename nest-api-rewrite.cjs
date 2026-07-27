/**
 * Shared path list for local Nest API rewrite (D11–D15).
 * Keep in sync with backend/api Nest rewrite top-level list (PAGES_API_TOP_LEVEL).
 * /api/auth stays on Next (D2). /api/ws is Nest-owned (SSE).
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

    // Nest owns SSE — rewrite /api/ws when local Nest rewrite is on.
    // /api/auth stays on Next (D2 cookie bridge until Amplify-only auth).
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
 * @returns {string}
 */
function getNestApiRewriteTarget() {
    const raw =
        process.env.NEST_API_REWRITE_TARGET || "http://127.0.0.1:3002";
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
    /** @type {Array<{ source: string, destination: string }>} */
    const rules = [];

    for (const top of NEST_API_REWRITE_TOP_LEVEL) {
        if (NEST_API_REWRITE_KEEP_ON_NEXT.has(top)) {
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

    // Nest SSE realtime
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
    getNestApiRewriteTarget,
    buildNestApiRewrites,
};
