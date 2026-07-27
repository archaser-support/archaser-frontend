import type { ReactNode } from "react";

import { spaceGrotesk } from "./fonts";

import "./cph-utilities.css";

/**
 * Loads Space Grotesk + Tailwind utilities only for `/credit-portfolio-health`.
 * Does not apply either app-wide.
 */
export default function CreditPortfolioHealthLayout({
    children,
}: {
    children: ReactNode;
}) {
    return <div className={spaceGrotesk.variable}>{children}</div>;
}
