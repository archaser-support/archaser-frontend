"use client";

import { useSession } from "next-auth/react";

import { useIdleTimeout } from "@/hooks/useIdleTimeout";

/**
 * Component that monitors user inactivity and automatically logs them out
 * Uses the NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES environment variable for timeout duration
 * Disabled in development environment
 */
export default function InactivityMonitor() {
    const { data: session, status } = useSession();

    // Disable auto logout in development environment
    const isDevelopment = process.env.NODE_ENV === "development";

    // Only monitor if user is authenticated and not in development
    useIdleTimeout({
        enabled: !!session && status === "authenticated" && !isDevelopment,
    });

    // This component doesn't render anything
    return null;
}

