export const EMAIL_CONFIG = {
    MAX_SUBJECT_LENGTH: 160,
    MAX_BODY_LENGTH_WARNING: 5000,
    MAX_CONTACTS_WARNING: 50,
    CONTACTS_CACHE_TIME: 5 * 60 * 1000, // 5 minutes
    DEBOUNCE_DELAY: 300,
} as const;

export const TEMPLATE_QUERY_CONFIG = {
    query: "",
    page: 1,
    rowsPerPage: 1000,
    category: "Automated",
    active: "true",
} as const;
