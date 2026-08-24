"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";

import { resolveAuthorizationHeader } from "@/utils/apiClientConfig";
import { getNestAccessToken, getNestApiBaseUrl } from "@/utils/nestAuth";

import {
    createAppTheme,
    DEFAULT_CHART_PALETTE,
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    hexToRgb,
    isValidHexColor,
} from "./theme";

type AccountThemeColors = {
    primary_color?: string | null;
    secondary_color?: string | null;
    chart_palette_color?: string | null;
};

function asColorString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (isValidHexColor(trimmed)) {
        return trimmed;
    }
    if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
        return `#${trimmed}`;
    }
    return null;
}

function readAccountThemeColors(payload: unknown): AccountThemeColors | null {
    if (!payload || typeof payload !== "object") {
        return null;
    }
    const root = payload as Record<string, unknown>;
    const source =
        root.data && typeof root.data === "object"
            ? (root.data as Record<string, unknown>)
            : root;
    const colors: AccountThemeColors = {
        primary_color: asColorString(source.primary_color),
        secondary_color: asColorString(source.secondary_color),
        chart_palette_color: asColorString(source.chart_palette_color),
    };
    if (
        !colors.primary_color &&
        !colors.secondary_color &&
        !colors.chart_palette_color
    ) {
        return null;
    }
    return colors;
}

async function fetchJsonWithNestBearer(path: string): Promise<unknown | null> {
    const authorization = resolveAuthorizationHeader({
        nestAccessToken: getNestAccessToken(),
        attachNestBearer: true,
    });
    if (!authorization) {
        return null;
    }
    const response = await fetch(path, {
        headers: { Authorization: authorization },
        credentials: "omit",
    });
    if (!response.ok) {
        return null;
    }
    return response.json();
}

function mergeThemeColors(
    ...sources: Array<AccountThemeColors | null | undefined>
): AccountThemeColors | null {
    const merged: AccountThemeColors = {};
    for (const source of sources) {
        if (!source) {
            continue;
        }
        merged.primary_color = merged.primary_color ?? source.primary_color;
        merged.secondary_color =
            merged.secondary_color ?? source.secondary_color;
        merged.chart_palette_color =
            merged.chart_palette_color ?? source.chart_palette_color;
    }
    if (
        !merged.primary_color &&
        !merged.secondary_color &&
        !merged.chart_palette_color
    ) {
        return null;
    }
    return merged;
}

export default function AccountThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const [liveColors, setLiveColors] = useState<AccountThemeColors | null>(
        null
    );
    const accountId = session?.user?.account_id;

    useEffect(() => {
        if (!accountId || status !== "authenticated") {
            setLiveColors(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const accountColors = readAccountThemeColors(
                    await fetchJsonWithNestBearer(
                        `/api/entities/accounts/${accountId}`
                    )
                );
                const profileColors = accountColors?.chart_palette_color
                    ? null
                    : readAccountThemeColors(
                          await fetchJsonWithNestBearer(
                              `${getNestApiBaseUrl()}/auth/me`
                          )
                      );
                const colors = mergeThemeColors(accountColors, profileColors);
                if (!cancelled && colors) {
                    setLiveColors(colors);
                }
            } catch {
                // Keep session colors when the account payload is unavailable.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId, status]);

    const primaryColor =
        liveColors?.primary_color ?? session?.user?.primary_color ?? null;
    const secondaryColor =
        liveColors?.secondary_color ?? session?.user?.secondary_color ?? null;
    const chartPaletteColor =
        liveColors?.chart_palette_color ??
        session?.user?.chart_palette_color ??
        null;
    const theme = useMemo(
        () => createAppTheme(primaryColor, secondaryColor, chartPaletteColor),
        [primaryColor, secondaryColor, chartPaletteColor]
    );

    // Sync CSS variables for components using rgb(var(--primary)), rgba(var(--primary), a), and --secondary
    // Use default colors when session has no custom primary/secondary
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

        const chartRgb = isValidHexColor(chartPaletteColor)
            ? hexToRgb(chartPaletteColor)
            : hexToRgb(DEFAULT_CHART_PALETTE);
        root.style.setProperty("--chart-palette", chartRgb);
        root.style.setProperty("--chart-palette-rgb", chartRgb);
    }, [primaryColor, secondaryColor, chartPaletteColor]);

    return (
        <ThemeProvider
            theme={theme}
            key={`${primaryColor ?? ""}-${secondaryColor ?? ""}-${chartPaletteColor ?? ""}`}
        >
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
