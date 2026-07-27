"use client";

import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider } from "@mui/material/styles";
import { useSession } from "next-auth/react";
import React, { useEffect } from "react";

import {
    createAppTheme,
    DEFAULT_PRIMARY,
    DEFAULT_SECONDARY,
    hexToRgb,
    isValidHexColor,
} from "./theme";

export default function AccountThemeProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    const { data: session } = useSession();
    const primaryColor = session?.user?.primary_color ?? null;
    const secondaryColor = session?.user?.secondary_color ?? null;
    const chartPaletteColor = session?.user?.chart_palette_color ?? null;
    const theme = createAppTheme(primaryColor, secondaryColor, chartPaletteColor);

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
    }, [primaryColor, secondaryColor]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
