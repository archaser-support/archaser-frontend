import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export const useSessionState = () => {
    const { data: session, status, update } = useSession();
    const router = useRouter();
    const [isSessionReady, setIsSessionReady] = useState(false);
    const [sessionError, setSessionError] = useState<string | null>(null);

    useEffect(() => {
        // Handle session loading states
        if (status === "loading") {
            setIsSessionReady(false);
            setSessionError(null);
            return;
        }

        if (status === "unauthenticated") {
            setIsSessionReady(false);
            setSessionError("Not authenticated");
            // Redirect to login if not on login page
            if (
                typeof window !== "undefined" &&
                !window.location.pathname.includes("/login")
            ) {
                router.push("/login");
            }
            return;
        }

        if (status === "authenticated" && session) {
            // Validate session data
            if (!session.user?.id || !session.user?.email) {
                setSessionError("Invalid session data");
                setIsSessionReady(false);
                return;
            }

            // Check if this is a fresh login — clear flags only; never reload
            // (reload raced the post-login hard-nav and loaded the app twice).
            if (typeof window !== "undefined") {
                const freshLogin = localStorage.getItem("freshLogin");
                const loginUserId = localStorage.getItem("loginUserId");

                if (freshLogin === "true" && loginUserId) {
                    localStorage.removeItem("freshLogin");
                    localStorage.removeItem("loginUserId");
                    localStorage.removeItem("loginUserRole");
                    localStorage.removeItem("loginAccountId");
                }
            }

            setIsSessionReady(true);
            setSessionError(null);
        }
    }, [session, status, router, isSessionReady]);

    // Function to refresh session
    const refreshSession = async () => {
        try {
            await update();
        } catch (error) {
            setSessionError("Failed to refresh session");
        }
    };

    // Function to check if session is valid
    const isSessionValid = () => {
        return (
            status === "authenticated" && session?.user?.id && isSessionReady
        );
    };

    return {
        session,
        status,
        isSessionReady,
        sessionError,
        refreshSession,
        isSessionValid,
        update,
    };
};
