import type { ReactNode } from "react";

import "./cph-utilities.css";

/**
 * Loads Tailwind utilities only for `/credit-portfolio-health`.
 * Does not wrap in a box — an extra DOM node between AppShell `main` and the
 * dashboard shell breaks the negative-margin bleed in Safari, so left padding
 * would not match Credit Dashboard.
 */
export default function CreditPortfolioHealthLayout({
    children,
}: {
    children: ReactNode;
}) {
    return children;
}
