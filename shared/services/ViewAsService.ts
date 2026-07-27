import { apiFetch } from "@/utils/apiFetch";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export interface ViewAsUser {
    id: string;
    name: string;
    email: string;
    role: string;
    account_id?: number;
    Account?: {
        id: number;
        name: string;
    };
}

export interface ViewAsServiceOptions {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    redirectAfterClear?: string;
    showToast?: (
        message: string,
        type: "success" | "error",
        duration?: number
    ) => void;
}

export class ViewAsService {
    private static instance: ViewAsService;

    private constructor() { }

    public static getInstance(): ViewAsService {
        if (!ViewAsService.instance) {
            ViewAsService.instance = new ViewAsService();
        }
        return ViewAsService.instance;
    }

    /**
     * Set view-as user
     */
    public async setViewAsUser(
        userId: string,
        update: (data: { view_as_user_id: string }) => Promise<any>,
        options: ViewAsServiceOptions = {}
    ): Promise<boolean> {
        try {
            // Make API call to set view-as user
            const response = await apiFetch("/api/entities/users/view-as", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to set view-as user"
                );
            }

            // Update the session - NextAuth callback will handle fetching other view-as user data
            await update({ view_as_user_id: userId });

            // Call success callback
            options.onSuccess?.();

            return true;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "An error occurred";
            options.onError?.(errorMessage);
            options.showToast?.(errorMessage, "error", 4000);
            return false;
        }
    }

    /**
     * Clear view-as user
     */
    public async clearViewAsUser(
        update: (data: {
            view_as_user_id?: undefined;
            view_as_user_account_id?: undefined;
            view_as_user_role?: undefined;
            view_as_user_account_name?: undefined;
        }) => Promise<any>,
        router?: any,
        options: ViewAsServiceOptions = {}
    ): Promise<boolean> {
        try {
            // Make API call to clear view-as user
            const response = await apiFetch("/api/entities/users/view-as", {
                method: "DELETE",
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                    errorData.error || "Failed to clear view-as user"
                );
            }

            // Clear all view-as user session information
            await update({
                view_as_user_id: undefined,
                view_as_user_account_id: undefined,
                view_as_user_role: undefined,
                view_as_user_account_name: undefined,
            });

            // Call success callback
            options.onSuccess?.();

            // Redirect if specified
            if (options.redirectAfterClear && router) {
                router.push(options.redirectAfterClear);
            }

            return true;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : "An error occurred";
            options.onError?.(errorMessage);
            options.showToast?.(errorMessage, "error", 4000);
            return false;
        }
    }

    /**
     * Check if currently in view-as mode
     */
    public isInViewAsMode(session: any): boolean {
        return !!session?.user?.view_as_user_id;
    }

    /**
     * Get current view-as user from session
     */
    public getCurrentViewAsUser(session: any): any {
        if (!this.isInViewAsMode(session)) {
            return null;
        }

        return {
            id: session.user.view_as_user_id,
            account_id: session.user.view_as_user_account_id,
            role: session.user.view_as_user_role,
            account_name: session.user.view_as_user_account_name,
        };
    }
}

// React hook for using ViewAsService
export const useViewAsService = () => {
    const { data: session, update } = useSession();
    const router = useRouter();

    const viewAsService = ViewAsService.getInstance();

    const setViewAsUser = async (
        userId: string,
        options: ViewAsServiceOptions = {}
    ) => {
        return await viewAsService.setViewAsUser(userId, update, options);
    };

    const clearViewAsUser = async (options: ViewAsServiceOptions = {}) => {
        return await viewAsService.clearViewAsUser(update, router, options);
    };

    const isInViewAsMode = viewAsService.isInViewAsMode(session);
    const currentViewAsUser = viewAsService.getCurrentViewAsUser(session);

    return {
        setViewAsUser,
        clearViewAsUser,
        isInViewAsMode,
        currentViewAsUser,
        session,
    };
};
