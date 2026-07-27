import type {
    AppButtonThemeStyles,
    CreditDashboardChartCardThemeStyles,
    MetricStatCardThemeStyles,
    NavMenuThemeStyles,
    PortalButtonThemeStyles,
    PortalCardThemeStyles,
    PortalMenuThemeStyles,
} from "./types";

declare module "@mui/material/styles" {
    interface TypographyVariants {
        tabTitle: React.CSSProperties;
        portalPageTitle: React.CSSProperties;
        portalPageSubtitle: React.CSSProperties;
        portalSectionTitle: React.CSSProperties;
        portalCardTitle: React.CSSProperties;
        portalCardSubtitle: React.CSSProperties;
        portalActionButton: React.CSSProperties;
        portalStatusText: React.CSSProperties;
        listPageHeaderTitle: React.CSSProperties;
        listPageHeaderDescription: React.CSSProperties;
        hebrewTitle: React.CSSProperties;
        hebrewSubtitle: React.CSSProperties;
        hebrewCardTitle: React.CSSProperties;
        hebrewCardSubtitle: React.CSSProperties;
        hebrewBodyText: React.CSSProperties;
    }
    interface TypographyVariantsOptions {
        tabTitle?: React.CSSProperties;
        portalPageTitle?: React.CSSProperties;
        portalPageSubtitle?: React.CSSProperties;
        portalSectionTitle?: React.CSSProperties;
        portalCardTitle?: React.CSSProperties;
        portalCardSubtitle?: React.CSSProperties;
        portalActionButton?: React.CSSProperties;
        portalStatusText?: React.CSSProperties;
        listPageHeaderTitle?: React.CSSProperties;
        listPageHeaderDescription?: React.CSSProperties;
        hebrewTitle?: React.CSSProperties;
        hebrewSubtitle?: React.CSSProperties;
        hebrewCardTitle?: React.CSSProperties;
        hebrewCardSubtitle?: React.CSSProperties;
        hebrewBodyText?: React.CSSProperties;
    }
    interface Palette {
        chartPalette: {
            main: string;
            light: string;
            dark: string;
        };
    }
    interface PaletteOptions {
        chartPalette?: {
            main?: string;
            light?: string;
            dark?: string;
        };
    }
    interface ComponentPropsOverrides {
        MuiTextField: {
            "data-hebrew"?: boolean;
        };
        MuiPickersTextField: {
            "data-hebrew"?: boolean;
        };
        MuiChip: {
            "data-status"?: "active" | "inactive";
        };
    }
    interface Theme {
        customTooltip: {
            container: React.CSSProperties;
            header: React.CSSProperties;
            row: React.CSSProperties;
            label: React.CSSProperties;
            value: React.CSSProperties;
        };
        rtlTooltip: {
            container: (isRTL: boolean) => React.CSSProperties;
            header: (isRTL: boolean) => React.CSSProperties;
            section: (isRTL: boolean) => React.CSSProperties;
            label: (isRTL: boolean) => React.CSSProperties;
            text: (isRTL: boolean) => React.CSSProperties;
        };
        metricStatCard: MetricStatCardThemeStyles;
        creditDashboardChartCard: CreditDashboardChartCardThemeStyles;
        portalCard: PortalCardThemeStyles;
        portalButton: PortalButtonThemeStyles;
        portalMenu: PortalMenuThemeStyles;
        navMenu: NavMenuThemeStyles;
        appButton: AppButtonThemeStyles;
    }
    interface ThemeOptions {
        customTooltip?: Theme["customTooltip"];
        rtlTooltip?: Theme["rtlTooltip"];
        metricStatCard?: MetricStatCardThemeStyles;
        creditDashboardChartCard?: CreditDashboardChartCardThemeStyles;
        portalCard?: PortalCardThemeStyles;
        portalButton?: PortalButtonThemeStyles;
        portalMenu?: PortalMenuThemeStyles;
        navMenu?: NavMenuThemeStyles;
        appButton?: AppButtonThemeStyles;
    }
}

declare module "@mui/material/Typography" {
    interface TypographyPropsVariantOverrides {
        tabTitle: true;
        portalPageTitle: true;
        portalPageSubtitle: true;
        portalSectionTitle: true;
        portalCardTitle: true;
        portalCardSubtitle: true;
        portalActionButton: true;
        portalStatusText: true;
        listPageHeaderTitle: true;
        listPageHeaderDescription: true;
        hebrewTitle: true;
        hebrewSubtitle: true;
        hebrewCardTitle: true;
        hebrewCardSubtitle: true;
        hebrewBodyText: true;
    }
}

export {};
