import { createTheme } from "@mui/material/styles";
import type {} from "@mui/x-date-pickers/themeAugmentation";

import "./augmentation";

import {
    buildAppButtonStyles,
    COLOR_SWATCH_WIDTH_PX,
    OUTLINED_INPUT_HEIGHT_PX,
    OUTLINED_LABEL_HELPER_OFFSET,
} from "./appButton";
import { buildThemeComponents } from "./components";
import {
    DEFAULT_CHART_PALETTE,
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    resolveHexColor,
} from "./constants";
import { buildMetricStatCardThemeExtensions } from "./metricStatCard";
import { buildPortalButtonThemeExtensions } from "./portalButton";
import { buildPortalCardThemeExtensions } from "./portalCard";
import { buildPortalMenuThemeExtensions } from "./portalMenu";
import { buildPalette } from "./palette";
import { buildToolbarStyles } from "./toolbarStyles";
import { customTooltip, rtlTooltip } from "./tooltips";
import { buildTypography } from "./typography";

/** Creates MUI theme with optional per-account primary, secondary, and chart palette colors. */
export function createAppTheme(
    primaryColor?: string | null,
    secondaryColor?: string | null,
    chartPaletteColor?: string | null
) {
    const primary = resolveHexColor(primaryColor, DEFAULT_PRIMARY);
    const secondary = resolveHexColor(secondaryColor, DEFAULT_SECONDARY);
    const chartPalette = resolveHexColor(chartPaletteColor, DEFAULT_CHART_PALETTE);

    const appButton = buildAppButtonStyles();
    const toolbar = buildToolbarStyles(appButton);
    const colorSwatchRadiusPx = OUTLINED_INPUT_HEIGHT_PX / 2;

    return createTheme({
        palette: buildPalette(primary, secondary, chartPalette),
        typography: buildTypography(primary),
        shape: {
            borderRadius: 4,
        },
        components: buildThemeComponents({
            primary,
            appButton,
            outlinedInputHeightPx: OUTLINED_INPUT_HEIGHT_PX,
            outlinedLabelHelperOffset: OUTLINED_LABEL_HELPER_OFFSET,
            colorSwatchWidthPx: COLOR_SWATCH_WIDTH_PX,
            colorSwatchRadiusPx,
            toolbar,
        }),
        customTooltip,
        rtlTooltip,
        navMenu: {
            listItemBorderRadius: 0,
        },
        appButton,
        ...buildMetricStatCardThemeExtensions(),
        ...buildPortalCardThemeExtensions(),
        ...buildPortalButtonThemeExtensions(),
        ...buildPortalMenuThemeExtensions(),
    });
}
