"use client";

import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import type { ReactNode } from "react";

/**
 * ARChaser sidebar outline icons from the approved icon pack
 * (24×24, 1.8 stroke, currentColor). Do not mirror in RTL.
 */
const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

function SidebarIcon({
    children,
    ...props
}: SvgIconProps & { children: ReactNode }) {
    return (
        <SvgIcon
            // Do not set inheritViewBox — MUI then omits viewBox entirely when
            // children are paths (not a nested <svg>), which breaks centering.
            viewBox="0 0 24 24"
            aria-hidden
            {...props}
            sx={[
                {
                    // Size comes from fontSize (MUI default / parent `.MuiSvgIcon-root`).
                    // Do not set width/height here — it fights parent card-icon rules.
                    fill: "none",
                    overflow: "visible",
                    flexShrink: 0,
                },
                ...(Array.isArray(props.sx)
                    ? props.sx
                    : props.sx
                      ? [props.sx]
                      : []),
            ]}
        >
            <g {...strokeProps}>{children}</g>
        </SvgIcon>
    );
}

export function FinancialDashboardNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <rect x="3" y="3" width="7" height="7" rx="1.2" />
            <rect x="14" y="3" width="7" height="7" rx="1.2" />
            <rect x="3" y="14" width="7" height="7" rx="1.2" />
            <path d="M14 21v-7m0 7h7m-5-3 2-2 3-1" />
        </SidebarIcon>
    );
}

export function OperationDashboardNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <rect x="3" y="3" width="6" height="6" rx="1.3" />
            <rect x="15" y="3" width="6" height="6" rx="1.3" />
            <rect x="9" y="15" width="6" height="6" rx="1.3" />
            <path d="M6 9v3h12V9m-6 3v3m-1 3h2" />
        </SidebarIcon>
    );
}

export function CreditDashboardNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="m12 3 8 3v6c0 4.3-3.4 7.3-8 9-4.6-1.7-8-4.7-8-9V6z" />
            <path d="M7.5 13a4.5 4.5 0 0 1 9 0M12 13l2-3m-2-1v.5" />
        </SidebarIcon>
    );
}

export function PortfolioHealthNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M4 21v-5m8 5v-8m8 8V10M3 11c3 0 3-5 6-5s3 3 6 3 3-6 6-6" />
        </SidebarIcon>
    );
}

export function ControlCenterNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18M7 13h3m-3 3h2m6-4v3m0 2v.1" />
        </SidebarIcon>
    );
}

export function ReportsNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M14 3H5v18h14V8zM14 3v5h5M8 11h3m-3 4h7m-7 3h5" />
        </SidebarIcon>
    );
}

export function CustomersNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M10 21v-5h4v5M9 7h1m4 0h1m-6 4h1m4 0h1" />
        </SidebarIcon>
    );
}

export function ClaimsNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M10 21H4V3h10l4 4v3M14 3v4h4M7 10h4m-4 4h2m7-3 5 2v3c0 2.4-1.9 4.2-5 5.5-3.1-1.3-5-3.1-5-5.5v-3z" />
        </SidebarIcon>
    );
}

export function DisputesNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M14 3H4v18h16V9M14 3v6h6M7 7h3m-3 5h4m-4 4h2m5-3v5m3-5v5" />
        </SidebarIcon>
    );
}

export function AgentsNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <circle cx="12" cy="7" r="3.5" />
            <path d="M4 21v-2a8 8 0 0 1 16 0v2M9 16l3 3 3-3" />
        </SidebarIcon>
    );
}

export function LegalNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M12 3v18m-5 0h10M4 7h16M6 7l-3 7h6zm12 0-3 7h6zM3 14c0 2 6 2 6 0m6 0c0 2 6 2 6 0" />
        </SidebarIcon>
    );
}

export function PromiseToPayNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5" />
        </SidebarIcon>
    );
}

export function SettingsNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="m10 3-.5 2.4-2 .9-2.1-.8-2 3.5 1.8 1.6v2.8L3.4 15l2 3.5 2.1-.8 2 .9L10 21h4l.5-2.4 2-.9 2.1.8 2-3.5-1.8-1.6v-2.8L20.6 9l-2-3.5-2.1.8-2-.9L14 3z" />
            <circle cx="12" cy="12" r="3" />
        </SidebarIcon>
    );
}

export function ActivitySequencesNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <rect x="3" y="3" width="5" height="5" rx="1" />
            <rect x="16" y="9.5" width="5" height="5" rx="1" />
            <rect x="3" y="16" width="5" height="5" rx="1" />
            <path d="M8 5.5h4a3 3 0 0 1 3 3V12h1M16 12h-4a3 3 0 0 0-3 3v3.5H8" />
        </SidebarIcon>
    );
}

export function ImportNavIcon(props: SvgIconProps) {
    return (
        <SidebarIcon {...props}>
            <path d="M5 14H3v7h18v-7h-2M12 3v12m-4-4 4 4 4-4M3 17h4l2 2h6l2-2h4" />
        </SidebarIcon>
    );
}
