/** Keep in sync with backend PARENT_CHANGE_SYNC_STEPS. */
export const PARENT_CHANGE_SYNC_STEPS = [
    "remirror",
    "capacity_gap",
    "ctp_today",
    "ctp_overlay",
    "cdp_today",
    "breach_and_open_ar",
    "history",
] as const;

export type ParentChangeSyncStep = (typeof PARENT_CHANGE_SYNC_STEPS)[number];
