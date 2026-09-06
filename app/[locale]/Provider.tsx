"use client";

import { usePathname } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

import ThemeRegistry from "@/app/ThemeRegistry";
import InactivityMonitor from "@/components/InactivityMonitor";
import SessionLanguageMonitor from "@/components/SessionLanguageMonitor";
import { ToastProvider } from "@/shared/layout-components/toast/ToastProvider";

interface ProviderProps {
    children: ReactNode;
}

export function SessionProviderWrapper({ children }: ProviderProps) {
    const pathname = usePathname();
    const isAuthRoute =
        pathname?.includes("/login") ||
        pathname?.includes("/forget-password") ||
        pathname?.includes("/reset-password");

    return (
        <SessionProvider
            refetchInterval={0}
            refetchOnWindowFocus={!isAuthRoute}
            refetchWhenOffline={false}
        >
            {children}
        </SessionProvider>
    );
}

export default function Provider({ children }: ProviderProps) {
    const pathname = usePathname();
    const isPortalRoute = pathname?.includes("/portal/") ?? false;
    const isAuthRoute =
        pathname?.includes("/login") ||
        pathname?.includes("/forget-password") ||
        pathname?.includes("/reset-password");

    return (
        <>
            {!isPortalRoute && !isAuthRoute && <SessionLanguageMonitor />}
            {!isPortalRoute && !isAuthRoute && <InactivityMonitor />}
            <ThemeRegistry>
                <ToastProvider>{children}</ToastProvider>
            </ThemeRegistry>
        </>
    );
}
