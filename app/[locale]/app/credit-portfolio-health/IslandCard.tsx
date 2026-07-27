"use client";

import type { CSSProperties, ReactNode } from "react";

import { CPH, accentColor, type IslandAccent } from "./designTokens";

export type IslandCardProps = {
    children: ReactNode;
    accent?: IslandAccent;
    className?: string;
    style?: CSSProperties;
};

export function IslandCard({
    children,
    accent = "slate",
    className = "",
    style,
}: IslandCardProps) {
    const accentHex = accentColor(accent);
    return (
        <div
            className={className}
            style={{
                position: "relative",
                overflow: "hidden",
                borderRadius: 16,
                border: `1px solid ${CPH.border}`,
                background: CPH.card,
                boxShadow: CPH.shadow,
                ...style,
            }}
        >
            <div
                aria-hidden
                style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                    height: 2,
                    background: `linear-gradient(90deg, ${accentHex}, transparent)`,
                    pointerEvents: "none",
                }}
            />
            {children}
        </div>
    );
}
