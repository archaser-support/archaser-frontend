import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import type { PortalCardThemeStyles } from "./types";

import { PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX } from "./constants";

export const PORTAL_CARD_CLASS = "portalCard";

/** Home action tiles — flat card, no elevation on hover. */
export const PORTAL_ACTION_CARD_CLASS = "portalActionCard";

export function getPortalLogoAvatarSx(theme: Theme): SystemStyleObject<Theme> {
    const radius = `${PORTAL_LOGO_AVATAR_BORDER_RADIUS_PX}px`;
    return {
        borderRadius: radius,
        "& img": {
            borderRadius: radius,
        },
    };
}

/** Matches credit dashboard metric cards (`theme.metricStatCard.card`). */
export const getPortalCardBorderRadius = (theme: Theme) => theme.spacing(3);

export function buildPortalCardStyles(): PortalCardThemeStyles {
    const root = (theme: Theme): SystemStyleObject<Theme> => ({
        borderRadius: getPortalCardBorderRadius(theme),
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        boxShadow: "none",
        backgroundImage: "none",
    });

    return {
        elevation: 0,
        root,
        border: (theme: Theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: getPortalCardBorderRadius,
    };
}

export function buildPortalCardThemeExtensions() {
    return {
        portalCard: buildPortalCardStyles(),
    };
}

export function getPortalCardSx(theme: Theme): SystemStyleObject<Theme> {
    return theme.portalCard.root(theme);
}

/** Circular affordance for in-card expand/collapse chevrons. */
export function getPortalCardExpandToggleSx(
    theme: Theme
): SystemStyleObject<Theme> {
    return {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: 32,
        height: 32,
        cursor: "pointer",
        borderRadius: "50%",
        color: theme.palette.text.primary,
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        "&:hover": {
            boxShadow: `0 2px 8px ${theme.palette.mode === "dark" ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.12)"}`,
        },
        "&:active": {
            backgroundColor: theme.palette.background.paper,
            boxShadow: "none",
        },
    };
}
