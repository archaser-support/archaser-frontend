"use client";

import { useRouter , usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useCallback } from "react";

interface UseIdleTimeoutOptions {
    timeoutMinutes?: number;
    enabled?: boolean;
    onIdle?: () => void;
}

/**
 * Custom hook to automatically logout user after a period of inactivity
 * Monitors mouse movements, clicks, keyboard activity, and scroll events
 */
export function useIdleTimeout({
    timeoutMinutes,
    enabled = true,
    onIdle,
}: UseIdleTimeoutOptions = {}) {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastActivityRef = useRef<number>(Date.now());
    const router = useRouter();
    const pathname = usePathname();

    // Get timeout from environment variable (in minutes) or use default
    // For client-side, NEXT_PUBLIC_ variables are embedded at build time
    const getTimeoutMinutes = useCallback(() => {
        if (timeoutMinutes !== undefined) {
            return timeoutMinutes;
        }

        // Try to get from environment variable (available at build time)
        const envTimeout = process.env.NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES;
        if (envTimeout) {
            const parsed = parseInt(envTimeout, 10);
            if (!isNaN(parsed) && parsed > 0) {
                return parsed;
            }
        }

        return 15; // Default to 15 minutes
    }, [timeoutMinutes]);

    // Handle idle timeout - logout user
    // Define this first since resetTimer depends on it
    const handleIdle = useCallback(async () => {
        // Don't logout if user is on login page
        // Portal pages are public and don't require authentication, so we don't monitor them
        if (pathname?.includes("/login")) {
            return;
        }

        // For portal pages, we don't want to logout since they're public
        // The InactivityMonitor only runs when session exists, so this check is extra safety
        if (pathname?.includes("/portal")) {
            return;
        }

        // Call custom onIdle handler if provided
        if (onIdle) {
            onIdle();
        }

        // Logout user
        try {
            await signOut({ redirect: false });

            // Get current locale from pathname or default to 'en'
            const locale = pathname?.split("/")[1] || "en";
            router.push(`/${locale}/login`);
        } catch (error) {
            console.error("Error during automatic logout:", error);
        }
    }, [pathname, router, onIdle]);

    // Function to reset the idle timer
    // Defined after handleIdle so it can reference it
    const resetTimer = useCallback(() => {
        if (!enabled) {
            return;
        }

        lastActivityRef.current = Date.now();

        // Clear existing timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Set new timeout
        const timeoutMinutes = getTimeoutMinutes();
        const timeoutMs = timeoutMinutes * 60 * 1000;

        timeoutRef.current = setTimeout(() => {
            handleIdle();
        }, timeoutMs);
    }, [enabled, getTimeoutMinutes, handleIdle]);

    useEffect(() => {
        if (!enabled) {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            return;
        }

        // Set initial timeout
        resetTimer();

        // Event handlers for user activity
        const events = [
            "mousedown",
            "mousemove",
            "keypress",
            "scroll",
            "touchstart",
            "click",
            "keydown",
        ];

        // Throttle activity detection to avoid excessive timer resets
        // Use a more aggressive throttle - only log/reset every 5 seconds of activity
        let throttleTimeout: ReturnType<typeof setTimeout> | null = null;
        let lastResetTime = 0;
        const throttledReset = () => {
            const now = Date.now();

            // Only reset if it's been at least 5 seconds since last reset
            // This prevents constant resets from mouse movements
            if (throttleTimeout) {
                return; // Already scheduled a reset
            }

            // Check if enough time has passed (5 seconds throttle)
            const throttleDelay = 5000; // 5 seconds
            if (now - lastResetTime < throttleDelay) {
                throttleTimeout = setTimeout(() => {
                    lastResetTime = Date.now();
                    resetTimer();
                    throttleTimeout = null;
                }, throttleDelay - (now - lastResetTime));
            } else {
                lastResetTime = now;
                resetTimer();
            }
        };

        // Add event listeners
        events.forEach((event) => {
            document.addEventListener(event, throttledReset, { passive: true });
        });

        // Also listen for visibility changes (tab focus)
        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                resetTimer();
            }
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);

        // Cleanup
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            if (throttleTimeout) {
                clearTimeout(throttleTimeout);
            }
            events.forEach((event) => {
                document.removeEventListener(event, throttledReset);
            });
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
        // Only depend on enabled - resetTimer is stable due to useCallback with proper deps
    }, [enabled, resetTimer]);
}

