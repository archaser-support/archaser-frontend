"use client";

import { Box, CircularProgress } from "@mui/material";
import { useRouter, usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState, ReactNode } from "react";

interface AuthWrapperProps {
    children: ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
    const { data: session, status } = useSession();
    const router = useRouter();
    const pathname = usePathname();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        // Don't redirect if already on login page or if redirecting
        if (pathname?.includes("/login") || isRedirecting) {
            return;
        }

        // If session is loading, wait
        if (status === "loading") {
            return;
        }

        // If no session and not on login page, redirect to login
        if (status === "unauthenticated" || !session) {
            setIsRedirecting(true);

            // Extract current locale from pathname
            const currentLocale = pathname?.split("/")[1] || "en";
            const loginUrl = `/${currentLocale}/login`;

            router.push(loginUrl);
        }
    }, [session, status, pathname, router, isRedirecting]);

    // Show loading while session is loading or redirecting
    if (status === "loading" || isRedirecting) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    alignItems: "center",
                    height: "100vh",
                    gap: 2,
                }}
            >
                <CircularProgress color="primary" size={40} />
            </Box>
        );
    }

    // If no session and not redirecting, show nothing (redirect will happen)
    if (!session && !isRedirecting) {
        return null;
    }

    return <>{children}</>;
}
