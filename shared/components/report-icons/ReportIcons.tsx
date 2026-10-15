"use client";

import SvgIcon, { type SvgIconProps } from "@mui/material/SvgIcon";
import type { ReactNode } from "react";

/**
 * ARChaser report toolbar / viewer outline icons from the approved icon pack
 * (24×24, 1.8 stroke, currentColor). Do not mirror in RTL.
 */
const strokeProps = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

function ReportIcon({
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
                    fill: "none",
                    overflow: "visible",
                    flexShrink: 0,
                    display: "block",
                    width: "1em",
                    height: "1em",
                    boxSizing: "content-box",
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

export function RefreshReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M20 9A7.5 7.5 0 1 0 17.5 18" />
            <path d="M20 4v5h-5" />
        </ReportIcon>
    );
}

export function EditFiltersReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M4 6h16M4 12h16M4 18h16" />
            <circle cx="8" cy="6" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="16" cy="12" r="2.2" fill="currentColor" stroke="none" />
            <circle cx="12" cy="18" r="2.2" fill="currentColor" stroke="none" />
        </ReportIcon>
    );
}

export function EditReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M13 4.5 19.5 11 9 21.5H2.5V15z" />
            <path d="M13 4.5 16.5 1" />
        </ReportIcon>
    );
}

export function ShareReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <circle cx="18" cy="5" r="2.5" />
            <circle cx="6" cy="12" r="2.5" />
            <circle cx="18" cy="19" r="2.5" />
            <path d="m8.6 10.8 6.8-3.6M8.6 13.2l6.8 3.6" />
        </ReportIcon>
    );
}

export function ExportReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M12 3v12m-4-4 4 4 4-4" />
            <path d="M5 17v4h14v-4" />
        </ReportIcon>
    );
}

export function MoreActionsReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <circle cx="6" cy="12" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.8" fill="currentColor" stroke="none" />
            <circle cx="18" cy="12" r="1.8" fill="currentColor" stroke="none" />
        </ReportIcon>
    );
}

export function SearchReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m15.5 15.5 5.5 5.5" />
        </ReportIcon>
    );
}

export function CreateReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M5 3.5h9.5V8H19.5v13.5H5zM14.5 3.5V8h5" />
            <path d="M8.5 11.5h3.5M8.5 15.5h7M8.5 18.5h5" />
            <path d="M18 1.5v7M14.5 5h7" />
        </ReportIcon>
    );
}

export function CreateViewReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <rect x="3" y="4" width="15" height="16" rx="1.2" />
            <path d="M3 9.5h15M10.5 9.5V20" />
            <path d="M18.5 1.5v7M15 5h7" />
        </ReportIcon>
    );
}

export function CloneReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <rect x="8" y="8" width="11" height="11" rx="1.5" />
            <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
        </ReportIcon>
    );
}

export function DeleteReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13M10 11v6m4-6v6" />
        </ReportIcon>
    );
}

export function ChevronDownReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="m6 9 6 6 6-6" />
        </ReportIcon>
    );
}

export function CloseReportIcon(props: SvgIconProps) {
    return (
        <ReportIcon {...props}>
            <path d="M6 6l12 12M18 6 6 18" />
        </ReportIcon>
    );
}
