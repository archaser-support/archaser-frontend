"use client";

import { useEffect, useRef, useState } from "react";

/** How quickly the displayed % follows the bar target (higher = snappier). */
const CHASE_LERP = 0.18;

/**
 * Smooth percent display that chases a 0–100 target.
 * Snaps down immediately when the target drops (five-click replay).
 * Publishes whole numbers only to limit React updates.
 */
export function useIntroPercentChase(target: number): number {
    const clampedTarget = Math.max(0, Math.min(100, target));
    const [display, setDisplay] = useState(() => Math.round(clampedTarget));
    const valueRef = useRef(clampedTarget);
    const targetRef = useRef(clampedTarget);

    targetRef.current = clampedTarget;

    useEffect(() => {
        let frameId = 0;

        const tick = () => {
            const goal = targetRef.current;
            let current = valueRef.current;

            // Replay / reset: snap down so the counter does not ease from 67% → 0%.
            if (goal < current - 0.5) {
                current = goal;
                valueRef.current = current;
                const rounded = Math.round(current);
                setDisplay((prev) => (prev === rounded ? prev : rounded));
                frameId = window.requestAnimationFrame(tick);
                return;
            }

            const delta = goal - current;
            if (Math.abs(delta) < 0.05) {
                current = goal;
            } else {
                current = current + delta * CHASE_LERP;
            }
            valueRef.current = current;

            const rounded = Math.round(current);
            setDisplay((prev) => (prev === rounded ? prev : rounded));
            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);
        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    return display;
}
