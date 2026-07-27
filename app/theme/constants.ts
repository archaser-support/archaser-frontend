export const DEFAULT_PRIMARY = "#6B46C1";
export const DEFAULT_PRIMARY_LIGHT = "#8B5CF6";
export const DEFAULT_SECONDARY = "#9F7AEA";
export const DEFAULT_CHART_PALETTE = "#6B46C1";

export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function isValidHexColor(color: string | null | undefined): color is string {
    return Boolean(color && HEX_COLOR_REGEX.test(color));
}

export function resolveHexColor(
    color: string | null | undefined,
    fallback: string
): string {
    return isValidHexColor(color) ? color : fallback;
}

export type AccountColorFieldKey =
    | "primary_color"
    | "secondary_color"
    | "chart_palette_color";

export type AccountColorFields = Record<AccountColorFieldKey, string>;

const ACCOUNT_COLOR_FALLBACKS: AccountColorFields = {
    primary_color: DEFAULT_PRIMARY,
    secondary_color: DEFAULT_SECONDARY,
    chart_palette_color: DEFAULT_CHART_PALETTE,
};

/** Resolves all account branding colors to valid hex values (never null). */
export function resolveAccountColorFields(colors: {
    primary_color?: string | null;
    secondary_color?: string | null;
    chart_palette_color?: string | null;
}): AccountColorFields {
    return {
        primary_color: resolveHexColor(
            colors.primary_color,
            ACCOUNT_COLOR_FALLBACKS.primary_color
        ),
        secondary_color: resolveHexColor(
            colors.secondary_color,
            ACCOUNT_COLOR_FALLBACKS.secondary_color
        ),
        chart_palette_color: resolveHexColor(
            colors.chart_palette_color,
            ACCOUNT_COLOR_FALLBACKS.chart_palette_color
        ),
    };
}

/** Maps API/form input to a stored hex color; empty/null/invalid uses theme default. */
export function normalizeAccountColorValue(
    incoming: string | null | undefined,
    existing: string | null | undefined,
    field: AccountColorFieldKey
): string {
    const fallback = ACCOUNT_COLOR_FALLBACKS[field];
    if (incoming === "" || incoming === "null" || incoming === null) {
        return fallback;
    }
    if (incoming !== undefined) {
        return resolveHexColor(incoming, fallback);
    }
    return resolveHexColor(existing, fallback);
}

export function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

export const THEME_TYPOGRAPHY = {
    FONT_SIZE_SMALL: "0.875rem",
    LINE_HEIGHT_NORMAL: "1.5",
} as const;

/** Shared action button dimensions — see AppButtonThemeStyles in types.ts */
export const MEDIUM_BUTTON_HEIGHT = 37;

/** Portal action buttons — Apple HIG minimum touch target (44pt). */
export const PORTAL_BUTTON_MIN_HEIGHT_PX = 44;

/** Portal header logo avatar — subtle corners (less than `theme.shape.borderRadius`). */
export const PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX = 2;
export const TOOLBAR_CONTROL_HEIGHT = 32;
export const INPUT_BORDER_RADIUS = 12;
export const DROPDOWN_LIST_BORDER_RADIUS = 8;
export const TOOLBAR_CONTROL_BORDER_COLOR = "#E2E8F0";
