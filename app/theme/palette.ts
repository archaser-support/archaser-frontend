import { darken, lighten } from "@mui/system/colorManipulator";

export function buildPalette(
    primary: string,
    secondary: string,
    chartPalette: string
) {
    return {
        primary: {
            main: primary,
            light: lighten(primary, 0.1),
            dark: darken(primary, 0.2),
            contrastText: "#FFFFFF",
        },
        secondary: {
            main: secondary,
            light: lighten(secondary, 0.15),
            dark: darken(secondary, 0.2),
            contrastText: "#FFFFFF",
        },
        chartPalette: {
            main: chartPalette,
            light: lighten(chartPalette, 0.15),
            dark: darken(chartPalette, 0.2),
        },
        error: {
            main: "#E53E3E",
            light: "#FC8181",
            dark: "#C53030",
            contrastText: "#FFFFFF",
        },
        success: {
            main: "#10B981",
            light: "#34D399",
            dark: "#059669",
            contrastText: "#FFFFFF",
        },
        warning: {
            main: "#F59E0B",
            light: "#FBBF24",
            dark: "#D97706",
            contrastText: "#FFFFFF",
        },
        info: {
            main: "#3B82F6",
            light: "#60A5FA",
            dark: "#2563EB",
            contrastText: "#FFFFFF",
        },
        background: {
            default: "#FFFFFF",
            paper: "#FFFFFF",
        },
        text: {
            primary: "#2D3748",
            secondary: "#718096",
        },
        grey: {
            50: "#F7FAFC",
            100: "#EDF2F7",
            200: "#E2E8F0",
            300: "#CBD5E0",
            400: "#A0AEC0",
            500: "#718096",
            600: "#4A5568",
            700: "#2D3748",
            800: "#1A202C",
            900: "#171923",
        },
    };
}
