import type { AppButtonThemeStyles } from "./types";
import {
    DROPDOWN_LIST_BORDER_RADIUS,
    INPUT_BORDER_RADIUS,
    MEDIUM_BUTTON_HEIGHT,
    THEME_TYPOGRAPHY,
    TOOLBAR_CONTROL_BORDER_COLOR,
    TOOLBAR_CONTROL_HEIGHT,
} from "./constants";

export function buildAppButtonStyles(): AppButtonThemeStyles {
    return {
        borderRadius: INPUT_BORDER_RADIUS,
        dropdownListBorderRadius: DROPDOWN_LIST_BORDER_RADIUS,
        sizeMedium: {
            height: MEDIUM_BUTTON_HEIGHT,
            borderRadius: MEDIUM_BUTTON_HEIGHT / 2,
        },
        sizeSmall: {
            minHeight: TOOLBAR_CONTROL_HEIGHT,
            height: TOOLBAR_CONTROL_HEIGHT,
            minWidth: 78,
            paddingX: 2,
            paddingY: 0,
            fontSize: "0.8125rem",
            lineHeight: 1.25,
        },
        toolbarControl: {
            height: TOOLBAR_CONTROL_HEIGHT,
            borderRadius: TOOLBAR_CONTROL_HEIGHT / 2,
            borderColor: TOOLBAR_CONTROL_BORDER_COLOR,
        },
    };
}

export const OUTLINED_INPUT_HEIGHT_PX = MEDIUM_BUTTON_HEIGHT;
export const COLOR_SWATCH_WIDTH_PX = 56;
export const OUTLINED_LABEL_HELPER_OFFSET = "calc(0.75rem + 3px)";

export { THEME_TYPOGRAPHY };
