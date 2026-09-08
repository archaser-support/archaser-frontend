/** sessionStorage key: portfolio health cinematic intro already played this browser session. */
export const PORTFOLIO_HEALTH_INTRO_SESSION_KEY =
    "cph-portfolio-health-intro-played";

export function hasPortfolioHealthIntroPlayed(): boolean {
    if (typeof window === "undefined") {
        return false;
    }
    try {
        return (
            window.sessionStorage.getItem(PORTFOLIO_HEALTH_INTRO_SESSION_KEY) ===
            "1"
        );
    } catch {
        return false;
    }
}

export function markPortfolioHealthIntroPlayed(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.setItem(PORTFOLIO_HEALTH_INTRO_SESSION_KEY, "1");
    } catch {
        // Ignore quota / private-mode failures; intro may replay next visit.
    }
}

export function clearPortfolioHealthIntroPlayed(): void {
    if (typeof window === "undefined") {
        return;
    }
    try {
        window.sessionStorage.removeItem(PORTFOLIO_HEALTH_INTRO_SESSION_KEY);
    } catch {
        // Ignore.
    }
}
