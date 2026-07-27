"use client";
import { apiFetch } from "@/utils/apiFetch";

import createCache from "@emotion/cache";
import { CacheProvider } from "@emotion/react";
import CssBaseline from "@mui/material/CssBaseline";
import { Box } from "@mui/material";
import { createTheme, ThemeProvider, type Theme } from "@mui/material/styles";
import { usePathname, useServerInsertedHTML } from "next/navigation";
import React, { useEffect, useState } from "react";

import {
    createAppTheme,
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    hexToRgb,
    isValidHexColor,
} from "./theme";
import {
    buildPortalScopeMuiButtonOverrides,
    PORTAL_SCOPE_CLASS,
} from "./theme/portalButton";
import {
    buildPortalMenuCssBaselineOverrides,
    buildPortalScopeMuiMenuOverrides,
} from "./theme/portalMenu";
import {
    PORTAL_ACTION_CARD_CLASS,
    PORTAL_CARD_CLASS,
} from "./theme/portalCard";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function PortalDynamicTheme({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [primaryColor, setPrimaryColor] = useState<string | null>(null);
    const [secondaryColor, setSecondaryColor] = useState<string | null>(null);
    const [chartPaletteColor, setChartPaletteColor] = useState<string | null>(
        null
    );
    const [isThemeReady, setIsThemeReady] = useState(false);

    // Extract customerUUID from path: /[locale]/portal/[customerUUID]/...
    useEffect(() => {
        const segments = pathname?.split("/") ?? [];
        const portalIndex = segments.indexOf("portal");
        const customerUUID =
            portalIndex >= 0 && segments[portalIndex + 1]
                ? segments[portalIndex + 1]
                : null;

        if (customerUUID && UUID_REGEX.test(customerUUID)) {
            setIsThemeReady(false);
            apiFetch(`/api/customers/${customerUUID}/portal-data`)
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                    setPrimaryColor(data?.Account?.primary_color ?? null);
                    setSecondaryColor(data?.Account?.secondary_color ?? null);
                    setChartPaletteColor(
                        data?.Account?.chart_palette_color ?? null
                    );
                })
                .catch(() => {
                    setPrimaryColor(null);
                    setSecondaryColor(null);
                    setChartPaletteColor(null);
                })
                .finally(() => {
                    setIsThemeReady(true);
                });
        } else {
            setPrimaryColor(null);
            setSecondaryColor(null);
            setChartPaletteColor(null);
            setIsThemeReady(true);
        }
    }, [pathname]);

    const theme = createTheme(
        createAppTheme(primaryColor, secondaryColor, chartPaletteColor),
        {
            components: {
                ...buildPortalScopeMuiButtonOverrides(),
                ...buildPortalScopeMuiMenuOverrides(),
                MuiCssBaseline: {
                    styleOverrides: (theme: Theme) => ({
                        ...buildPortalMenuCssBaselineOverrides(theme),
                        [`.${PORTAL_ACTION_CARD_CLASS}`]: {
                            boxShadow: "none !important",
                            backgroundImage: "none !important",
                            "--Paper-shadow": "none",
                            filter: "none",
                        },
                        [`.${PORTAL_ACTION_CARD_CLASS}:hover`]: {
                            boxShadow: "none !important",
                        },
                        [`.${PORTAL_SCOPE_CLASS} .MuiCard-root, .${PORTAL_CARD_CLASS}`]:
                            {
                                borderRadius: theme.spacing(3),
                                border: `1px solid ${theme.palette.divider}`,
                                backgroundColor: theme.palette.background.paper,
                                boxShadow: "none !important",
                                backgroundImage: "none !important",
                                "--Paper-shadow": "none",
                            },
                    }),
                },
            },
        }
    );

    // Sync CSS variables for components using rgb(var(--primary)), rgba(var(--primary), a), and --secondary
    // Use default colors when account has no custom primary/secondary
    useEffect(() => {
        if (typeof document === "undefined") return;
        const root = document.documentElement;
        const primaryRgb = isValidHexColor(primaryColor)
                ? hexToRgb(primaryColor)
                : hexToRgb(DEFAULT_PRIMARY);
        root.style.setProperty("--primary", primaryRgb);
        root.style.setProperty("--primary-rgb", primaryRgb);
        root.style.setProperty("--menu-prime-color", primaryRgb);
        root.style.setProperty("--header-prime-color", primaryRgb);

        const secondaryRgb = isValidHexColor(secondaryColor)
                ? hexToRgb(secondaryColor)
                : hexToRgb(DEFAULT_SECONDARY);
        root.style.setProperty("--secondary", secondaryRgb);
    }, [primaryColor, secondaryColor]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {isThemeReady ? (
                children
            ) : (
                <Box
                    sx={{
                        minHeight: "100vh",
                        width: "100%",
                        backgroundColor: (t) => t.palette.grey[50],
                    }}
                />
            )}
        </ThemeProvider>
    );
}

export default function PortalThemeRegistry({
    children,
}: {
    children: React.ReactNode;
}) {
    const [{ cache, flush }] = useState(() => {
        const cache = createCache({
            key: "mui-portal",
        });
        cache.compat = true;
        const prevInsert = cache.insert;
        let inserted: string[] = [];
        cache.insert = (...args) => {
            const serialized = args[1];
            if (cache.inserted[serialized.name] === undefined) {
                inserted.push(serialized.name);
            }
            return prevInsert(...args);
        };
        const flush = () => {
            const prevInserted = inserted;
            inserted = [];
            return prevInserted;
        };
        return { cache, flush };
    });

    useServerInsertedHTML(() => {
        const names = flush();
        if (names.length === 0) {
            return null;
        }
        let styles = "";
        for (const name of names) {
            styles += cache.inserted[name];
        }
        // Note: styles come from Emotion cache (trusted source)
        // CSS in style tags is injected by Emotion library for MUI theming
        // This is safe as it's generated by the Emotion library, not user input
        return (
            <style
                key={cache.key}
                data-emotion={`${cache.key} ${names.join(" ")}`}
                dangerouslySetInnerHTML={{
                    __html: styles,
                }}
            />
        );
    });

    return (
        <CacheProvider value={cache}>
            <PortalDynamicTheme>{children}</PortalDynamicTheme>
        </CacheProvider>
    );
}
