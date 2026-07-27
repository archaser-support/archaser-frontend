import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import { OUTLINED_INPUT_HEIGHT_PX } from "./appButton";
import { THEME_TYPOGRAPHY, TOOLBAR_CONTROL_HEIGHT } from "./constants";
import type { AppButtonThemeStyles } from "./types";

export interface ToolbarStyleBundle {
    toolbarControlRadiusPx: string;
    toolbarControlHeightPx: string;
    toolbarInputLineHeightPx: string;
    endlessScrollToolbarIconButtonStyles: SystemStyleObject<Theme>;
    endlessScrollToolbarOutlinedInputStyles: SystemStyleObject<Theme>;
    endlessScrollToolbarLabeledInputStyles: SystemStyleObject<Theme>;
    toolbarCompactTextFieldRootStyles: SystemStyleObject<Theme>;
    pickersCompactHeightStyles: SystemStyleObject<Theme>;
    /** Default picker height — matches MuiOutlinedInput / form fields (37px). */
    pickersStandardHeightStyles: SystemStyleObject<Theme>;
    pickersPillRadiusStyles: SystemStyleObject<Theme>;
    pickersIconStyles: SystemStyleObject<Theme>;
    pickersTypographyStyles: SystemStyleObject<Theme>;
    /** RTL: move default end adornment (calendar) to the visual right (html[dir=rtl]). */
    pickersRtlOpenButtonStyles: SystemStyleObject<Theme>;
    /** RTL toolbar pickers: inset calendar button so overflow:hidden does not clip the border. */
    pickersToolbarRtlPaddingStyles: SystemStyleObject<Theme>;
    /** Toolbar date pickers — same as outlined toolbar input but allow adornment to respect border radius. */
    pickersToolbarOutlinedInputStyles: SystemStyleObject<Theme>;
    /** Sections container metrics (applied after global picker typography in CssBaseline). */
    pickersToolbarSectionsContainerStyles: SystemStyleObject<Theme>;
    /** PickersTextField wrapper — same as toolbar-autocomplete-labeled. */
    pickersToolbarLabeledFieldStyles: SystemStyleObject<Theme>;
}

/** Legend gap before calendar on physical right (12 + 24 + 12). */
const PICKERS_TOOLBAR_HEBREW_END_ICON_LEGEND_INSET_PX = 48;

/** Inset calendar open button from the field outline (LTR + RTL toolbar pickers).
 * Must clear the pill radius (~half of 32px toolbar height) so the icon is not clipped. */
const PICKERS_TOOLBAR_END_ICON_INSET_PX = "12px";

export function buildToolbarStyles(
    appButton: AppButtonThemeStyles
): ToolbarStyleBundle {
    const { toolbarControl } = appButton;
    const toolbarControlRadiusPx = `${toolbarControl.borderRadius}px`;
    const toolbarControlHeightPx = `${toolbarControl.height}px`;
    const toolbarInputLineHeightPx = `${toolbarControl.height - 2}px`;

    const endlessScrollToolbarIconButtonStyles: SystemStyleObject<Theme> = {
        borderRadius: toolbarControlRadiusPx,
        height: toolbarControlHeightPx,
        width: toolbarControlHeightPx,
        minWidth: `${toolbarControl.height}px !important`,
        maxWidth: toolbarControlHeightPx,
        padding: "0 !important",
        boxSizing: "border-box",
        border: `1px solid ${toolbarControl.borderColor}`,
        color: "rgb(var(--primary-rgb))",
        backgroundColor: "#fff",
        "&:hover, &[aria-pressed='true']": {
            borderColor: "rgb(var(--primary-rgb))",
            backgroundColor: "rgba(var(--primary-rgb), 0.08)",
        },
        "&.Mui-disabled": {
            border: `1px solid ${toolbarControl.borderColor}`,
            color: "rgba(0, 0, 0, 0.38)",
            backgroundColor: "rgba(0, 0, 0, 0.12)",
        },
    };

    const endlessScrollToolbarLabeledInputStyles: SystemStyleObject<Theme> = {
        borderRadius: toolbarControlRadiusPx,
        height: `${toolbarControl.height}px !important`,
        minHeight: `${toolbarControl.height}px !important`,
        maxHeight: `${toolbarControl.height}px !important`,
        boxSizing: "border-box",
        overflow: "visible",
        backgroundColor: "transparent",
        display: "flex",
        alignItems: "center",
        padding: "0 !important",
        "& .MuiOutlinedInput-notchedOutline legend": {
            display: "block",
            maxWidth: "1000px",
        },
        "& .MuiOutlinedInput-notchedOutline legend span": {
            display: "inline",
            padding: "0 4px",
        },
        "& fieldset, & .MuiOutlinedInput-notchedOutline": {
            borderRadius: `${toolbarControlRadiusPx} !important`,
            borderWidth: "1px !important",
            overflow: "visible",
        },
        "& .MuiInputBase-input, & .MuiOutlinedInput-input, & input.MuiInputBase-inputSizeSmall":
        {
            flex: "1 1 auto",
            minWidth: 0,
            height: `${toolbarInputLineHeightPx} !important`,
            minHeight: `${toolbarInputLineHeightPx} !important`,
            maxHeight: `${toolbarInputLineHeightPx} !important`,
            lineHeight: `${toolbarInputLineHeightPx} !important`,
            fontSize: THEME_TYPOGRAPHY.FONT_SIZE_SMALL,
            boxSizing: "border-box",
            alignSelf: "center",
        },
        "&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderWidth: "1px !important",
        },
    };

    const endlessScrollToolbarOutlinedInputStyles: SystemStyleObject<Theme> = {
        borderRadius: toolbarControlRadiusPx,
        height: `${toolbarControl.height}px !important`,
        minHeight: `${toolbarControl.height}px !important`,
        maxHeight: `${toolbarControl.height}px !important`,
        boxSizing: "border-box",
        overflow: "hidden",
        backgroundColor: "transparent",
        display: "flex",
        alignItems: "center",
        padding: "0 !important",
        "& .MuiInputAdornment-root": {
            margin: "0 !important",
            paddingTop: 0,
            paddingBottom: 0,
            height: "auto !important",
            maxHeight: "none !important",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            alignSelf: "center",
            flexShrink: 0,
        },
        "&.MuiInputBase-adornedStart": {
            gap: "4px",
        },
        "& fieldset, & .MuiOutlinedInput-notchedOutline": {
            top: "0 !important",
            left: "0 !important",
            right: "0 !important",
            bottom: "0 !important",
            margin: 0,
            padding: 0,
            borderRadius: `${toolbarControlRadiusPx} !important`,
            borderWidth: "1px !important",
        },
        "& .MuiOutlinedInput-notchedOutline legend": {
            display: "none",
            maxWidth: 0,
        },
        "& .MuiOutlinedInput-notchedOutline legend span": {
            display: "none",
            padding: 0,
        },
        "& .MuiInputBase-input, & .MuiOutlinedInput-input, & input.MuiInputBase-inputSizeSmall":
        {
            flex: "1 1 auto",
            minWidth: 0,
            width: "100%",
            height: `${toolbarInputLineHeightPx} !important`,
            minHeight: `${toolbarInputLineHeightPx} !important`,
            maxHeight: `${toolbarInputLineHeightPx} !important`,
            margin: "0 !important",
            padding: `0 8px !important`,
            lineHeight: `${toolbarInputLineHeightPx} !important`,
            fontSize: THEME_TYPOGRAPHY.FONT_SIZE_SMALL,
            boxSizing: "border-box",
            alignSelf: "center",
            appearance: "none",
            WebkitAppearance: "none",
            "&::placeholder": {
                lineHeight: toolbarInputLineHeightPx,
                opacity: 1,
            },
        },
        "&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline, &.Mui-expanded fieldset, &.Mui-expanded .MuiOutlinedInput-notchedOutline":
        {
            borderWidth: "1px !important",
        },
        "&.MuiInputBase-sizeSmall": {
            height: `${toolbarControl.height}px !important`,
            minHeight: `${toolbarControl.height}px !important`,
            maxHeight: `${toolbarControl.height}px !important`,
        },
    };

    const toolbarCompactTextFieldRootStyles: SystemStyleObject<Theme> = {
        height: `${toolbarControl.height}px !important`,
        minHeight: `${toolbarControl.height}px !important`,
        maxHeight: `${toolbarControl.height}px !important`,
        margin: "0 !important",
        marginBottom: "0 !important",
        padding: 0,
        display: "inline-flex",
        alignItems: "center",
        alignSelf: "center",
        verticalAlign: "middle",
        boxSizing: "border-box",
    };

    const pickersCompactHeightStyles: SystemStyleObject<Theme> = {
        height: `${TOOLBAR_CONTROL_HEIGHT}px !important`,
        minHeight: `${TOOLBAR_CONTROL_HEIGHT}px !important`,
        maxHeight: `${TOOLBAR_CONTROL_HEIGHT}px !important`,
    };

    const pickersStandardHeightStyles: SystemStyleObject<Theme> = {
        height: `${OUTLINED_INPUT_HEIGHT_PX}px !important`,
        minHeight: `${OUTLINED_INPUT_HEIGHT_PX}px !important`,
        maxHeight: `${OUTLINED_INPUT_HEIGHT_PX}px !important`,
    };

    const pickersPillRadiusPx = `${appButton.sizeMedium.borderRadius}px`;
    const pickersPillRadiusStyles: SystemStyleObject<Theme> = {
        borderRadius: `${pickersPillRadiusPx} !important`,
        "& .MuiPickersOutlinedInput-notchedOutline": {
            borderRadius: `${pickersPillRadiusPx} !important`,
        },
    };

    const pickersIconStyles: SystemStyleObject<Theme> = {
        "& .MuiInputAdornment-root": {
            color: "rgb(var(--primary-rgb))",
            "& .MuiIconButton-root": {
                color: "inherit",
            },
            "& .MuiSvgIcon-root": {
                color: "inherit",
                fontSize: "1.25rem",
            },
        },
    };

    const pickersRtlOpenButtonStyles: SystemStyleObject<Theme> = {
        'html[dir="rtl"] &:where(.MuiPickersInputBase-adornedEnd), [dir="rtl"] &:where(.MuiPickersInputBase-adornedEnd)':
            {
                "& .MuiInputAdornment-root": {
                    order: -1,
                },
                "& .MuiPickersInputBase-sectionsContainer": {
                    order: 0,
                },
            },
    };

    /** Segment value — fill picker root height and center date segments vertically. */
    const pickersToolbarSectionsContainerStyles: SystemStyleObject<Theme> = {
        flex: "1 1 auto",
        minWidth: 0,
        alignSelf: "stretch",
        height: "100% !important",
        minHeight: "0 !important",
        maxHeight: "100% !important",
        lineHeight: `${toolbarInputLineHeightPx} !important`,
        display: "flex !important",
        alignItems: "center !important",
        margin: "0 !important",
        padding: "0 8px !important",
        boxSizing: "border-box",
    };

    const pickersToolbarSectionPartStyles: SystemStyleObject<Theme> = {
        display: "inline-flex",
        alignItems: "center",
        lineHeight: `${toolbarInputLineHeightPx} !important`,
        padding: "0 !important",
    };

    /**
     * Hebrew labels on toolbar pickers — match toolbar-autocomplete-labeled (translate 14px),
     * not form-field data-hebrew (37px height / 56px right inset).
     */
    const pickersToolbarHebrewLabelStyles: SystemStyleObject<Theme> = {
        '&[data-hebrew], &[data-hebrew="true"]': {
            "& > .MuiInputLabel-root": {
                direction: "rtl",
                textAlign: "right",
                left: "auto !important",
                right: "auto !important",
                maxWidth: "none !important",
                lineHeight: `${THEME_TYPOGRAPHY.LINE_HEIGHT_NORMAL} !important`,
                overflow: "visible !important",
                zIndex: 1,
                paddingLeft: "4px",
                paddingRight: "4px",
                backgroundColor: "#fff",
                "&:not(.MuiInputLabel-shrink)": {
                    top: 0,
                    height: `${TOOLBAR_CONTROL_HEIGHT}px !important`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    transform: "translate(14px, 0) scale(1) !important",
                    transformOrigin: "left center !important",
                },
                "&.MuiInputLabel-shrink": {
                    top: 0,
                    height: "auto !important",
                    minHeight: "14px",
                    display: "block",
                    transform: "translate(14px, -9px) scale(0.75) !important",
                    transformOrigin: "left center !important",
                    textAlign: "right !important",
                },
            },
            "& .MuiPickersOutlinedInput-notchedOutline legend": {
                display: "block",
                maxWidth: "1000px",
            },
            "& .MuiPickersOutlinedInput-notchedOutline legend span": {
                display: "inline",
                padding: "0 4px",
            },
            "&:has(.MuiPickersInputBase-adornedEnd) .MuiPickersOutlinedInput-notchedOutline legend span::before":
                {
                    right: `${PICKERS_TOOLBAR_HEBREW_END_ICON_LEGEND_INSET_PX}px !important`,
                },
        },
    };

    /** Match ToolbarDropdownFilter labeled field (visible legend, 32px, toolbar pill radius). */
    const pickersToolbarLabeledFieldStyles: SystemStyleObject<Theme> = {
        height: "auto !important",
        minHeight: "auto !important",
        maxHeight: "none !important",
        marginBottom: "0 !important",
        overflow: "visible",
        ...pickersToolbarHebrewLabelStyles,
    };

    /**
     * Toolbar pickers: use labeled toolbar input (same as date-range filter), not compact outlined (hidden legend).
     * LTR end adornment needs an explicit inset — labeled styles set padding:0, which parks the
     * calendar on the outline (RTL inset lives in pickersToolbarRtlPaddingStyles).
     */
    const pickersToolbarOutlinedInputStyles: SystemStyleObject<Theme> = {
        ...endlessScrollToolbarLabeledInputStyles,
        borderRadius: `${toolbarControlRadiusPx} !important`,
        overflow: "visible",
        display: "flex !important",
        lineHeight: `${toolbarInputLineHeightPx} !important`,
        alignItems: "stretch !important",
        "& fieldset, & .MuiPickersOutlinedInput-notchedOutline": {
            borderRadius: `${toolbarControlRadiusPx} !important`,
        },
        "& .MuiInputAdornment-root": {
            alignSelf: "center",
        },
        "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersOutlinedInput-sectionsContainer":
            pickersToolbarSectionsContainerStyles,
        "& .MuiPickersSectionList-root": pickersToolbarSectionsContainerStyles,
        "& .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersSectionList-sectionSeparator":
            pickersToolbarSectionPartStyles,
        "&:where(.MuiPickersInputBase-adornedEnd)": {
            padding: "0 !important",
            paddingRight: `${PICKERS_TOOLBAR_END_ICON_INSET_PX} !important`,
            paddingLeft: "8px !important",
            gap: "4px",
            overflow: "hidden !important",
            alignItems: "center !important",
            "& .MuiInputAdornment-root": {
                margin: "0 !important",
                marginRight: "0 !important",
                paddingTop: 0,
                paddingBottom: 0,
                paddingRight: "0 !important",
                flexShrink: 0,
                alignSelf: "center !important",
                height: "100%",
                maxHeight: "100%",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
            },
            "& .MuiInputAdornment-root .MuiIconButton-root": {
                margin: "0 !important",
            },
        },
    };

    /**
     * RTL: flex order moves the calendar to the physical right; inset icon from the border.
     * Match [dir="rtl"] on the field — not only html[dir] — so Hebrew fields always get inset.
     */
    const pickersToolbarRtlPaddingStyles: SystemStyleObject<Theme> = {
        'html[dir="rtl"] &:where(.MuiPickersInputBase-adornedEnd), [dir="rtl"] &:where(.MuiPickersInputBase-adornedEnd)':
            {
                padding: "0 !important",
                paddingRight: `${PICKERS_TOOLBAR_END_ICON_INSET_PX} !important`,
                paddingLeft: "8px !important",
                overflow: "hidden !important",
                gap: "4px",
                alignItems: "center !important",
                "& .MuiInputAdornment-root": {
                    margin: "0 !important",
                    paddingTop: 0,
                    paddingBottom: 0,
                    paddingRight: "0 !important",
                    paddingLeft: "0 !important",
                    flexShrink: 0,
                    alignSelf: "center !important",
                    height: "100%",
                    maxHeight: "100%",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                },
                "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersOutlinedInput-sectionsContainer, & .MuiPickersSectionList-root":
                    {
                        paddingRight: "4px !important",
                        paddingLeft: `${PICKERS_TOOLBAR_END_ICON_INSET_PX} !important`,
                    },
            },
    };

    const pickersTypographyStyles: SystemStyleObject<Theme> = {
        fontSize: `${THEME_TYPOGRAPHY.FONT_SIZE_SMALL} !important`,
        lineHeight: `${THEME_TYPOGRAPHY.LINE_HEIGHT_NORMAL} !important`,
        "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersOutlinedInput-sectionsContainer":
        {
            padding: "0 !important",
            minHeight: "unset !important",
            alignItems: "center",
            fontSize: "inherit !important",
            lineHeight: "inherit !important",
        },
        "& .MuiPickersSectionList-root, & .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersSectionList-sectionSeparator":
        {
            fontSize: "inherit !important",
            lineHeight: "inherit !important",
        },
    };

    return {
        toolbarControlRadiusPx,
        toolbarControlHeightPx,
        toolbarInputLineHeightPx,
        endlessScrollToolbarIconButtonStyles,
        endlessScrollToolbarOutlinedInputStyles,
        endlessScrollToolbarLabeledInputStyles,
        toolbarCompactTextFieldRootStyles,
        pickersCompactHeightStyles,
        pickersStandardHeightStyles,
        pickersPillRadiusStyles,
        pickersIconStyles,
        pickersTypographyStyles,
        pickersRtlOpenButtonStyles,
        pickersToolbarRtlPaddingStyles,
        pickersToolbarOutlinedInputStyles,
        pickersToolbarSectionsContainerStyles,
        pickersToolbarLabeledFieldStyles,
    };
}
