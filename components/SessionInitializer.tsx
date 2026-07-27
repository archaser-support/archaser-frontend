"use client";

import { Box, CircularProgress } from "@mui/material";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface SessionInitializerProps {
    children: React.ReactNode;
}

export const SessionInitializer: React.FC<SessionInitializerProps> = ({
    children,
}) => {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [isInitialized, setIsInitialized] = useState(false);
    const [initializationError, setInitializationError] = useState<
        string | null
    >(null);

    useEffect(() => {
        const initializeSession = async () => {
            try {
                // Wait for session to be loaded
                if (status === "loading") {
                    return;
                }

                // Handle unauthenticated state
                if (status === "unauthenticated") {
                    const currentPath = window.location.pathname;
                    if (!currentPath.includes("/login")) {
                        router.push("/login");
                    }
                    setIsInitialized(true);
                    return;
                }

                // Handle authenticated state
                if (status === "authenticated" && session) {
                    // Validate session data
                    if (!session.user?.id || !session.user?.email) {
                        setInitializationError("Invalid session data");
                        setIsInitialized(true);
                        return;
                    }

                    // Check for fresh login
                    if (typeof window !== "undefined") {
                        const freshLogin = localStorage.getItem("freshLogin");
                        const loginUserId = localStorage.getItem("loginUserId");

                        if (freshLogin === "true" && loginUserId) {
                            if (loginUserId !== session.user.id) {
                                // Session mismatch, reload the page
                                window.location.reload();
                                return;
                            } else {
                                // Clear fresh login flags
                                localStorage.removeItem("freshLogin");
                                localStorage.removeItem("loginUserId");
                                localStorage.removeItem("loginUserRole");
                                localStorage.removeItem("loginAccountId");
                            }
                        }
                    }

                    setIsInitialized(true);
                    setInitializationError(null);
                }
            } catch (error) {
                setInitializationError("Failed to initialize session");
                setIsInitialized(true);
            }
        };

        initializeSession();
    }, [session, status, router]);

    // Show loading state during initialization
    if (!isInitialized || status === "loading") {
        return (
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    width: "100%",
                }}
            >
                <CircularProgress size={48} />
            </Box>
        );
    }

    // Show error state
    if (initializationError) {
        return (
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: "100vh",
                    width: "100%",
                    color: "error.main",
                }}
            >
                <h2>Session Error</h2>
                <p>{initializationError}</p>
                <button onClick={() => window.location.reload()}>
                    Reload Page
                </button>
            </Box>
        );
    }

    return <>{children}</>;
};
