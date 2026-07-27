import type { Theme } from "@mui/material/styles";
import type { SystemStyleObject } from "@mui/system";

/** Distinct icon tile hues for credit (and other) metric cards. */
export type MetricStatCardIconAccent =
    | "default"
    | "receivables"
    | "compliant"
    | "atRisk"
    | "overdue"
    | "capacity"
    | "terms"
    | "noPolicy"
    | "reporting"
    | "limitWarnings"
    | "healthIndex"
    | "zeroLimit";

export interface NavMenuThemeStyles {
    listItemBorderRadius: number | string;
}

export interface AppButtonThemeStyles {
    borderRadius: number;
    dropdownListBorderRadius: number;
    sizeMedium: {
        height: number;
        borderRadius: number;
    };
    sizeSmall: {
        minHeight: number;
        height: number;
        minWidth: number;
        paddingX: number;
        paddingY: number;
        fontSize: string;
        lineHeight: number;
    };
    toolbarControl: {
        height: number;
        borderRadius: number;
        borderColor: string;
    };
}

export interface MetricStatCardThemeStyles {
    card: (
        theme: Theme,
        opts?: { clickable?: boolean; hoverable?: boolean }
    ) => SystemStyleObject<Theme>;
    cardContent: (theme: Theme) => SystemStyleObject<Theme>;
    iconBox: (
        theme: Theme,
        isRtl: boolean,
        accent?: MetricStatCardIconAccent
    ) => SystemStyleObject<Theme>;
    bodyColumn: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    label: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    labelRow: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    labelTooltipTrigger: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    valuesStack: (
        _theme: Theme,
        opts: { alignValueToEnd: boolean }
    ) => SystemStyleObject<Theme>;
    value: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    valueSlot: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    secondary: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    footnote: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
}

export interface PortalCardThemeStyles {
    elevation: 0;
    root: (theme: Theme) => SystemStyleObject<Theme>;
    border: (theme: Theme) => string;
    borderRadius: (theme: Theme) => string | number;
}

export interface PortalMenuThemeStyles {
    borderRadius: (theme: Theme) => number | string;
    paper: (theme: Theme) => SystemStyleObject<Theme>;
    /** Menu opens below anchor (e.g. header language control). */
    paperBelowAnchor: (theme: Theme) => SystemStyleObject<Theme>;
    /** Menu opens above anchor (e.g. drawer footer language control). */
    paperAboveAnchor: (theme: Theme) => SystemStyleObject<Theme>;
}

export interface PortalButtonThemeStyles {
    borderRadius: (theme: Theme) => number | string;
    root: (theme: Theme) => SystemStyleObject<Theme>;
    contained: (theme: Theme) => SystemStyleObject<Theme>;
    outlined: (theme: Theme) => SystemStyleObject<Theme>;
    neutralOutlined: (theme: Theme) => SystemStyleObject<Theme>;
    outlinedSecondary: (theme: Theme) => SystemStyleObject<Theme>;
    secondaryContained: (theme: Theme) => SystemStyleObject<Theme>;
    inverseContained: (theme: Theme) => SystemStyleObject<Theme>;
    hero: () => SystemStyleObject<Theme>;
    formActionCancelMargin: (isRTL: boolean) => SystemStyleObject<Theme>;
}

export interface CreditDashboardChartCardThemeStyles {
    card: (
        theme: Theme,
        opts?: { clickable?: boolean; hoverable?: boolean }
    ) => SystemStyleObject<Theme>;
    cardContent: (
        theme: Theme,
        opts?: { withChartBody?: boolean }
    ) => SystemStyleObject<Theme>;
    headerIconLeading: (
        theme: Theme,
        isRtl: boolean,
        accent?: MetricStatCardIconAccent
    ) => SystemStyleObject<Theme>;
    headerTitle: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    headerCaption: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    headerTitleRow: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    headerTitleInRow: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
    headerColumn: (theme: Theme, isRtl: boolean) => SystemStyleObject<Theme>;
}
