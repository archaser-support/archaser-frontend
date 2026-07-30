"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { CreditDashboardTitleInfoIcon } from "@/app/[locale]/app/credit-dashboard/creditDashboardTitleTooltip";

import { CPH } from "./designTokens";

export type EyebrowProps = {
    children: ReactNode;
    icon?: LucideIcon;
    tone?: string;
    help?: string;
    /** Center title + help icon (e.g. Coverage Halo card). */
    centered?: boolean;
};

export function Eyebrow({
    children,
    icon: Icon,
    tone = CPH.slate,
    help,
    centered = false,
}: EyebrowProps) {
    const { i18n, t } = useTranslation(["dashboard"]);
    const isRtl =
        i18n.language === "he" || i18n.language.startsWith("he-");

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: centered ? "center" : undefined,
                gap: 6,
                marginBottom: 12,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tone,
                width: centered ? "100%" : undefined,
            }}
        >
            {Icon ? <Icon size={13} strokeWidth={2.25} aria-hidden /> : null}
            <span>{children}</span>
            {help ? (
                <CreditDashboardTitleInfoIcon
                    isRtl={isRtl}
                    title={help}
                    ariaLabel={t(
                        "credit_insurance_dashboard.chart_title_help_aria",
                        { ns: "dashboard" }
                    )}
                />
            ) : null}
        </div>
    );
}
