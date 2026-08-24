import { alpha, type Theme, type ThemeOptions } from "@mui/material/styles";

import type { SystemStyleObject } from "@mui/system";

import { DEFAULT_PRIMARY_LIGHT, THEME_TYPOGRAPHY } from "./constants";
import type { ToolbarStyleBundle } from "./toolbarStyles";
import type { AppButtonThemeStyles } from "./types";

/** Shared selectors for `data-hebrew` on TextField vs MUI X PickersTextField (v8). */
type DataHebrewFieldTargets = {
    inputRoot: string;
    notchedOutline: string;
    valueContent: string;
};

const multilineOutlinedLabelTopLtr: SystemStyleObject = {
    alignItems: "flex-start",
    height: "auto",
    transform: "translate(14px, 9px) scale(1)",
    transformOrigin: "left top",
};

const multilineOutlinedLabelTopRtl: SystemStyleObject = {
    alignItems: "flex-start",
    height: "auto",
    transform: "translate(0px, 9px) scale(1)",
    transformOrigin: "right top",
    justifyContent: "flex-end",
};

const multilineOutlinedLabelSelector =
    "&:has(.MuiInputBase-multiline) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)";

function buildDataHebrewFieldVariantStyle(
    outlinedInputHeightPx: number,
    outlinedLabelHelperOffset: string,
    targets: DataHebrewFieldTargets,
    extra?: SystemStyleObject
): SystemStyleObject {
    return {
        [targets.inputRoot]: {
            direction: "rtl",
            textAlign: "right",
        },
        "& > .MuiInputLabel-root": {
            direction: "rtl",
            textAlign: "right",
            right: "14px",
            left: "auto",
            position: "absolute",
            lineHeight: 1,
            "&:not(.MuiInputLabel-shrink)": {
                top: 0,
                height: `${outlinedInputHeightPx}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                transform: "translate(0, 0) scale(1)",
                transformOrigin: "right center",
            },
        },
        "&:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
        {
            height: "auto",
            bottom: outlinedLabelHelperOffset,
        },
        [multilineOutlinedLabelSelector]: multilineOutlinedLabelTopRtl,
        "& .MuiInputLabel-shrink": {
            transform: "translate(0, -9px) scale(0.75) !important",
            transformOrigin: "right top !important",
            right: "14px",
            left: "auto",
            top: 0,
            height: "auto",
            textAlign: "right !important",
            justifyContent: "flex-end !important",
            position: "absolute",
            width: "auto",
            maxWidth: "none",
            display: "flex",
            alignItems: "center",
        },
        [targets.notchedOutline]: {
            direction: "rtl !important",
        },
        [`${targets.notchedOutline} legend`]: {
            direction: "rtl !important",
            textAlign: "right !important",
        },
        [`${targets.notchedOutline} legend span`]: {
            direction: "rtl !important",
            textAlign: "right !important",
            position: "relative",
            "&::before": {
                content: '""',
                position: "absolute",
                top: 0,
                right: "40px",
                left: "auto",
                width: "12px",
                height: "100%",
                background: "white",
                zIndex: 1,
            },
        },
        [targets.valueContent]: {
            textAlign: "right",
            direction: "rtl",
        },
        "& .MuiFormHelperText-root": {
            direction: "rtl",
            textAlign: "right",
        },
        ...extra,
    };
}

function buildMuiTextFieldDataHebrewVariantStyle(
    outlinedInputHeightPx: number,
    outlinedLabelHelperOffset: string
): SystemStyleObject {
    return buildDataHebrewFieldVariantStyle(
        outlinedInputHeightPx,
        outlinedLabelHelperOffset,
        {
            inputRoot: "& .MuiOutlinedInput-root",
            notchedOutline: "& .MuiOutlinedInput-notchedOutline",
            valueContent: "& .MuiInputBase-input",
        },
        {
            "& .MuiSelect-select": {
                direction: "rtl",
                textAlign: "right",
            },
            "& .MuiSelect-icon": {
                right: "auto !important",
                left: "7px !important",
                position: "absolute !important",
            },
        }
    );
}

const PICKERS_HEBREW_END_ICON_LABEL_INSET_PX = 46;

function buildMuiPickersTextFieldDataHebrewVariantStyle(
    outlinedInputHeightPx: number,
    outlinedLabelHelperOffset: string,
    pickersRtlPaddingStyles: SystemStyleObject<Theme>
): SystemStyleObject {
    const pickersValueContent =
        "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersSectionList-root";
    const labelInset = `${PICKERS_HEBREW_END_ICON_LABEL_INSET_PX}px`;
    const hasCalendarEnd = "&:has(.MuiPickersInputBase-adornedEnd)";

    return buildDataHebrewFieldVariantStyle(
        outlinedInputHeightPx,
        outlinedLabelHelperOffset,
        {
            inputRoot: "& .MuiPickersOutlinedInput-root",
            notchedOutline: "& .MuiPickersOutlinedInput-notchedOutline",
            valueContent: pickersValueContent,
        },
        {
            "& .MuiPickersOutlinedInput-root":
                pickersRtlPaddingStyles as SystemStyleObject,
            [pickersValueContent]: {
                direction: "ltr",
                textAlign: "right",
                justifyContent: "flex-end",
            },
            [`${hasCalendarEnd} > .MuiInputLabel-root`]: {
                right: `${labelInset} !important`,
                maxWidth: `calc(100% - ${labelInset} - 14px)`,
            },
            [`${hasCalendarEnd} .MuiPickersOutlinedInput-notchedOutline legend span::before`]:
                { right: labelInset },
        }
    );
}

export interface ThemeComponentsContext {
    primary: string;
    appButton: AppButtonThemeStyles;
    outlinedInputHeightPx: number;
    outlinedLabelHelperOffset: string;
    colorSwatchWidthPx: number;
    colorSwatchRadiusPx: number;
    toolbar: ToolbarStyleBundle;
}

export function buildThemeComponents(ctx: ThemeComponentsContext): ThemeOptions["components"] {
    const {
        primary,
        appButton,
        outlinedInputHeightPx,
        outlinedLabelHelperOffset,
        colorSwatchWidthPx,
        colorSwatchRadiusPx,
        toolbar: {
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
        },
    } = ctx;
    const TYPOGRAPHY = THEME_TYPOGRAPHY;

    return {
        MuiButton: {
            styleOverrides: {
                root: ({ theme }) => {
                    const { borderRadius: btnRadius, sizeSmall: small } =
                        theme.appButton;
                    const smallPillRadius = small.height / 2;
                    return {
                        textTransform: "none",
                        fontWeight: 600,
                        borderRadius: btnRadius,
                        "&.MuiButton-sizeSmall": {
                            minHeight: small.minHeight,
                            height: small.height,
                            minWidth: small.minWidth,
                            px: theme.spacing(small.paddingX),
                            py: small.paddingY,
                            fontSize: small.fontSize,
                            lineHeight: small.lineHeight,
                            borderRadius: smallPillRadius,
                        },
                        // Medium (~37px): 12px radius looks square; use half-height for pill
                        "&.MuiButton-sizeMedium": {
                            borderRadius: theme.appButton.sizeMedium.borderRadius,
                        },
                        "&.MuiButton-contained": {
                            backgroundColor: theme.palette.primary.main,
                            backgroundImage: "none",
                            color: theme.palette.primary.contrastText,
                            boxShadow: "none",
                            transition: theme.transitions.create(
                                ["background-color", "border-color"],
                                { duration: theme.transitions.duration.short }
                            ),
                            "&:hover": {
                                backgroundColor: theme.palette.primary.dark,
                                backgroundImage: "none",
                                boxShadow: "none",
                                transform: "none",
                            },
                            "&:disabled": {
                                backgroundColor: "rgba(0, 0, 0, 0.12)",
                                backgroundImage: "none",
                                color: "rgba(0, 0, 0, 0.38)",
                                transform: "none",
                                boxShadow: "none",
                            },
                        },
                        "&.MuiButton-outlined": {
                            borderColor: theme.palette.primary.main,
                            color: theme.palette.primary.main,
                            "&:hover": {
                                borderColor: theme.palette.primary.dark,
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.08
                                ),
                            },
                        },
                        "&.MuiButton-text": {
                            color: theme.palette.primary.main,
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.08
                                ),
                            },
                        },
                        "&.import-action-button": {
                            background: `linear-gradient(135deg, ${primary} 0%, ${DEFAULT_PRIMARY_LIGHT} 100%)`,
                            color: "white",
                            fontWeight: 600,
                            px: 3,
                            py: 1.5,
                            borderRadius: btnRadius,
                            textTransform: "none",
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            "&:hover": {
                                background:
                                    `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.light} 100%)`,
                                transform: "translateY(-1px)",
                                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}`,
                            },
                            "&:disabled": {
                                background: "rgba(0, 0, 0, 0.12)",
                                color: "rgba(0, 0, 0, 0.38)",
                                transform: "none",
                                boxShadow: "none",
                            },
                        },
                        "&.import-remove-button": {
                            borderColor: "error.main",
                            color: "error.main",
                            fontWeight: 600,
                            px: 3,
                            py: 1.5,
                            borderRadius: btnRadius,
                            textTransform: "none",
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            "&:hover": {
                                backgroundColor: "error.50",
                                borderColor: "error.dark",
                                color: "error.dark",
                                transform: "translateY(-1px)",
                                boxShadow: "0 4px 12px rgba(244, 67, 54, 0.2)",
                            },
                        },
                        "&.cancel-button": {
                            minHeight: small.minHeight,
                            height: small.height,
                            minWidth: small.minWidth,
                            px: theme.spacing(small.paddingX),
                            py: small.paddingY,
                            fontSize: small.fontSize,
                            lineHeight: small.lineHeight,
                            borderRadius: smallPillRadius,
                            color: theme.palette.text.secondary,
                            borderColor: theme.palette.divider,
                            "&:hover": {
                                borderColor: theme.palette.text.secondary,
                                backgroundColor: theme.palette.action.hover,
                            },
                        },
                        "&.save-button": {
                            minHeight: small.minHeight,
                            height: small.height,
                            minWidth: small.minWidth,
                            px: theme.spacing(small.paddingX),
                            py: small.paddingY,
                            fontSize: small.fontSize,
                            lineHeight: small.lineHeight,
                            borderRadius: smallPillRadius,
                            backgroundColor: theme.palette.primary.main,
                            color: theme.palette.common.white,
                            fontWeight: 600,
                            textTransform: "none",
                            "&:hover": {
                                backgroundColor: theme.palette.primary.dark,
                            },
                            "&:disabled": {
                                backgroundColor: theme.palette.primary.main,
                                color: theme.palette.common.white,
                                opacity: 0.7,
                            },
                        },
                    };
                },
            },
        },
        MuiTooltip: {
            styleOverrides: {
                tooltip: ({ theme }) => ({
                    backgroundColor: "#1F2937",
                    color: "rgba(249, 250, 251, 0.96)",
                    fontSize: "0.8125rem",
                    lineHeight: 1.45,
                    padding: theme.spacing(1, 1.5),
                    borderRadius: 9,
                    boxShadow:
                        "0 4px 14px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)",
                    maxWidth: 300,
                    zIndex: 9999,
                    "& .MuiTooltip-arrow": {
                        color: "#1F2937",
                    },
                    // RTL: when document is Hebrew (html[dir="rtl"]), align tooltip content right per frontend-rtl
                    "html[dir='rtl'] &": {
                        direction: "rtl",
                        textAlign: "right",
                    },
                }),
                popper: {
                    zIndex: 9999,
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 12,
                    boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.10)",
                    border: "1px solid #E2E8F0",
                    background: "#fff",
                    "&.portalCard": ({ theme }: { theme: Theme }) => ({
                        borderRadius: theme.spacing(3),
                        boxShadow: "none",
                        backgroundImage: "none",
                        "--Paper-shadow": "none",
                        border: `1px solid ${theme.palette.divider}`,
                        backgroundColor: theme.palette.background.paper,
                        overflow: "hidden",
                    }),
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: {
                    borderRadius: 2,
                    border: "none",
                    maxWidth: "600px",
                    width: "100%",
                    "@media (min-width: 600px)": {
                        height: "auto",
                        maxHeight: "90vh",
                        margin: 16,
                    },
                    "@media (max-width: 599px)": {
                        height: "100%",
                        maxHeight: "100%",
                        margin: 0,
                    },
                },
            },
        },
        MuiDialogTitle: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontWeight: 400,
                    color: "white",
                    pb: 0, // No bottom padding
                    borderBottom: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                    "@media (min-width: 600px)": {
                        fontSize: "1.25rem",
                        padding: "10px 24px 0px 40px", // top, right, bottom, left (LTR)
                    },
                    "@media (max-width: 599px)": {
                        fontSize: "1rem",
                        padding: "10px 20px 0px 40px", // top, right, bottom, left (LTR)
                    },
                    // RTL-aware padding: swap left/right for RTL direction
                    // In RTL: padding-right becomes visual left, padding-left becomes visual right
                    // Target when DialogTitle is inside a parent Dialog with dir="rtl" set on PaperProps
                    // Note: This selector targets when any ancestor has dir="rtl"
                    "&[dir='rtl'], [dir='rtl'] &": {
                        "@media (min-width: 600px)": {
                            padding: "10px 40px 0px 24px", // top, right(visual left), bottom, left(visual right)
                        },
                        "@media (max-width: 599px)": {
                            padding: "10px 40px 0px 20px", // top, right(visual left), bottom, left(visual right)
                        },
                    },
                    // Override Typography styles when DialogTitle uses component="h2"
                    "&.MuiTypography-root": {
                        fontWeight: 400,
                        "@media (min-width: 600px)": {
                            fontSize: "1.25rem",
                        },
                        "@media (max-width: 599px)": {
                            fontSize: "1rem",
                        },
                    },
                    "& .MuiSvgIcon-root": {
                        color: "white",
                        fontSize: "1.5rem",
                        height: "1.5rem",
                        width: "1.5rem",
                    },
                }),
            },
        },

        MuiDialogContent: {
            styleOverrides: {
                root: {
                    overflow: "auto",
                    "@media (min-width: 600px)": {
                        padding: "12px 16px",
                    },
                    "@media (max-width: 599px)": {
                        padding: "8px 12px",
                    },
                },
            },
        },
        MuiDialogActions: {
            styleOverrides: {
                root: ({ theme }) => {
                    const small = theme.appButton.sizeSmall;
                    const dialogPillRadius = small.height / 2;
                    return {
                        borderTop: "none",
                        // Match sizeSmall pill shape on Cancel (medium) and Next (small)
                        "& .MuiButton-root": {
                            minHeight: small.minHeight,
                            height: small.height,
                            minWidth: small.minWidth,
                            px: theme.spacing(small.paddingX),
                            py: small.paddingY,
                            fontSize: small.fontSize,
                            lineHeight: small.lineHeight,
                            borderRadius: dialogPillRadius,
                            textTransform: "none",
                            fontWeight: 600,
                        },
                        "@media (min-width: 600px)": {
                            padding: "12px 16px",
                            paddingTop: 0,
                            flexDirection: "row",
                            gap: 0,
                        },
                        "@media (max-width: 599px)": {
                            padding: "8px 12px",
                            paddingTop: 0,
                            flexDirection: "column",
                            gap: 8,
                        },
                    };
                },
            },
        },
        MuiTextField: {
            styleOverrides: {
                root: {
                    ".toolbar-autocomplete-labeled &": {
                        height: "auto !important",
                        minHeight: "auto !important",
                        maxHeight: "none !important",
                        overflow: "visible",
                    },
                    "&.toolbar-search-field": toolbarCompactTextFieldRootStyles,
                    ".endless-scroll-toolbar &": toolbarCompactTextFieldRootStyles,
                    "& .MuiInputBase-root:not(.input-toolbar-height)": {
                        height: `${outlinedInputHeightPx}px`,
                        minHeight: `${outlinedInputHeightPx}px`,
                    },
                    "& > .MuiInputLabel-root": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        lineHeight: 1,
                        "&:not(.MuiInputLabel-shrink)": {
                            top: 0,
                            height: `${outlinedInputHeightPx}px`,
                            display: "flex",
                            alignItems: "center",
                            transform: "translate(14px, 0) scale(1)",
                            transformOrigin: "left center",
                        },
                        "&.MuiInputLabel-shrink": {
                            top: 0,
                            height: "auto",
                            display: "block",
                            transform: "translate(14px, -9px) scale(0.75)",
                        },
                    },
                    "&:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                    {
                        height: "auto",
                        bottom: outlinedLabelHelperOffset,
                    },
                    [multilineOutlinedLabelSelector]: multilineOutlinedLabelTopLtr,
                    "& .MuiInputBase-input": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    },
                    "& .MuiInputBase-root.MuiInputBase-multiline": {
                        minHeight: "56px",
                        height: "auto", // Override the fixed height for multiline
                        padding: "0 !important", // Remove conflicting padding
                    },
                    "& .MuiInputBase-inputMultiline": {
                        padding: "0", // Remove default padding from the input itself
                        paddingLeft: "14px !important",
                        paddingRight: "14px !important",
                        paddingTop: "5px !important",
                    },
                    // Target textarea element directly
                    "& textarea": {
                        paddingLeft: "14px !important",
                        paddingRight: "14px !important",
                    },
                },
            },
            variants: [
                {
                    props: { size: "small" } as any,
                    style: {
                        "& .MuiInputBase-root:not(.input-toolbar-height)": {
                            height: {
                                xs: "18px",
                                sm: "22px",
                                md: `${outlinedInputHeightPx}px`,
                            },
                            minHeight: {
                                xs: "18px",
                                sm: "22px",
                                md: `${outlinedInputHeightPx}px`,
                            },
                        },
                        "& > .MuiInputLabel-root": {
                            lineHeight: 1,
                            "&:not(.MuiInputLabel-shrink)": {
                                top: 0,
                                display: "flex",
                                alignItems: "center",
                                transform: "translate(14px, 0) scale(1)",
                                transformOrigin: "left center",
                                height: {
                                    xs: "18px",
                                    sm: "22px",
                                    md: `${outlinedInputHeightPx}px`,
                                },
                            },
                            "&.MuiInputLabel-shrink": {
                                top: 0,
                                height: "auto",
                                display: "block",
                                transform: "translate(14px, -9px) scale(0.75)",
                            },
                        },
                        "&:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                        {
                            height: "auto",
                            bottom: outlinedLabelHelperOffset,
                        },
                        [multilineOutlinedLabelSelector]: multilineOutlinedLabelTopLtr,
                        "& .MuiInputBase-root.input-toolbar-height .MuiInputBase-input, & .MuiInputBase-root.input-toolbar-height .MuiInputBase-inputSizeSmall":
                        {
                            padding: "0 8px !important",
                            margin: 0,
                        },
                        "&[data-rtl] .MuiInputBase-root.input-toolbar-height .MuiInputBase-input, &[data-rtl] .MuiInputBase-root.input-toolbar-height .MuiInputBase-inputSizeSmall":
                        {
                            padding: "0 !important",
                            paddingInlineEnd: "8px !important",
                            margin: 0,
                        },
                        "& .MuiInputBase-root:not(.input-toolbar-height) .MuiInputBase-input":
                        {
                            padding: {
                                xs: "2px 8px",
                                sm: "3px 8px",
                                md: "4px 8px",
                            },
                            fontSize: {
                                xs: "0.75rem",
                                sm: "0.8rem",
                                md: "0.875rem",
                            },
                        },
                    },
                },
                {
                    props: { size: "medium" } as any,
                    style: {
                        "& .MuiInputBase-root:not(.input-toolbar-height)": {
                            height: "56px",
                            minHeight: "56px",
                        },
                        "& .MuiInputLabel-root": {
                            transform: "translate(14px, 20px) scale(1)",
                            "&.Mui-focused, &.MuiFormLabel-filled": {
                                transform: "translate(14px, -9px) scale(0.75)",
                            },
                        },
                        [multilineOutlinedLabelSelector]: multilineOutlinedLabelTopLtr,
                    },
                },
                {
                    props: { "data-hebrew": true } as any,
                    style: buildMuiTextFieldDataHebrewVariantStyle(
                        outlinedInputHeightPx,
                        outlinedLabelHelperOffset
                    ) as any,
                },
                {
                    props: { "data-hebrew": true, size: "medium" } as any,
                    style: {
                        "& .MuiInputBase-root": {
                            height: "56px",
                            minHeight: "56px",
                        },
                        // Note: All other RTL styling is inherited from the general "data-hebrew" variant above
                    },
                },
                {
                    props: { "data-hebrew": true, multiline: true } as any,
                    style: {
                        "& .MuiInputLabel-root": {
                            direction: "rtl",
                            textAlign: "right",
                            right: "14px",
                            left: "auto",
                            top: "0px !important",
                            transform:
                                "translate(0px, 9px) scale(1) !important",
                            position: "absolute",
                        },
                        "& .MuiInputLabel-shrink": {
                            transform:
                                "translate(0px, -9px) scale(0.75) !important",
                            transformOrigin: "right top",
                            top: "0px !important",
                        },
                        "& .MuiInputBase-input": {
                            direction: "rtl",
                            textAlign: "right",
                        },
                    },
                },
            ],
        },
        // MUI X PickersTextField has no `variants` API — mirror MuiTextField `data-hebrew` via attribute selector.
        MuiPickersTextField: {
            styleOverrides: {
                root: {
                    '&[data-hebrew="true"], &[data-hebrew]': buildMuiPickersTextFieldDataHebrewVariantStyle(
                        outlinedInputHeightPx,
                        outlinedLabelHelperOffset,
                        pickersToolbarRtlPaddingStyles
                    ),
                },
            },
        },
        MuiAutocomplete: {
            styleOverrides: {
                root: ({ theme }) => {
                    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
                    return {
                        "& .MuiOutlinedInput-root:not(.input-toolbar-height)": {
                            minHeight: theme.spacing(4), // Keep minimum height
                            borderRadius: pillRadiusPx,
                            "& fieldset": {
                                borderColor: theme.palette.divider,
                                borderRadius: pillRadiusPx,
                            },
                            "&:hover fieldset": {
                                borderColor: theme.palette.primary.main,
                            },
                            "&.Mui-focused fieldset": {
                                borderColor: theme.palette.primary.main,
                                borderWidth: 2,
                            },
                        },
                        "& .MuiOutlinedInput-root.input-toolbar-height": {
                            overflow: "hidden",
                            "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                margin: 0,
                                borderWidth: "1px !important",
                            },
                            "&.Mui-focused fieldset, &.Mui-focused .MuiOutlinedInput-notchedOutline, &.Mui-expanded fieldset, &.Mui-expanded .MuiOutlinedInput-notchedOutline":
                            {
                                borderWidth: "1px !important",
                            },
                        },
                        "& .MuiOutlinedInput-root.input-toolbar-labeled": {
                            overflow: "visible",
                            "& fieldset, & .MuiOutlinedInput-notchedOutline": {
                                overflow: "visible",
                            },
                            "& .MuiOutlinedInput-notchedOutline legend": {
                                display: "block",
                                maxWidth: "1000px",
                            },
                            "& .MuiOutlinedInput-notchedOutline legend span": {
                                display: "inline",
                                padding: "0 4px",
                            },
                        },
                        "&.toolbar-autocomplete-labeled": {
                            overflow: "visible",
                            "& .MuiTextField-root": {
                                height: "auto !important",
                                minHeight: "auto !important",
                                maxHeight: "none !important",
                                overflow: "visible",
                            },
                            "& .MuiTextField-root > .MuiInputLabel-root": {
                                lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                                overflow: "visible",
                                "&.MuiInputLabel-shrink": {
                                    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                                    overflow: "visible",
                                    height: "auto !important",
                                    minHeight: "14px",
                                },
                            },
                        },
                        "& .MuiTextField-root > .MuiInputLabel-root": {
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            color: theme.palette.primary.main,
                            lineHeight: 1,
                            "&:not(.MuiInputLabel-shrink)": {
                                top: 0,
                                height: `${outlinedInputHeightPx}px`,
                                display: "flex",
                                alignItems: "center",
                                transform: "translate(14px, 0) scale(1)",
                                transformOrigin: "left center",
                            },
                            "&.MuiInputLabel-shrink": {
                                top: 0,
                                height: "auto",
                                display: "block",
                                transform: "translate(14px, -9px) scale(0.75)",
                                color: theme.palette.primary.main,
                            },
                        },
                        "& .MuiTextField-root:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                        {
                            height: "auto",
                            bottom: outlinedLabelHelperOffset,
                        },
                        "& .MuiAutocomplete-input, & .MuiAutocomplete-inputRoot, & .MuiInputBase-input":
                        {
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            color: theme.palette.text.primary,
                            paddingLeft: "14px !important",
                            paddingRight: "14px !important",
                        },
                        // Ensure input root doesn't have conflicting padding
                        "& .MuiAutocomplete-inputRoot": {
                            paddingLeft: "0 !important",
                            paddingRight: "0 !important",
                            "& .MuiOutlinedInput-input": {
                                paddingLeft: "14px !important",
                                paddingRight: "14px !important",
                            },
                            "& input": {
                                paddingLeft: "14px !important",
                                paddingRight: "14px !important",
                            },
                        },
                        "& .MuiAutocomplete-endAdornment": {
                            top: "50%",
                            transform: "translateY(-50%)",
                            color: theme.palette.primary.main,
                        },
                        // RTL Contact Field Styling - Override MUI's default 65px padding
                        "&.MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiOutlinedInput-root":
                        {
                            paddingRight: theme.spacing(1.875),
                            paddingLeft: theme.spacing(1.875),
                        },
                        "& .MuiTextField-root .MuiOutlinedInput-root": {
                            borderRadius: pillRadiusPx,
                            "& fieldset": {
                                borderRadius: pillRadiusPx,
                            },
                        },
                    };
                },
                paper: ({ theme }) => ({
                    backgroundColor: theme.palette.background.paper,
                    border: "1px solid",
                    borderColor: theme.palette.divider,
                    borderRadius:
                        theme.appButton.dropdownListBorderRadius,
                    boxShadow: theme.shadows[8],
                    "& .MuiAutocomplete-listbox": {
                        padding: 0,
                        "& .MuiAutocomplete-option": {
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            minHeight: theme.spacing(4), // 32px - Reduced height
                            padding: theme.spacing(1, 2),
                            lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                            display: "flex",
                            alignItems: "center",
                            cursor: "pointer",
                            color: theme.palette.text.primary,
                            "&:hover": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.15
                                ),
                            },
                            "&.Mui-focused": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.15
                                ),
                            },
                            "&.Mui-selected": {
                                backgroundColor: alpha(
                                    theme.palette.primary.main,
                                    0.08
                                ),
                                "&:hover": {
                                    backgroundColor: alpha(
                                        theme.palette.primary.main,
                                        0.15
                                    ),
                                },
                            },
                            "& .MuiTypography-root": {
                                fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                                lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                                color: theme.palette.text.primary,
                            },
                        },
                    },
                }),
                option: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    minHeight: theme.spacing(6), // 48px
                    padding: theme.spacing(1, 2),
                    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    color: theme.palette.text.primary,
                    "&:hover": {
                        backgroundColor: theme.palette.action.hover,
                    },
                    "&.Mui-focused": {
                        backgroundColor: theme.palette.action.hover,
                    },
                    "&.Mui-selected": {
                        backgroundColor: theme.palette.action.selected,
                        "&:hover": {
                            backgroundColor: theme.palette.action.hover,
                        },
                    },
                    "& .MuiTypography-root": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                        color: theme.palette.text.primary,
                    },
                }),
                clearIndicator: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    color: theme.palette.text.secondary,
                }),
                popupIndicator: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    color: theme.palette.primary.main,
                }),
                popper: ({ theme }) => ({
                    "& .MuiAutocomplete-paper": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    },
                }),
            },
            variants: [
                {
                    props: { "data-rtl": true } as any,
                    style: ({ theme }) => ({
                        // RTL dropdown icon positioning for Autocomplete
                        "& .MuiAutocomplete-endAdornment": {
                            right: "auto !important",
                            left: theme.spacing(1.5),
                            position: "absolute !important",
                            top: "50% !important",
                            transform: "translateY(-50%) !important",
                        },
                        // RTL text alignment for all input elements
                        "& .MuiOutlinedInput-input, & .MuiInputBase-input, & input":
                        {
                            textAlign: "right !important",
                            direction: "rtl !important",
                        },
                        // RTL outline direction
                        "& .MuiOutlinedInput-notchedOutline": {
                            direction: "rtl !important",
                        },
                        "& .MuiOutlinedInput-notchedOutline legend": {
                            direction: "rtl !important",
                            textAlign: "right !important",
                        },
                        "& .MuiOutlinedInput-notchedOutline legend span": {
                            direction: "rtl !important",
                            textAlign: "right !important",
                        },
                        // RTL label positioning for TextField components
                        "& .MuiTextField-root > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                        {
                            right: "14px",
                            left: "auto !important",
                            top: "0 !important",
                            height: `${outlinedInputHeightPx}px`,
                            display: "flex !important",
                            alignItems: "center !important",
                            justifyContent: "flex-end !important",
                            transform: "translate(0, 0) scale(1) !important",
                            transformOrigin: "right center !important",
                            textAlign: "right !important",
                            direction: "rtl !important",
                        },
                        "& .MuiTextField-root:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                        {
                            height: "auto !important",
                            bottom: `${outlinedLabelHelperOffset} !important`,
                        },
                        "& .MuiTextField-root .MuiInputLabel-shrink": {
                            transform:
                                "translate(0px, -9px) scale(0.75) !important",
                            transformOrigin: "right top !important",
                            right: "14px",
                            left: "auto !important",
                            textAlign: "right !important",
                            justifyContent: "flex-end !important",
                            position: "absolute !important",
                            width: "auto",
                            maxWidth: "none",
                            display: "flex",
                            alignItems: "center",
                            direction: "rtl !important",
                            backgroundColor: "white",
                            padding: `0 ${theme.spacing(0.5)}`,
                            zIndex: 1,
                            marginLeft: "auto !important",
                            marginRight: "0 !important",
                        },
                    }),
                },
                {
                    props: { size: "small" } as any,
                    style: ({ theme }) => ({
                        "& .MuiOutlinedInput-root:not(.input-toolbar-height)":
                        {
                            height: { xs: "18px", sm: "22px", md: "26px" },
                            minHeight: { xs: "18px", sm: "22px", md: "26px" },
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiAutocomplete-input, & .MuiAutocomplete-inputRoot, & .MuiInputBase-input":
                        {
                            padding: {
                                xs: "2px 8px",
                                sm: "3px 8px",
                                md: "4px 8px",
                            },
                            fontSize: {
                                xs: "0.75rem",
                                sm: "0.8rem",
                                md: "0.875rem",
                            },
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiInputAdornment-root": {
                            height: "100%",
                            maxHeight: "100%",
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiAutocomplete-endAdornment": {
                            height: "100%",
                            maxHeight: "100%",
                            display: "flex",
                            alignItems: "center",
                        },
                    }),
                },
            ],
        },
        MuiLink: {
            styleOverrides: {
                root: {
                    color: "primary.main",
                    textDecoration: "none",
                    "&:hover": {
                        textDecoration: "underline",
                    },
                    // Portal-specific link styles
                    "&.portalLink": {
                        color: primary,
                        textDecoration: "none",
                        "&:hover": {
                            textDecoration: "underline",
                        },
                        transition: "color 0.3s ease-in-out",
                    },
                },
            },
        },
        MuiMenuItem: {
            styleOverrides: {
                root: ({ theme }) => ({
                    color: theme.palette.text.primary,
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                    minHeight: theme.spacing(4), // 32px - Reduced height
                    padding: theme.spacing(1, 2), // 8px 16px
                    borderRadius: theme.shape.borderRadius,
                    display: "flex",
                    alignItems: "center",
                    cursor: "pointer",
                    "&:hover": {
                        backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.15
                        ),
                    },
                    "&.Mui-focused": {
                        backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.15
                        ),
                    },
                    "&.Mui-selected": {
                        backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.08
                        ),
                        color: theme.palette.text.primary,
                        "&:hover": {
                            backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.15
                            ),
                        },
                    },
                }),
            },
        },
        MuiListItemText: {
            styleOverrides: {
                root: {
                    "& .MuiListItemText-primary": {
                        color: "inherit",
                    },
                    "& .MuiListItemText-secondary": {
                        color: "rgba(255, 255, 255, 0.7)",
                    },
                },
            },
        },

        MuiList: {
            styleOverrides: {
                root: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                },
            },
        },
        MuiFormControlLabel: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    ".endless-scroll-toolbar &": {
                        margin: 0,
                        height: toolbarControlHeightPx,
                        minHeight: toolbarControlHeightPx,
                        alignItems: "center",
                        "& .MuiFormControlLabel-label": {
                            color: theme.palette.text.primary,
                            marginInlineStart: theme.spacing(1),
                            marginInlineEnd: 0,
                        },
                    },
                }),
                label: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                },
            },
        },
        MuiTypography: {
            styleOverrides: {
                root: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    // Portal-specific typography classes
                    "&.portalPageTitle": {
                        fontSize: { xs: "1.5rem", sm: "2rem" },
                        fontWeight: 700,
                        color: "primary.main",
                        textAlign: "center",
                        marginBottom: "12px",
                        lineHeight: 1.2,
                    },
                    "&.portalPageSubtitle": {
                        fontSize: { xs: "1rem", sm: "1.125rem" },
                        fontWeight: 400,
                        color: "text.secondary",
                        textAlign: "center",
                        marginBottom: "24px",
                        lineHeight: 1.5,
                    },
                    "&.portalSectionTitle": {
                        fontSize: { xs: "1.25rem", sm: "1.5rem" },
                        fontWeight: 600,
                        color: "text.primary",
                        marginBottom: "16px",
                        lineHeight: 1.3,
                    },
                    "&.portalCardTitle": {
                        fontSize: "1.125rem",
                        fontWeight: 600,
                        color: "text.primary",
                        marginBottom: "8px",
                        lineHeight: 1.4,
                    },
                    "&.portalCardSubtitle": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        fontWeight: 400,
                        color: "text.secondary",
                        lineHeight: 1.5,
                    },
                    "&.portalActionButton": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        fontWeight: 600,
                        textTransform: "none",
                        color: "primary.main",
                    },
                    "&.portalStatusText": {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        fontWeight: 500,
                        lineHeight: 1.4,
                    },
                    // PageHeader variants — root fontSize (0.875rem) otherwise wins over typography variants
                    "&.MuiTypography-listPageHeaderTitle": {
                        fontSize: "1.75rem",
                        fontWeight: 700,
                        lineHeight: 1.2,
                    },
                    "&.MuiTypography-listPageHeaderDescription": {
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        lineHeight: 1.5,
                    },
                    "&.MuiTypography-hebrewTitle": {
                        fontSize: "1.75rem",
                        fontWeight: 700,
                        lineHeight: 1.2,
                    },
                    "&.MuiTypography-hebrewSubtitle": {
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        lineHeight: 1.5,
                    },
                },
                subtitle2: {
                    fontWeight: 600,
                },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    "&:not(.MuiInputBase-multiline):not(.input-toolbar-height):not(.MuiOutlinedInput-root)":
                    {
                        height: "32px !important",
                        minHeight: "32px !important",
                        maxHeight: "32px !important",
                    },
                    "&.input-toolbar-height:not(.MuiInputBase-multiline)":
                        endlessScrollToolbarOutlinedInputStyles,
                    "&.input-toolbar-labeled:not(.MuiInputBase-multiline)":
                        endlessScrollToolbarLabeledInputStyles,
                },
                input: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    paddingLeft: "14px !important",
                },
                // Multiline input styling
                multiline: {
                    paddingLeft: "14px !important",
                    paddingRight: "14px !important",
                    "& textarea": {
                        paddingLeft: "14px !important",
                        paddingRight: "14px !important",
                    },
                },
            },
        },
        MuiPickersInputBase: {
            styleOverrides: {
                root: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                },
                sectionsContainer: {
                    padding: 0,
                    minHeight: "unset",
                    display: "flex",
                    alignItems: "center",
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
                sectionContent: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                    letterSpacing: "normal",
                },
                sectionBefore: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
                sectionAfter: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
            },
        },
        MuiPickersOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => {
                    const toolbarInputLineHeightPx = `${
                        theme.appButton.toolbarControl.height - 2
                    }px`;
                    return {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        lineHeight: TYPOGRAPHY.LINE_HEIGHT_NORMAL,
                        borderRadius: theme.appButton.sizeMedium.borderRadius,
                        "& .MuiInputAdornment-root": {
                            color: theme.palette.primary.main,
                            "& .MuiIconButton-root": {
                                color: "inherit",
                            },
                            "& .MuiSvgIcon-root": {
                                color: "inherit",
                                fontSize: "1.25rem",
                            },
                        },
                        ".endless-scroll-toolbar &": {
                            borderRadius: `${theme.appButton.toolbarControl.borderRadius}px !important`,
                            display: "flex",
                            lineHeight: toolbarInputLineHeightPx,
                            alignItems: "stretch",
                            "& fieldset, & .MuiPickersOutlinedInput-notchedOutline": {
                                borderRadius: `${theme.appButton.toolbarControl.borderRadius}px !important`,
                            },
                            "& .MuiInputAdornment-root": {
                                color: "rgb(var(--primary-rgb))",
                                alignSelf: "center",
                                "& .MuiIconButton-root": {
                                    color: "inherit",
                                },
                                "& .MuiSvgIcon-root": {
                                    color: "inherit",
                                    fontSize: "1.125rem",
                                },
                            },
                            "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersSectionList-root":
                                {
                                    flex: "1 1 auto",
                                    minWidth: 0,
                                    alignSelf: "stretch",
                                    height: "100%",
                                    minHeight: 0,
                                    maxHeight: "100%",
                                    lineHeight: toolbarInputLineHeightPx,
                                    display: "flex",
                                    alignItems: "center",
                                    margin: 0,
                                    padding: "0 8px",
                                    boxSizing: "border-box",
                                },
                            'html[dir="rtl"] &, [dir="rtl"] &': {
                                "& .MuiPickersInputBase-sectionsContainer, & .MuiPickersSectionList-root":
                                    {
                                        padding: "0 4px 0 8px",
                                    },
                            },
                            "& .MuiPickersSectionList-section, & .MuiPickersSectionList-sectionContent, & .MuiPickersSectionList-sectionSeparator":
                                {
                                    display: "inline-flex",
                                    alignItems: "center",
                                    lineHeight: toolbarInputLineHeightPx,
                                    padding: 0,
                                },
                        },
                    };
                },
                notchedOutline: ({ theme }) => ({
                    borderRadius: theme.appButton.sizeMedium.borderRadius,
                    ".endless-scroll-toolbar .MuiPickersOutlinedInput-root &": {
                        borderRadius: `${theme.appButton.toolbarControl.borderRadius}px !important`,
                    },
                }),
            },
        },
        MuiPickersSectionList: {
            styleOverrides: {
                root: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
                section: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
                sectionContent: {
                    fontSize: "inherit",
                    lineHeight: "inherit",
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundColor: "#fff",
                    borderRadius: "8px",
                },
            },
        },
        MuiButtonBase: {
            styleOverrides: {
                root: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                },
            },
        },
        MuiPopover: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    borderRadius:
                        theme.appButton.dropdownListBorderRadius,
                    overflow: "hidden",
                }),
            },
        },
        MuiMenu: {
            styleOverrides: {
                paper: ({ theme }) => ({
                    backgroundColor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius:
                        theme.appButton.dropdownListBorderRadius,
                    overflow: "hidden",
                    boxShadow:
                        "0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)",
                    "& .MuiList-root": {
                        padding: 0,
                    },
                    "& .MuiMenuItem-root": {
                        "& .MuiListItemText-root .MuiListItemText-primary": {
                            color: "inherit",
                        },
                        "& .MuiListItemText-root .MuiListItemText-secondary": {
                            color: "rgba(0, 0, 0, 0.6)",
                        },
                    },
                }),
            },
            variants: [
                {
                    props: { className: "avatar-menu" },
                    style: {
                        "& .MuiPaper-root": {
                            backgroundColor: "transparent",
                            backdropFilter: "blur(20px)",
                            border: "none",
                            borderRadius: 3,
                            overflow: "hidden",
                            minWidth: 280,
                            "& .MuiMenuItem-root": {
                                color: "white",
                                "&:hover": {
                                    backgroundColor: "rgba(255, 255, 255, 0.1)",
                                },
                                "& .MuiListItemText-root .MuiListItemText-primary":
                                {
                                    color: "white !important",
                                },
                                "& .MuiListItemText-root .MuiListItemText-secondary":
                                {
                                    color: "rgba(255, 255, 255, 0.7) !important",
                                },
                            },
                        },
                    },
                },
            ],
        },
        // Consolidated Dropdown Styling - All dropdowns use consistent styling
        MuiSelect: {
            styleOverrides: {
                select: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    padding: theme.spacing(0, 1.75),
                    height: "100%",
                    minHeight: "unset",
                    boxSizing: "border-box",
                    color: theme.palette.text.primary,
                    width: "100%",
                    minWidth: "100%",
                    maxWidth: "100%",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    "&:focus": {
                        backgroundColor: "transparent",
                    },
                }),
                // Multi-select specific override
                multiple: ({ theme }) => ({
                    "&.MuiSelect-select": {
                        padding: "4px 14px !important",
                    },
                }),
                icon: ({ theme }) => ({
                    fontSize: "1.25rem",
                    color: theme.palette.primary.main,
                    top: "50%",
                    transform: "translateY(-50%)",
                }),
                outlined: ({ theme }) => ({
                    padding: theme.spacing(1, 1.75),
                }),
            },
            variants: [
                {
                    // Multi-select variant - targets Select components with multiple prop
                    props: { multiple: true },
                    style: ({ theme }) => ({
                        // Style the container Box that holds chips
                        "& .MuiSelect-select .MuiBox-root": {
                            display: "flex",
                            flexWrap: "wrap",
                            gap: theme.spacing(0.5),
                            maxHeight: 60,
                            overflow: "auto",
                        },
                        // Style placeholder Typography
                        "& .MuiSelect-select .MuiTypography-root": {
                            fontStyle: "italic",
                        },
                    }),
                },
            ],
        },
        MuiOutlinedInput: {
            styleOverrides: {
                root: ({ theme }) => {
                    const pillRadiusPx = `${theme.appButton.sizeMedium.borderRadius}px`;
                    const cardRadiusPx = `${theme.appButton.borderRadius}px`;
                    return {
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        "&:not(.MuiInputBase-multiline):not(.input-toolbar-height)":
                        {
                            height: `${outlinedInputHeightPx}px !important`,
                            minHeight: `${outlinedInputHeightPx}px !important`,
                            maxHeight: `${outlinedInputHeightPx}px !important`,
                            borderRadius: pillRadiusPx,
                        },
                        ".endless-scroll-toolbar &:not(.MuiInputBase-multiline)":
                            endlessScrollToolbarOutlinedInputStyles,
                        "&.input-toolbar-height:not(.MuiInputBase-multiline)":
                            endlessScrollToolbarOutlinedInputStyles,
                        "&.MuiInputBase-multiline": {
                            borderRadius: cardRadiusPx,
                        },
                        "&:not(.MuiInputBase-multiline):not(.input-toolbar-height) .MuiOutlinedInput-notchedOutline":
                        {
                            borderRadius: pillRadiusPx,
                        },
                        ".endless-scroll-toolbar &:not(.MuiInputBase-multiline) .MuiOutlinedInput-notchedOutline, &.input-toolbar-height:not(.MuiInputBase-multiline) .MuiOutlinedInput-notchedOutline":
                        {
                            borderRadius: `${theme.appButton.toolbarControl.borderRadius}px !important`,
                        },
                        "&.MuiInputBase-multiline .MuiOutlinedInput-notchedOutline":
                        {
                            borderRadius: cardRadiusPx,
                        },
                        "&:has(.MuiSelect-select)": {
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiOutlinedInput-notchedOutline": {
                            borderColor: `${theme.palette.primary.main}20`,
                            borderWidth: "1px",
                        },
                        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                            borderColor: `${theme.palette.primary.main}60`,
                            borderWidth: "1px",
                        },
                        "&:hover .MuiOutlinedInput-notchedOutline": {
                            borderColor: `${theme.palette.primary.main}40`,
                            borderWidth: "1px",
                        },
                        /** Native color input — pill swatch, same height as other size="small" fields */
                        "&.color-swatch-input": {
                            width: colorSwatchWidthPx,
                            minWidth: colorSwatchWidthPx,
                            height: `${outlinedInputHeightPx}px !important`,
                            minHeight: `${outlinedInputHeightPx}px !important`,
                            maxHeight: `${outlinedInputHeightPx}px !important`,
                            padding: 0,
                            borderRadius: `${colorSwatchRadiusPx}px`,
                            overflow: "hidden",
                            "& .MuiOutlinedInput-notchedOutline": {
                                borderRadius: `${colorSwatchRadiusPx}px`,
                            },
                            "& .MuiOutlinedInput-input": {
                                width: "100%",
                                minWidth: "100%",
                                height: "100%",
                                minHeight: "100%",
                                padding: "0 !important",
                                paddingLeft: "0 !important",
                                paddingRight: "0 !important",
                                border: "none",
                                borderRadius: `${colorSwatchRadiusPx}px`,
                                cursor: "pointer",
                                boxSizing: "border-box",
                                "&::-webkit-color-swatch-wrapper": {
                                    padding: 0,
                                },
                                "&::-webkit-color-swatch": {
                                    border: "none",
                                    borderRadius: `${colorSwatchRadiusPx}px`,
                                },
                                "&::-moz-color-swatch": {
                                    border: "none",
                                    borderRadius: `${colorSwatchRadiusPx}px`,
                                },
                            },
                        },
                    };
                },
                input: {
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    paddingLeft: "14px !important",
                    "&[type='color']": {
                        padding: "0 !important",
                        paddingLeft: "0 !important",
                    },
                },
                // Multiline input styling
                multiline: {
                    paddingLeft: "14px !important",
                    paddingRight: "14px !important",
                    "& textarea": {
                        paddingLeft: "14px !important",
                        paddingRight: "14px !important",
                    },
                },
            },
        },
        MuiInputLabel: {
            styleOverrides: {
                root: ({ theme }) => ({
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    color: theme.palette.primary.main,
                    "&.Mui-focused": {
                        color: theme.palette.primary.main,
                    },
                    "&.Mui-required": {
                        "&::after": {
                            content: "none",
                        },
                    },
                }),
                outlined: {
                    "&.MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                    },
                },
            },
        },
        MuiInputAdornment: {
            styleOverrides: {
                root: {
                    color: "rgba(var(--primary-rgb), 0.5)",
                    "& .MuiSvgIcon-root": {
                        fontSize: "1.25rem",
                    },
                },
            },
        },
        MuiCssBaseline: {
            styleOverrides: {
                ":root": {
                    // Style chips in multi-select Select components
                    // Uses CSS variable set dynamically by AccountThemeProvider so the
                    // color always reflects the account's actual primary, not the SSR default.
                    ".MuiSelect-multiple .MuiChip-root": {
                        backgroundColor: "rgb(var(--primary-rgb)) !important",
                        color: "#FFFFFF !important",
                        height: "24px !important",
                        borderRadius: "12px !important",
                        "& .MuiChip-label": {
                            paddingTop: 0,
                            paddingBottom: 0,
                            paddingLeft: "6px",
                            paddingRight: "6px",
                            fontSize: "0.75rem",
                        },
                        "& .MuiChip-deleteIcon": {
                            color: "rgba(255, 255, 255, 0.7) !important",
                            fontSize: "1rem",
                            marginLeft: "2px",
                            marginRight: "2px",
                            "&:hover": {
                                color: "#FFFFFF !important",
                            },
                        },
                    },
                    // Activity label color variables - Using theme's dynamic primary color
                    "--activity-primary":
                        "rgb(var(--primary-rgb, 107, 70, 193))", // Dynamic primary color with fallback
                    "--activity-text": "#374151", // Gray-800 (neutral text)
                    // Disable browser's default validation popup
                    "input:invalid, textarea:invalid, select:invalid": {
                        boxShadow: "none !important",
                    },
                    "input:invalid::-webkit-validation-bubble-message, textarea:invalid::-webkit-validation-bubble-message, select:invalid::-webkit-validation-bubble-message":
                    {
                        display: "none !important",
                    },
                    "input:invalid::-webkit-validation-bubble-arrow, textarea:invalid::-webkit-validation-bubble-arrow, select:invalid::-webkit-validation-bubble-arrow":
                    {
                        display: "none !important",
                    },
                },
                ".no-rows-description": {
                    fontSize: "0.85rem",
                    maxWidth: 600,
                    color: "#718096",
                },
                // Activity label styles using CSS custom properties
                ".activity-label-primary": {
                    color: "var(--activity-primary)",
                    fontWeight: 600,
                    fontSize: "13px",
                },
                ".activity-value": {
                    color: "var(--activity-text)",
                    fontSize: "13px",
                    marginLeft: "4px",
                },
                // File upload styles
                ".file-upload-container": {
                    position: "relative",
                    display: "inline-block",
                    width: "100%",
                },
                ".file-upload-dropzone": {
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    border: `2px dashed ${primary}`,
                    borderRadius: "24px",
                    padding: "32px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    background:
                        `linear-gradient(135deg, ${alpha(primary, 0.02)} 0%, ${alpha(DEFAULT_PRIMARY_LIGHT, 0.02)} 100%)`,
                },
                ".file-upload-dropzone:hover": {
                    borderColor: "#553C9A",
                    background:
                        `linear-gradient(135deg, ${alpha(primary, 0.05)} 0%, ${alpha(DEFAULT_PRIMARY_LIGHT, 0.05)} 100%)`,
                    transform: "translateY(-2px)",
                    boxShadow: `0 8px 25px ${alpha(primary, 0.15)}`,
                },
                ".file-upload-dropzone:active": {
                    transform: "translateY(0)",
                    boxShadow: `0 4px 15px ${alpha(primary, 0.1)}`,
                },
                ".file-upload-icon-container": {
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    background:
                        `linear-gradient(135deg, ${primary} 0%, ${primary} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "16px",
                    boxShadow: `0 4px 12px ${alpha(primary, 0.3)}`,
                    transition: "all 0.3s ease",
                },
                ".file-upload-icon-container:hover": {
                    transform: "scale(1.05)",
                    boxShadow: `0 6px 20px ${alpha(primary, 0.4)}`,
                },
                ".file-upload-title": {
                    fontWeight: 600,
                    color: primary,
                    marginBottom: "8px",
                    textAlign: "center",
                },
                ".file-upload-description": {
                    textAlign: "center",
                    maxWidth: "300px",
                    lineHeight: 1.5,
                },
                ".file-upload-formats": {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginTop: "16px",
                    padding: "8px",
                    borderRadius: "8px",
                    backgroundColor: "#fff",
                    border: "1px solid #E2E8F0",
                },
                ".file-format-badge": {
                    padding: "2px 8px",
                    borderRadius: "4px",
                    backgroundColor: alpha(primary, 0.1),
                    color: primary,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                },
                ".control-center-badge": {
                    backgroundColor: "#00ff00 !important",
                    color: "black !important",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    height: "20px",
                    "& .MuiChip-label": {
                        paddingLeft: "4px",
                        paddingRight: "4px",
                    },
                },
                // Custom table column widths
                ".days-after-start-column": {
                    width: "40px !important",
                    minWidth: "40px !important",
                    maxWidth: "40px !important",
                },
                ".days-from-prev-step-column": {
                    width: "40px !important",
                    minWidth: "40px !important",
                    maxWidth: "40px !important",
                },
                // Constrain input fields in the days-after-start column
                ".days-after-start-column input": {
                    width: "50px !important",
                    minWidth: "50px !important",
                    maxWidth: "50px !important",
                    height: "36px !important",
                    minHeight: "36px !important",
                    padding: "4px 6px !important",
                    fontSize: "0.8rem !important",
                },
                // Constrain input fields in the days-from-prev-step column
                ".days-from-prev-step-column input": {
                    width: "50px !important",
                    minWidth: "50px !important",
                    maxWidth: "50px !important",
                    height: "36px !important",
                    minHeight: "36px !important",
                    padding: "4px 6px !important",
                    fontSize: "0.8rem !important",
                },
                // Activity sequence table styling
                ".activity-sequence-table": {
                    tableLayout: "auto !important",
                    width: "100% !important",
                    borderCollapse: "collapse",
                    "& thead": {
                        backgroundColor: "#f8fafc",
                        borderBottom: "2px solid #e2e8f0",
                        "& th": {
                            backgroundColor: "#f8fafc",
                            color: "#374151",
                            fontWeight: 600,
                            fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                            padding: "12px 8px",
                            textAlign: "left",
                            borderBottom: "2px solid #e2e8f0",
                            position: "sticky",
                            top: 0,
                            zIndex: 10,
                            "&:first-of-type": {
                                paddingLeft: "16px",
                            },
                            "&:last-of-type": {
                                paddingRight: "16px",
                            },
                        },
                    },
                    "& tbody": {
                        "& tr": {
                            borderBottom: "1px solid #e2e8f0",
                            "&:hover": {
                                backgroundColor: "#f8fafc",
                            },
                            "& td": {
                                padding: "12px 8px",
                                verticalAlign: "middle",
                                fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                                color: "#374151",
                                "&:first-of-type": {
                                    paddingLeft: "16px",
                                },
                                "&:last-of-type": {
                                    paddingRight: "16px",
                                },
                            },
                        },
                        "& th": {
                            verticalAlign: "top",
                        },
                    },
                },
                // Table responsive wrapper styling
                ".table-responsive": {
                    overflowX: "auto",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                    "&.table-responsive-inline": {
                        border: "none",
                        boxShadow: "none",
                        borderRadius: "0",
                    },
                },
                // Activity sequence table specific cell styling
                ".activity-sequence-table .w-10": {
                    width: "40px !important",
                    minWidth: "40px !important",
                    maxWidth: "40px !important",
                    textAlign: "center",
                    "& button": {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "100%",
                        height: "100%",
                    },
                },
                // Drag handle styling
                ".activity-sequence-table [data-drag-handle]": {
                    cursor: "grab",
                    "&:active": {
                        cursor: "grabbing",
                    },
                    "& .MuiSvgIcon-root": {
                        fontSize: "1.25rem",
                    },
                },
                // Status toggle cell styling
                ".activity-sequence-table td:has(.MuiSwitch-root)": {
                    textAlign: "center",
                    "& .MuiSwitch-root": {
                        margin: "0 auto",
                    },
                },
                // Form controls within activity sequence table
                ".activity-sequence-table .form-control": {
                    width: "100%",
                    height: "36px",
                    minHeight: "36px",
                    maxHeight: "36px",
                    padding: "6px 12px",
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    lineHeight: "1.2",
                    border: "1px solid #d1d5db",
                    borderRadius: "4px",
                    backgroundColor: "#ffffff",
                    color: "#374151",
                    boxSizing: "border-box",
                    "&:focus": {
                        outline: "none",
                        borderColor: primary,
                        boxShadow: `0 0 0 3px ${alpha(primary, 0.1)}`,
                    },
                    "&:disabled": {
                        backgroundColor: "#f3f4f6",
                        color: "#9ca3af",
                        cursor: "not-allowed",
                    },
                },
                // Select dropdowns within table
                ".activity-sequence-table select.form-control": {
                    appearance: "none",
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e\")",
                    backgroundPosition: "right 8px center",
                    backgroundRepeat: "no-repeat",
                    backgroundSize: "16px",
                    paddingRight: "32px",
                },
                // Input fields within table
                ".activity-sequence-table input.form-control": {
                    '&[type="number"]': {
                        textAlign: "center",
                    },
                    '&[type="time"]': {
                        textAlign: "center",
                    },
                },
                // Action buttons and icons within activity sequence table
                ".activity-sequence-table .MuiIconButton-root": {
                    padding: "4px",
                    "& .MuiSvgIcon-root": {
                        fontSize: "1.25rem",
                    },
                    "&:hover": {
                        backgroundColor: alpha(primary, 0.08),
                    },
                },
                // Tooltip styling within table (aligned with global MuiTooltip)
                ".activity-sequence-table .MuiTooltip-tooltip": {
                    fontSize: "0.8125rem",
                    backgroundColor: "#1F2937",
                    color: "rgba(249, 250, 251, 0.96)",
                    padding: "8px 12px",
                    borderRadius: 9,
                    boxShadow:
                        "0 4px 14px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.08)",
                    maxWidth: 300,
                },
                // Switch styling within table
                ".activity-sequence-table .MuiSwitch-root": {
                    "& .MuiSwitch-switchBase": {
                        "&.Mui-checked": {
                            color: primary,
                            "& + .MuiSwitch-track": {
                                backgroundColor: primary,
                            },
                        },
                        "&.Mui-disabled": {
                            color: "#9ca3af",
                            "& + .MuiSwitch-track": {
                                backgroundColor: "#d1d5db",
                                opacity: 0.5,
                            },
                        },
                    },
                },
                // Drag and drop states for activity sequence table
                '.activity-sequence-table tr[data-dragging="true"]': {
                    opacity: 0.5,
                    backgroundColor: "#f0f0f0",
                    transform: "rotate(2deg)",
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                },
                // Inactive row styling
                '.activity-sequence-table tr:not([data-dragging="true"])': {
                    transition: "all 0.2s ease",
                },
                // Empty state styling
                ".activity-sequence-table tbody tr:only-child td": {
                    textAlign: "center",
                    padding: "32px 16px",
                    color: "#6b7280",
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                },
                // Override the global CSS badge styling for sidebar
                ".app-sidebar .side-menu__label .badge.control-center-badge": {
                    backgroundColor: "#00ff00 !important",
                    color: "black !important",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    height: "20px",
                    padding: "0 !important",
                    "& .MuiChip-label": {
                        paddingLeft: "4px",
                        paddingRight: "4px",
                    },
                },
                // Add keyframes for schedule animations
                "@keyframes schedulePulse": {
                    "0%": {
                        opacity: 1,
                        transform: "scale(1)",
                    },
                    "50%": {
                        opacity: 0.7,
                        transform: "scale(1.1)",
                    },
                    "100%": {
                        opacity: 1,
                        transform: "scale(1)",
                    },
                },
                "@keyframes clockRotate": {
                    "0%": {
                        transform: "rotate(0deg)",
                    },
                    "25%": {
                        transform: "rotate(90deg)",
                    },
                    "50%": {
                        transform: "rotate(180deg)",
                    },
                    "75%": {
                        transform: "rotate(270deg)",
                    },
                    "100%": {
                        transform: "rotate(360deg)",
                    },
                },
                "@keyframes scheduleFade": {
                    "0%": {
                        opacity: 0.6,
                        transform: "scale(0.9)",
                    },
                    "100%": {
                        opacity: 1,
                        transform: "scale(1)",
                    },
                },
                // Environment indicator styles
                ".environment-indicator": {
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: "8px",
                    zIndex: 9999,
                    backgroundColor: "transparent",
                    "&.localhost": {
                        backgroundColor: "#10B981", // Green for localhost
                    },
                    "&.preprod": {
                        backgroundColor: "#F59E0B", // Yellow/Amber for preprod
                    },
                    "&.production": {
                        display: "none", // No indicator for production
                    },
                },
                // Vertical scrollbar styles
                ".vertical-scrollbar-container": {
                    position: "absolute",
                    right: "2px",
                    top: "0px",
                    bottom: "0px",
                    width: "6px",
                    backgroundColor: "rgba(0, 0, 0, 0.15)",
                    borderRadius: "3px",
                    overflow: "hidden",
                    zIndex: 10,
                    "@media (max-width: 768px)": {
                        width: "4px",
                        right: "1px",
                    },
                },
                ".vertical-scrollbar-thumb": {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    backgroundColor: primary,
                    borderRadius: "3px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    "&:hover": {
                        backgroundColor: primary,
                        transform: "scaleX(1.1)",
                    },
                    "@media (max-width: 768px)": {
                        borderRadius: "2px",
                    },
                },
                // Toolbar icon buttons — className `toolbar-button` on IconButton or outlined Button
                // Color uses --primary-rgb so account theming works (do not use closure `primary`).
                ".endless-scroll-toolbar .MuiIconButton-root.toolbar-button, .endless-scroll-toolbar .MuiButton-root.toolbar-button, .MuiDataGrid-cell .MuiIconButton-root.toolbar-button, .MuiDataGrid-cell .MuiButton-root.toolbar-button":
                    endlessScrollToolbarIconButtonStyles,
                ".endless-scroll-toolbar .MuiOutlinedInput-root:not(.MuiInputBase-multiline), .endless-scroll-toolbar .MuiAutocomplete-root .MuiOutlinedInput-root:not(.MuiInputBase-multiline)":
                    endlessScrollToolbarOutlinedInputStyles,
                '.endless-scroll-toolbar .MuiPickersTextField-root[dir="rtl"] .MuiPickersOutlinedInput-root.MuiPickersInputBase-adornedEnd':
                    pickersToolbarRtlPaddingStyles,
                ".endless-scroll-toolbar .MuiPickersTextField-root .MuiInputAdornment-root": {
                    color: "rgb(var(--primary-rgb))",
                    "& .MuiIconButton-root": {
                        color: "inherit",
                        width: "24px",
                        height: "24px",
                        minWidth: "24px",
                        minHeight: "24px",
                        maxWidth: "24px",
                        maxHeight: "24px",
                        padding: "2px",
                    },
                    "& .MuiSvgIcon-root": {
                        color: "inherit",
                        fontSize: "1.125rem",
                    },
                },
                ".endless-scroll-toolbar .toolbar-autocomplete .MuiInputAdornment-positionStart .MuiSvgIcon-root, .endless-scroll-toolbar .toolbar-autocomplete-labeled .MuiInputAdornment-positionStart .MuiSvgIcon-root":
                    {
                        color: "rgb(var(--primary-rgb)) !important",
                        fontSize: "1.125rem !important",
                    },
                ".endless-scroll-toolbar .MuiTextField-root, .endless-scroll-toolbar .MuiFormControl-root.MuiTextField-root, .endless-scroll-toolbar .toolbar-search-field":
                    toolbarCompactTextFieldRootStyles,
                ".endless-scroll-toolbar .MuiTextField-root .MuiInputBase-root:not(.MuiInputBase-multiline), .endless-scroll-toolbar .toolbar-search-field .MuiInputBase-root:not(.MuiInputBase-multiline), .endless-scroll-toolbar .toolbar-search-field.MuiTextField-root .MuiOutlinedInput-root":
                    endlessScrollToolbarOutlinedInputStyles,
                ".endless-scroll-toolbar .MuiAutocomplete-endAdornment": {
                    top: "50%",
                    transform: "translateY(-50%)",
                    height: "auto !important",
                    maxHeight: toolbarControlHeightPx,
                    width: "auto",
                    display: "flex",
                    alignItems: "center",
                },
                ".endless-scroll-toolbar .MuiAutocomplete-popupIndicator, .endless-scroll-toolbar .MuiAutocomplete-clearIndicator":
                {
                    width: "24px",
                    height: "24px",
                    minWidth: "24px",
                    minHeight: "24px",
                    maxWidth: "24px",
                    maxHeight: "24px",
                    padding: "4px",
                    flexShrink: 0,
                    color: "rgb(var(--primary-rgb))",
                    "& .MuiSvgIcon-root": {
                        color: "inherit",
                    },
                },
                ".endless-scroll-toolbar .MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon .MuiOutlinedInput-root":
                {
                    paddingRight: "56px !important",
                    paddingLeft: "0 !important",
                },
                '.endless-scroll-toolbar .MuiAutocomplete-hasPopupIcon.MuiAutocomplete-hasClearIcon[dir="rtl"] .MuiOutlinedInput-root':
                {
                    paddingRight: "0 !important",
                    paddingLeft: "56px !important",
                },
                // Cancel + Save pairs: equal column width (uses appButton.sizeSmall.minWidth as baseline)
                ".edit-action-button-group": {
                    display: "inline-grid",
                    gridTemplateColumns: "1fr 1fr",
                    columnGap: "16px",
                    flexShrink: 0,
                    "& .MuiButton-root": {
                        width: "100%",
                        whiteSpace: "nowrap",
                    },
                    "& .MuiButton-outlined": {
                        minHeight: `${appButton.sizeSmall.minHeight}px`,
                        height: `${appButton.sizeSmall.height}px`,
                        minWidth: `${appButton.sizeSmall.minWidth}px`,
                        padding: `${appButton.sizeSmall.paddingY}px 16px`,
                        fontSize: appButton.sizeSmall.fontSize,
                        lineHeight: String(appButton.sizeSmall.lineHeight),
                        borderRadius: `${appButton.sizeSmall.height / 2}px`,
                        textTransform: "none",
                        fontWeight: 600,
                    },
                },
                ".edit-action-button-group.edit-action-button-group--3": {
                    gridTemplateColumns: "repeat(3, minmax(110px, 1fr))",
                    "& .MuiButton-root": {
                        minWidth: "110px",
                    },
                },
                // MUI X DatePicker / DateTimePicker — same height as MuiOutlinedInput (37px)
                ".MuiPickersOutlinedInput-root, .MuiPickersInputBase-root.MuiPickersOutlinedInput-root, .MuiPickersTextField-root .MuiPickersOutlinedInput-root, .MuiTextField-root .MuiPickersOutlinedInput-root":
                {
                    ...pickersStandardHeightStyles,
                    ...pickersPillRadiusStyles,
                    ...pickersIconStyles,
                    ...pickersTypographyStyles,
                    ...pickersRtlOpenButtonStyles,
                },
                ".endless-scroll-toolbar .MuiFormControl-root.MuiPickersTextField-root, .endless-scroll-toolbar .MuiPickersTextField-root":
                    pickersToolbarLabeledFieldStyles,
                ".endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root, .endless-scroll-toolbar .MuiPickersInputBase-root.MuiPickersOutlinedInput-root":
                    {
                        ...pickersCompactHeightStyles,
                        ...pickersToolbarOutlinedInputStyles,
                        ...pickersToolbarRtlPaddingStyles,
                    },
                ".endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root":
                    {
                        alignItems: "stretch !important",
                        "&:where(.MuiPickersInputBase-adornedEnd)": {
                            alignItems: "center !important",
                        },
                        "& .MuiInputAdornment-root": {
                            alignSelf: "center !important",
                        },
                    },
                ".endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root .MuiPickersInputBase-sectionsContainer, .endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root .MuiPickersSectionList-root":
                    pickersToolbarSectionsContainerStyles,
                ".endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root .MuiPickersSectionList-section, .endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root .MuiPickersSectionList-sectionContent, .endless-scroll-toolbar .MuiPickersTextField-root .MuiPickersOutlinedInput-root .MuiPickersSectionList-sectionSeparator":
                    {
                        display: "inline-flex",
                        alignItems: "center",
                        lineHeight: `${toolbarInputLineHeightPx} !important`,
                        padding: "0 !important",
                    },
            },
        },
        MuiFormControl: {
            styleOverrides: {
                root: {
                    marginBottom: "16px",
                    ".endless-scroll-toolbar &": {
                        marginBottom: "0 !important",
                    },
                    "&.toolbar-search-field": toolbarCompactTextFieldRootStyles,
                    "& > .MuiInputLabel-root:not(.MuiInputLabel-shrink)": {
                        top: 0,
                        height: `${outlinedInputHeightPx}px`,
                        display: "flex",
                        alignItems: "center",
                        lineHeight: 1,
                        transform: "translate(14px, 0) scale(1)",
                        transformOrigin: "left center",
                    },
                    "&:has(.MuiFormHelperText-root) > .MuiInputLabel-root:not(.MuiInputLabel-shrink)":
                    {
                        height: "auto",
                        bottom: outlinedLabelHelperOffset,
                    },
                },
            },
        },
        MuiCheckbox: {
            styleOverrides: {
                root: {
                    color: "primary.main",
                    "&.Mui-checked": {
                        color: "primary.main",
                    },
                },
            },
        },
        MuiSwitch: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "& .MuiSwitch-switchBase.Mui-checked": {
                        color: theme.palette.primary.main,
                        "& + .MuiSwitch-track": {
                            backgroundColor: theme.palette.primary.light,
                        },
                    },
                    "&.MuiSwitch-colorPrimary .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                    {
                        backgroundColor: theme.palette.primary.light,
                    },
                }),
            },
            variants: [
                {
                    props: { "data-rtl": true } as any,
                    style: ({ theme }) => ({
                        transform: "scaleX(-1)",
                        "& .MuiSwitch-switchBase.Mui-checked": {
                            color: theme.palette.primary.main,
                            transform: "translateX(22px)",
                            "& + .MuiSwitch-track": {
                                backgroundColor: theme.palette.primary.light,
                            },
                        },
                        "&.MuiSwitch-colorPrimary .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                        {
                            backgroundColor: theme.palette.primary.light,
                        },
                    }),
                },
                {
                    props: { "data-rtl": true, size: "small" } as any,
                    style: ({ theme }) => ({
                        transform: "scaleX(-1)",
                        width: 40,
                        height: 24,
                        padding: 0,
                        "& .MuiSwitch-switchBase": {
                            padding: "3px",
                            color: theme.palette.common.white,
                            "&.Mui-checked": {
                                color: theme.palette.primary.main,
                                transform: "translateX(16px)",
                                "& + .MuiSwitch-track": {
                                    backgroundColor:
                                        theme.palette.primary.light,
                                    opacity: 1,
                                },
                            },
                        },
                        "&.MuiSwitch-colorPrimary .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                        {
                            backgroundColor: theme.palette.primary.light,
                            opacity: 1,
                        },
                        "& .MuiSwitch-thumb": {
                            width: 16,
                            height: 16,
                            boxShadow: theme.shadows[1],
                        },
                        "& .MuiSwitch-track": {
                            borderRadius: 12,
                            opacity: 1,
                            backgroundColor: theme.palette.grey[400],
                        },
                    }),
                },
                {
                    props: { size: "small" } as any,
                    style: ({ theme }) => ({
                        width: 40,
                        height: 24,
                        padding: 0,
                        "& .MuiSwitch-switchBase": {
                            padding: "3px",
                            color: theme.palette.common.white,
                            "&.Mui-checked": {
                                color: theme.palette.primary.main,
                                transform: "translateX(16px)",
                                "& + .MuiSwitch-track": {
                                    backgroundColor:
                                        theme.palette.primary.light,
                                    opacity: 1,
                                },
                            },
                        },
                        "& .MuiSwitch-thumb": {
                            width: 16,
                            height: 16,
                            boxShadow: theme.shadows[1],
                        },
                        "& .MuiSwitch-track": {
                            borderRadius: 12,
                            opacity: 1,
                            backgroundColor: theme.palette.grey[400],
                        },
                    }),
                },
            ],
        },
        MuiChip: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&.MuiChip-colorPrimary": {
                        backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.08
                        ),
                        color: theme.palette.primary.main,
                    },
                }),
                sizeMedium: ({ theme }) => ({
                    borderRadius: `${theme.appButton.sizeMedium.borderRadius}px`,
                }),
                sizeSmall: ({ theme }) => ({
                    borderRadius: `${theme.appButton.borderRadius}px`,
                }),
            },
            variants: [
                {
                    props: { "data-status": "active" } as any,
                    style: ({ theme }) => ({
                        backgroundColor: theme.palette.chartPalette.main,
                        color: "#FFFFFF",
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        height: "24px",
                        borderRadius: `${theme.appButton.borderRadius}px`,
                        boxShadow: "none",
                        "&.MuiChip-filled, &.MuiChip-colorDefault, &.MuiChip-filledDefault":
                        {
                            backgroundColor:
                                theme.palette.chartPalette.main,
                        },
                        "& .MuiChip-label": {
                            px: 1.5,
                        },
                    }),
                },
                {
                    props: { "data-status": "inactive" } as any,
                    style: ({ theme }) => ({
                        backgroundColor: alpha(
                            theme.palette.chartPalette.main,
                            0.4
                        ),
                        color: "#FFFFFF",
                        fontWeight: 500,
                        fontSize: "0.75rem",
                        height: "24px",
                        borderRadius: `${theme.appButton.borderRadius}px`,
                        boxShadow: "none",
                        "&.MuiChip-filled, &.MuiChip-colorDefault, &.MuiChip-filledDefault":
                        {
                            backgroundColor: alpha(
                                theme.palette.chartPalette.main,
                                0.4
                            ),
                        },
                        "& .MuiChip-label": {
                            px: 1.5,
                        },
                    }),
                },
            ],
        },
        MuiAlert: {
            styleOverrides: {
                root: {
                    borderRadius: 2,
                },
            },
        },
        // Additional components from portalTheme
        MuiTableContainer: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    border: "1px solid #E2E8F0",
                    overflow: "hidden",
                },
            },
        },
        MuiTable: {
            styleOverrides: {
                root: {
                    tableLayout: "auto",
                    width: "100%",
                },
            },
        },
        MuiTableHead: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "& .MuiTableCell-head": {
                        backgroundColor: theme.palette.primary.main,
                        color: theme.palette.primary.contrastText,
                        fontWeight: 600,
                        fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                        borderBottom: "none",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                    },
                }),
            },
        },
        MuiTableCell: {
            styleOverrides: {
                root: {
                    borderBottom: "1px solid #E2E8F0",
                    padding: "12px 16px",
                    fontSize: TYPOGRAPHY.FONT_SIZE_SMALL,
                    whiteSpace: "nowrap",
                    verticalAlign: "middle",
                },
            },
        },
        MuiTableRow: {
            styleOverrides: {
                root: ({ theme }) => ({
                    "&:hover": {
                        backgroundColor: alpha(
                            theme.palette.primary.main,
                            0.04
                        ),
                    },
                    "&:last-child td": {
                        border: 0,
                    },
                }),
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: {
                    borderColor: "#E2E8F0",
                },
            },
        },
        MuiSnackbar: {
            styleOverrides: {
                root: {
                    "& .MuiAlert-root": {
                        borderRadius: 8,
                        backgroundColor: "rgba(255, 255, 255, 0.98)",
                    },
                },
            },
        },
        MuiDrawer: {
            styleOverrides: {
                paper: {
                    backgroundColor: "#FFFFFF",
                    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.12)",
                    border: "none",
                },
                root: {
                    // Drawer nav only — do not use card / shape.borderRadius
                    "& .drawer-nav .MuiListItemButton-root": {
                        borderRadius: 0,
                        marginLeft: 0,
                        marginRight: 0,
                    },
                },
            },
        },
        MuiListItemButton: {
            styleOverrides: {
                root: ({ theme }) => ({
                    borderRadius: 8,
                    margin: "4px 8px",
                    "&:hover": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.08),
                    },
                    "&:active": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.12),
                    },
                    "&.Mui-selected": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.12),
                        "&:hover": {
                            backgroundColor: alpha(theme.palette.primary.main, 0.16),
                        },
                    },
                }),
            },
        },
        MuiListItemIcon: {
            styleOverrides: {
                root: ({ theme }) => ({
                    color: theme.palette.primary.main,
                    minWidth: "40px",
                }),
            },
        },
        MuiSvgIcon: {
            styleOverrides: {
                root: {
                    "&.schedule-pulse": {
                        animation: "schedulePulse 2s ease-in-out infinite",
                    },
                },
            },
        },
    };
}
