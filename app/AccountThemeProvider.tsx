"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";

import { fetchSessionAccountById } from "@/shared/services/sessionAccountQuery";

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

export default function AccountThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session, status } = useSession();
    const [liveColors, setLiveColors] = useState<AccountThemeColors | null>(
        null
    );
    const accountId =
        session?.user?.view_as_user_account_id ?? session?.user?.account_id;

    useEffect(() => {
        if (!accountId || status !== "authenticated") {
            setLiveColors(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const colors = readAccountThemeColors(
                    await fetchSessionAccountById(accountId)
                );
                if (!cancelled && colors) {
                    setLiveColors(colors);
                }
            } catch {
                // Keep session colors when the me payload is unavailable.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [accountId, status, session?.user?.view_as_user_id]);

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
