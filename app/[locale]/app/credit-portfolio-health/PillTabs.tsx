"use client";

import type { KeyboardEvent } from "react";
import {
    Activity,
    Award,
    Shield,
    ShieldAlert,
    type LucideIcon,
} from "lucide-react";

import { CPH } from "./designTokens";
import layout from "./islandLayout.module.css";

export const PORTFOLIO_HEALTH_TAB_IDS = [
    "health",
    "no-coverage",
    "utilization",
    "costs",
] as const;

export type PortfolioHealthTabId = (typeof PORTFOLIO_HEALTH_TAB_IDS)[number];

const TAB_ICONS: Record<PortfolioHealthTabId, LucideIcon> = {
    health: Shield,
    "no-coverage": ShieldAlert,
    utilization: Activity,
    costs: Award,
};

export function parsePortfolioHealthTab(
    raw: string | null | undefined
): PortfolioHealthTabId {
    if (
        raw === "health" ||
        raw === "no-coverage" ||
        raw === "utilization" ||
        raw === "costs"
    ) {
        return raw;
    }
    return "health";
}

export type PillTabsProps = {
    activeTab: PortfolioHealthTabId;
    onChange: (tab: PortfolioHealthTabId) => void;
    labels: Record<PortfolioHealthTabId, string>;
    ariaLabel: string;
    isRtl?: boolean;
};

export function PillTabs({
    activeTab,
    onChange,
    labels,
    ariaLabel,
    isRtl = false,
}: PillTabsProps) {
    const order = isRtl
        ? [...PORTFOLIO_HEALTH_TAB_IDS].reverse()
        : PORTFOLIO_HEALTH_TAB_IDS;

    const focusTab = (tab: PortfolioHealthTabId) => {
        const el = document.getElementById(`cph-tab-${tab}`);
        el?.focus();
    };

    const onKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        tab: PortfolioHealthTabId
    ) => {
        const idx = order.indexOf(tab);
        if (idx < 0) {
            return;
        }
        let nextIdx = idx;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
            const forward =
                (event.key === "ArrowRight" && !isRtl) ||
                (event.key === "ArrowLeft" && isRtl);
            nextIdx = forward
                ? (idx + 1) % order.length
                : (idx - 1 + order.length) % order.length;
        } else if (event.key === "Home") {
            nextIdx = 0;
        } else if (event.key === "End") {
            nextIdx = order.length - 1;
        } else {
            return;
        }
        event.preventDefault();
        const next = order[nextIdx]!;
        onChange(next);
        focusTab(next);
    };

    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={layout.tabs}
        >
            {PORTFOLIO_HEALTH_TAB_IDS.map((tab) => {
                const selected = activeTab === tab;
                const Icon = TAB_ICONS[tab];
                return (
                    <button
                        key={tab}
                        id={`cph-tab-${tab}`}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={`cph-panel-${tab}`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(tab)}
                        onKeyDown={(e) => onKeyDown(e, tab)}
                        className={layout.tabBtn}
                        style={{
                            backgroundColor: selected ? CPH.jade : "transparent",
                            color: selected ? "#FFFFFF" : CPH.slate,
                        }}
                    >
                        <Icon size={15} strokeWidth={2.25} aria-hidden />
                        {labels[tab]}
                    </button>
                );
            })}
        </div>
    );
}
