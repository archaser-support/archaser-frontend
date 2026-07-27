import { alpha, type Components, type Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import type { PortalButtonThemeStyles } from "./types";

import { PORTAL_BUTTON_MIN_HEIGHT_PX } from "./constants";

/** Applied on the root portal layout so MUI overrides target all portal routes. */
export const PORTAL_SCOPE_CLASS = "portalScope";

/** Half of `PORTAL_BUTTON_MIN_HEIGHT_PX` — exact capsule radius (avoids 9999px + 1px border glitches). */
export const PORTAL_BUTTON_PILL_RADIUS_PX = PORTAL_BUTTON_MIN_HEIGHT_PX / 2;

/** Grey gradient CTA on portal home action cards. */
export const PORTAL_SECONDARY_BUTTON_CLASS = "portalSecondaryButton";

/** Neutral outlined actions (e.g. “report another issue”). */
export const PORTAL_NEUTRAL_OUTLINED_CLASS = "portalNeutralOutlinedButton";

/** Outlined cancel using secondary palette (e.g. promise-to-pay). */
export const PORTAL_OUTLINED_SECONDARY_CLASS = "portalOutlinedSecondaryButton";

/** Light CTA on gradient panels (e.g. promise-to-pay thank-you). */
export const PORTAL_INVERSE_BUTTON_CLASS = "portalInverseButton";

/** In-card expand/collapse row — not a pill CTA. */
export const PORTAL_CARD_TOGGLE_CLASS = "portalCardToggle";

const portalScopeSelector = `.${PORTAL_SCOPE_CLASS} &`;

/** Pill radius: half of portal button height (SwiftUI Capsule / Apple HIG). */
export function getPortalButtonPillRadius(
    _theme: Theme,
    _size: "medium" | "large" = "medium"
) {
    return PORTAL_BUTTON_PILL_RADIUS_PX;
}

function portalPillBorderRadius(theme: Theme) {
    return getPortalButtonPillRadius(theme, "medium");
}

function containedGradient(theme: Theme): SystemStyleObject<Theme> {
    return {
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
        color: theme.palette.primary.contrastText,
        boxShadow: "none",
        "&:hover": {
            background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
            backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.secondary.dark} 100%)`,
            transform: "translateY(-1px)",
            boxShadow: `0 4px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
        },
        "&:disabled": {
            background: "rgba(0, 0, 0, 0.12)",
            backgroundImage: "none",
            color: "rgba(0, 0, 0, 0.38)",
            transform: "none",
            boxShadow: "none",
        },
    };
}

export function buildPortalButtonStyles(): PortalButtonThemeStyles {
    const borderRadius = portalPillBorderRadius;

    return {
        borderRadius,
        root: (theme) => ({
            textTransform: "none",
            fontWeight: 600,
            boxSizing: "border-box",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
            height: PORTAL_BUTTON_MIN_HEIGHT_PX,
            padding: theme.spacing(0, 2),
            lineHeight: 1.25,
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            fontSize: { xs: "0.875rem", sm: "1rem" },
        }),
        contained: (theme) => ({
            ...containedGradient(theme),
            px: { xs: 2, sm: 4 },
        }),
        outlined: (theme) => ({
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
            borderWidth: 1,
            borderStyle: "solid",
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            "&:hover": {
                borderColor: theme.palette.primary.dark,
                backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
            "&:disabled": {
                borderColor: theme.palette.action.disabledBackground,
                color: theme.palette.action.disabled,
            },
        }),
        neutralOutlined: (theme) => ({
            borderColor: theme.palette.action.active,
            color: theme.palette.text.primary,
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            "&:hover": {
                borderColor: theme.palette.action.selected,
                backgroundColor: theme.palette.action.hover,
            },
        }),
        outlinedSecondary: (theme) => ({
            borderColor: theme.palette.secondary.main,
            color: theme.palette.secondary.main,
            backgroundColor: theme.palette.background.paper,
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            "&:hover": {
                borderColor: theme.palette.secondary.dark,
                backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                color: theme.palette.secondary.dark,
            },
        }),
        secondaryContained: (theme) => ({
            background: `linear-gradient(135deg, ${theme.palette.grey[50]} 0%, ${theme.palette.grey[200]} 100%)`,
            color: theme.palette.text.primary,
            border: "none",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
            fontWeight: 600,
            fontSize: { xs: "0.75rem", sm: "0.875rem" },
            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
            padding: { xs: "6px 16px", sm: "8px 24px" },
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            textTransform: "none",
            transition: "all 0.2s ease-in-out",
            flexShrink: 0,
            minWidth: { xs: "80px", sm: "100px" },
            height: PORTAL_BUTTON_MIN_HEIGHT_PX,
            "&.MuiButton-contained": {
                backgroundColor: "transparent",
                color: theme.palette.text.primary,
            },
            "&:hover": {
                background: `linear-gradient(135deg, ${theme.palette.grey[200]} 0%, ${theme.palette.grey[300]} 100%)`,
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                transform: "translateY(-1px)",
                "&.MuiButton-contained": {
                    backgroundColor: "transparent",
                    color: theme.palette.text.primary,
                },
            },
            "&:active": {
                transform: "translateY(0px)",
            },
        }),
        inverseContained: (theme) => ({
            background: "rgba(255,255,255,0.95)",
            color: theme.palette.primary.main,
            border: "2px solid rgba(255,255,255,0.3)",
            boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
            fontWeight: 600,
            fontSize: "14px",
            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
            padding: "12px 32px",
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
            textTransform: "none",
            "&:hover": {
                background: theme.palette.common.white,
                boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            },
        }),
        hero: () => ({
            width: "100%",
            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
            height: PORTAL_BUTTON_MIN_HEIGHT_PX,
            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
        }),
        formActionCancelMargin: (isRTL: boolean) => ({
            mr: isRTL ? 0 : 1,
            ml: isRTL ? 1 : 0,
        }),
    };
}

export function buildPortalButtonThemeExtensions() {
    return {
        portalButton: buildPortalButtonStyles(),
    };
}

export function buildPortalScopeMuiButtonOverrides(): Pick<
    Components<Theme>,
    "MuiButton"
> {
    return {
        MuiButton: {
            styleOverrides: {
                root: ({ theme }) => {
                    const pb = theme.portalButton;
                    return {
                        [portalScopeSelector]: pb.root(theme),
                        [`${portalScopeSelector}.MuiButton-sizeMedium`]: {
                            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
                            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
                            height: PORTAL_BUTTON_MIN_HEIGHT_PX,
                        },
                        [`${portalScopeSelector}.MuiButton-sizeLarge`]: {
                            borderRadius: `${PORTAL_BUTTON_PILL_RADIUS_PX}px`,
                            minHeight: PORTAL_BUTTON_MIN_HEIGHT_PX,
                            height: PORTAL_BUTTON_MIN_HEIGHT_PX,
                        },
                        [`${portalScopeSelector}.MuiButton-contained`]:
                            pb.contained(theme),
                        [`${portalScopeSelector}.MuiButton-outlined`]:
                            pb.outlined(theme),
                        [`${portalScopeSelector}.${PORTAL_NEUTRAL_OUTLINED_CLASS}`]:
                            pb.neutralOutlined(theme),
                        [`${portalScopeSelector}.${PORTAL_OUTLINED_SECONDARY_CLASS}`]:
                            pb.outlinedSecondary(theme),
                        [`${portalScopeSelector}.${PORTAL_SECONDARY_BUTTON_CLASS}`]:
                            pb.secondaryContained(theme),
                        [`${portalScopeSelector}.${PORTAL_INVERSE_BUTTON_CLASS}`]:
                            pb.inverseContained(theme),
                        [`${portalScopeSelector}.${PORTAL_CARD_TOGGLE_CLASS}`]: {
                            minHeight: "unset",
                            height: "auto",
                            borderRadius: 0,
                            backgroundColor: "transparent",
                            backgroundImage: "none",
                            boxShadow: "none",
                            transform: "none",
                            "&:hover": {
                                backgroundColor: "transparent",
                                backgroundImage: "none",
                                boxShadow: "none",
                                transform: "none",
                            },
                            "&:active": {
                                backgroundColor: "transparent",
                                boxShadow: "none",
                            },
                            "& .MuiTouchRipple-root": {
                                display: "none",
                            },
                        },
                    };
                },
            },
        },
    };
}
