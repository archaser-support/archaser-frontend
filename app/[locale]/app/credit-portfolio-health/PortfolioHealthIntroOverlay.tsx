"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { SPACE_GROTESK_FONT_FAMILY } from "./fontTokens";
import styles from "./portfolioHealthIntro.module.css";
import { useIntroPercentChase } from "./useIntroPercentChase";

export type PortfolioHealthIntroOverlayProps = {
    progress: number;
    statusLine: string;
    isFading: boolean;
    /** When true, progress fill grows right → left. */
    isRtl?: boolean;
};

function measureVisibleOverlayHeight(overlay: HTMLElement): number {
    const rect = overlay.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(window.innerHeight, rect.bottom);
    return Math.max(0, Math.round(visibleBottom - visibleTop));
}

/**
 * Presentational cinematic intro: large % counter + teal progress bar.
 * No dismiss controls (click/Escape) — full beat always completes once started.
 *
 * Progress UI is sticky-centered to the *visible* viewport band: the overlay
 * still covers the full tall page body, but flex-centering that tall box put
 * the bar mid-document (too low on screen).
 */
export function PortfolioHealthIntroOverlay({
    progress,
    statusLine,
    isFading,
    isRtl = false,
}: PortfolioHealthIntroOverlayProps) {
    const clamped = Math.max(0, Math.min(100, progress));
    const percent = useIntroPercentChase(clamped);
    const overlayRef = useRef<HTMLDivElement>(null);
    const centerRef = useRef<HTMLDivElement>(null);
    const [visibleHeightPx, setVisibleHeightPx] = useState<number | null>(null);

    useLayoutEffect(() => {
        const overlay = overlayRef.current;
        if (!overlay) {
            return;
        }

        const update = () => {
            const next = measureVisibleOverlayHeight(overlay);
            setVisibleHeightPx((prev) => (prev === next ? prev : next));
        };

        update();
        window.addEventListener("resize", update);
        window.addEventListener("scroll", update, true);
        return () => {
            window.removeEventListener("resize", update);
            window.removeEventListener("scroll", update, true);
        };
    }, []);

    return (
        <div
            ref={overlayRef}
            className={`${styles.overlay}${isFading ? ` ${styles.overlayFading}` : ""}`}
            role="status"
            aria-live="polite"
            aria-busy={!isFading}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clamped)}
            aria-label={statusLine}
        >
            <div
                className={styles.viewportCenter}
                style={
                    visibleHeightPx != null
                        ? { height: visibleHeightPx }
                        : undefined
                }
            >
                <div ref={centerRef} className={styles.center}>
                    <p
                        className={styles.percent}
                        style={{ fontFamily: SPACE_GROTESK_FONT_FAMILY }}
                        aria-hidden="true"
                    >
                        {percent}%
                    </p>
                    <div
                        className={`${styles.track}${isRtl ? ` ${styles.trackRtl}` : ""}`}
                        dir={isRtl ? "rtl" : "ltr"}
                    >
                        <div
                            className={styles.fill}
                            style={{ width: `${clamped}%` }}
                        />
                    </div>
                    <p className={styles.status}>{statusLine}</p>
                </div>
            </div>
        </div>
    );
}
