"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import {
    clearPortfolioHealthIntroPlayed,
    hasPortfolioHealthIntroPlayed,
    markPortfolioHealthIntroPlayed,
} from "./portfolioHealthIntroSession";

/** Cosmetic fill duration (~3–4s). Not tied to API completion. */
export const PORTFOLIO_HEALTH_INTRO_DURATION_MS = 3500;

/** Fade-out after the bar reaches 100%. */
export const PORTFOLIO_HEALTH_INTRO_FADE_MS = 450;

/** How often to publish progress to React (avoids per-frame setState depth issues). */
const PROGRESS_TICK_MS = 100;

const FALLBACK_STATUS_LINES = [
    "Loading portfolio health…",
    "Loading utilisation…",
    "Loading coverage…",
    "Loading costs…",
] as const;

export type PortfolioHealthIntroController = {
    /** Overlay is mounted (playing or fading). */
    isOverlayVisible: boolean;
    /** True while opacity is animating out after 100%. */
    isFading: boolean;
    /** 0–100 time-based progress. */
    progress: number;
    /** Rotating status line for the current progress quarter. */
    statusLine: string;
    /**
     * Clear the session flag and restart the intro immediately.
     * Wired to title multi-click replay.
     */
    replay: () => void;
};

export type UsePortfolioHealthIntroOptions = {
    prefersReducedMotion?: boolean;
    /** Translated lines in order: health → utilisation → coverage → costs. */
    statusLines?: readonly string[];
};

type Phase = "idle" | "playing" | "fading";

function readPrefersReducedMotion(): boolean {
    if (typeof window === "undefined" || !window.matchMedia) {
        return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function statusLineForProgress(
    progress: number,
    lines: readonly string[]
): string {
    if (lines.length === 0) {
        return FALLBACK_STATUS_LINES[0];
    }
    const quarter = 100 / lines.length;
    const index = Math.min(
        lines.length - 1,
        Math.floor(progress / quarter)
    );
    return lines[index] ?? lines[0]!;
}

/**
 * Single intro controller seam: session gate, reduce-motion skip,
 * time-based progress, status rotation, fade, replay.
 *
 * Progress is published on an interval (not requestAnimationFrame) so Safari /
 * React never nest dozens of setState calls from a re-entrant frame callback
 * (Maximum update depth exceeded in useEffect.tick).
 */
export function usePortfolioHealthIntro(
    options: UsePortfolioHealthIntroOptions = {}
): PortfolioHealthIntroController {
    const { prefersReducedMotion = false, statusLines } = options;
    const lines = statusLines?.length
        ? statusLines
        : FALLBACK_STATUS_LINES;

    const [phase, setPhase] = useState<Phase>("idle");
    const [progress, setProgress] = useState(0);
    const [runId, setRunId] = useState(0);
    const fadeTimerRef = useRef<number | null>(null);
    const progressTimerRef = useRef<number | null>(null);
    const autoStartedRef = useRef(false);

    useLayoutEffect(() => {
        const skipMotion =
            prefersReducedMotion || readPrefersReducedMotion();

        if (skipMotion) {
            markPortfolioHealthIntroPlayed();
            if (fadeTimerRef.current != null) {
                window.clearTimeout(fadeTimerRef.current);
                fadeTimerRef.current = null;
            }
            if (progressTimerRef.current != null) {
                window.clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
            }
            setPhase("idle");
            setProgress(0);
            return;
        }

        if (autoStartedRef.current) {
            return;
        }
        autoStartedRef.current = true;

        if (hasPortfolioHealthIntroPlayed()) {
            return;
        }
        setPhase("playing");
        setProgress(0);
        setRunId((id) => id + 1);
    }, [prefersReducedMotion]);

    useEffect(() => {
        if (phase !== "playing") {
            return;
        }

        const startedAt = performance.now();

        const publish = () => {
            const elapsed = performance.now() - startedAt;
            const next = Math.min(
                100,
                (elapsed / PORTFOLIO_HEALTH_INTRO_DURATION_MS) * 100
            );
            // Bail out on identical rounded values so React does not schedule work.
            setProgress((prev) => {
                const rounded = Math.round(next * 10) / 10;
                return prev === rounded ? prev : rounded;
            });
            if (next >= 100) {
                if (progressTimerRef.current != null) {
                    window.clearInterval(progressTimerRef.current);
                    progressTimerRef.current = null;
                }
                markPortfolioHealthIntroPlayed();
                setPhase("fading");
            }
        };

        publish();
        progressTimerRef.current = window.setInterval(
            publish,
            PROGRESS_TICK_MS
        );
        return () => {
            if (progressTimerRef.current != null) {
                window.clearInterval(progressTimerRef.current);
                progressTimerRef.current = null;
            }
        };
    }, [phase, runId]);

    useEffect(() => {
        if (phase !== "fading") {
            return;
        }
        fadeTimerRef.current = window.setTimeout(() => {
            setPhase("idle");
            setProgress(100);
            fadeTimerRef.current = null;
        }, PORTFOLIO_HEALTH_INTRO_FADE_MS);
        return () => {
            if (fadeTimerRef.current != null) {
                window.clearTimeout(fadeTimerRef.current);
                fadeTimerRef.current = null;
            }
        };
    }, [phase]);

    const replay = useCallback(() => {
        if (prefersReducedMotion || readPrefersReducedMotion()) {
            markPortfolioHealthIntroPlayed();
            setPhase("idle");
            setProgress(0);
            return;
        }
        clearPortfolioHealthIntroPlayed();
        if (fadeTimerRef.current != null) {
            window.clearTimeout(fadeTimerRef.current);
            fadeTimerRef.current = null;
        }
        if (progressTimerRef.current != null) {
            window.clearInterval(progressTimerRef.current);
            progressTimerRef.current = null;
        }
        setProgress(0);
        setPhase("playing");
        setRunId((id) => id + 1);
    }, [prefersReducedMotion]);

    return {
        isOverlayVisible: phase === "playing" || phase === "fading",
        isFading: phase === "fading",
        progress,
        statusLine: statusLineForProgress(progress, lines),
        replay,
    };
}
