/** Shared height for Health Index + Trend cards in the dashboard top row. */
export const CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX = 352;

/** Toolbar row (title + delta chips + interval toggle) — single line. */
export const CREDIT_DASHBOARD_COMPACT_TOOLBAR_PX = 48;

/** Bottom edge of the 48px icon tile (top 14px + height 48px) — header must reserve this. */
export const CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX = 62;

/** Vertical padding inside compact cards (theme.spacing(1.5) × 2). */
const CREDIT_DASHBOARD_COMPACT_VERTICAL_PADDING_PX = 24;

/** Gap below compact trend toolbar (theme.spacing(0.75)). */
const CREDIT_DASHBOARD_COMPACT_TREND_TOOLBAR_MB_PX = 6;

/** Plot area inside compact trend card (card height − icon clearance − padding − toolbar gap). */
export const CREDIT_DASHBOARD_COMPACT_CHART_HEIGHT_PX =
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX -
    CREDIT_DASHBOARD_COMPACT_VERTICAL_PADDING_PX -
    CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX -
    CREDIT_DASHBOARD_COMPACT_TREND_TOOLBAR_MB_PX;

/**
 * Minimum gauge plot height in compact health card (flex: 1 grows into remaining space).
 * Card − vertical padding − icon/title clearance.
 */
export const CREDIT_DASHBOARD_COMPACT_GAUGE_HEIGHT_PX =
    CREDIT_DASHBOARD_COMPACT_CARD_HEIGHT_PX -
    CREDIT_DASHBOARD_COMPACT_VERTICAL_PADDING_PX -
    CREDIT_DASHBOARD_COMPACT_ICON_TILE_BOTTOM_PX;
