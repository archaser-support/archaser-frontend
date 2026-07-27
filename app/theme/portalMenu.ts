import type { Components, Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

import type { PortalMenuThemeStyles } from "./types";

/** Menu paper is portaled to document body — style via class, not `.portal-scope` descendant. */
export const PORTAL_MENU_PAPER_CLASS = "portal-menu-paper";

function portalMenuPaperBase(theme: Theme): SystemStyleObject<Theme> {
    return {
        minWidth: 120,
        borderRadius: theme.shape.borderRadius,
        boxShadow: `0 8px 16px ${
            theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.15)"
        }`,
        overflow: "hidden",
    };
}

export function buildPortalMenuStyles(): PortalMenuThemeStyles {
    return {
        borderRadius: (theme) => theme.shape.borderRadius,
        paper: (theme) => ({
            ...portalMenuPaperBase(theme),
            mt: theme.spacing(1),
        }),
        paperBelowAnchor: (theme) => ({
            ...portalMenuPaperBase(theme),
            // Clear the portal header bar (~80–94px) when anchored to the language icon
            mt: theme.spacing(2),
        }),
        paperAboveAnchor: (theme) => ({
            ...portalMenuPaperBase(theme),
            mb: theme.spacing(1),
        }),
    };
}

export function buildPortalMenuThemeExtensions() {
    return {
        portalMenu: buildPortalMenuStyles(),
    };
}

/** CssBaseline targets portaled menu papers (outside `.portal-scope` in the DOM). */
export function buildPortalMenuCssBaselineOverrides(
    theme: Theme
): Record<string, SystemStyleObject<Theme>> {
    const radius = theme.portalMenu.borderRadius(theme);
    return {
        [`.${PORTAL_MENU_PAPER_CLASS}`]: {
            borderRadius: radius,
            overflow: "hidden",
        },
        [`.${PORTAL_MENU_PAPER_CLASS} .MuiList-root`]: {
            padding: 0,
        },
    };
}

export function buildPortalScopeMuiMenuOverrides(): Pick<
    Components<Theme>,
    "MuiMenu" | "MuiPopover"
> {
    return {
        MuiMenu: {
            defaultProps: {
                slotProps: {
                    paper: {
                        className: PORTAL_MENU_PAPER_CLASS,
                    },
                },
            },
        },
        MuiPopover: {
            defaultProps: {
                slotProps: {
                    paper: {
                        className: PORTAL_MENU_PAPER_CLASS,
                    },
                },
            },
        },
    };
}
