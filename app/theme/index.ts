import { createAppTheme } from "./createAppTheme";

export { createAppTheme } from "./createAppTheme";
export {
    DEFAULT_CHART_PALETTE,
    DEFAULT_PRIMARY,
    DEFAULT_PRIMARY_LIGHT,
    DEFAULT_SECONDARY,
    HEX_COLOR_REGEX,
    hexToRgb,
    isValidHexColor,
    normalizeAccountColorValue,
    resolveAccountColorFields,
    resolveHexColor,
    THEME_TYPOGRAPHY,
} from "./constants";
export type { AccountColorFieldKey, AccountColorFields } from "./constants";
export type {
    AppButtonThemeStyles,
    CreditDashboardChartCardThemeStyles,
    MetricStatCardIconAccent,
    MetricStatCardThemeStyles,
    NavMenuThemeStyles,
    PortalCardThemeStyles,
} from "./types";

export default createAppTheme();
