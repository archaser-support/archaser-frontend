"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CPH } from "./designTokens";

export type EyebrowProps = {
    children: ReactNode;
    icon?: LucideIcon;
    tone?: string;
    help?: string;
};

export function Eyebrow({
    children,
    icon: Icon,
    tone = CPH.slate,
    help,
}: EyebrowProps) {
    return (
        <div
            title={help}
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 12,
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: tone,
            }}
        >
            {Icon ? <Icon size={13} strokeWidth={2.25} aria-hidden /> : null}
            <span>{children}</span>
        </div>
    );
}
