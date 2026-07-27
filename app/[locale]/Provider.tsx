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
    return (
        <SessionProvider
            refetchInterval={0}
            refetchOnWindowFocus={true}
            refetchWhenOffline={false}
        >
            {children}
        </SessionProvider>
    );
}

export default function Provider({ children }: ProviderProps) {
    const pathname = usePathname();
    const isPortalRoute = pathname?.includes("/portal/");

    return (
        <>
            {!isPortalRoute && <SessionLanguageMonitor />}
            {!isPortalRoute && <InactivityMonitor />}
            <ThemeRegistry>
                <ToastProvider>{children}</ToastProvider>
            </ThemeRegistry>
        </>
    );
}
