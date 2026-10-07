"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/app/api";
import { useSession } from "next-auth/react";
import { useMemo } from "react";

import {
    accountProductsFromSessionAccount,
    fetchSessionAccountById,
    sessionAccountQueryKey,
} from "@/shared/services/sessionAccountQuery";
import {
    appHomePathFallback,
    resolveAppHomePath,
} from "@/shared/utils/resolveAppHomePath";
import { isArchaserAdminAccount } from "@/shared/utils/navigation";

export type UseAppHomePathResult = {
    /** Locale-neutral app path (e.g. `/app/credit-dashboard`). Null while loading non-admin users. */
    homePath: string | null;
    isLoading: boolean;
};

export function useAppHomePath(): UseAppHomePathResult {
    const { data: session, status } = useSession();

    const effectiveAccountId = session?.user?.view_as_user_id
        ? session?.user?.view_as_user_account_id
        : session?.user?.account_id;
    const effectiveRole = session?.user?.view_as_user_id
        ? session?.user?.view_as_user_role
        : session?.user?.role;

    const isAdminAccount = isArchaserAdminAccount(effectiveAccountId);
    const isAuthenticated = status === "authenticated" && !!session?.user;

    const { data: permissionsData, isLoading: isLoadingPermissions } = useQuery<{
        permissions: string[];
    }>({
        queryKey: [
            "user-permissions",
            session?.user?.id,
            effectiveRole,
            effectiveAccountId,
        ],
        queryFn: async () => {
            const response = await api.get("/api/permissions/me");
            return response.data;
        },
        enabled: isAuthenticated && !isAdminAccount,
        staleTime: 60 * 1000,
    });

    const { data: accountProducts, isLoading: isLoadingAccountProducts } =
        useQuery<{
            has_collection?: boolean;
            has_credit_insurance?: boolean;
            is_demo?: boolean;
        }>({
            queryKey: sessionAccountQueryKey(effectiveAccountId),
            queryFn: async () => {
                if (!effectiveAccountId) {
                    return {
                        has_collection: true,
                        has_credit_insurance: false,
                        is_demo: false,
                    };
                }
                const account = await fetchSessionAccountById(effectiveAccountId);
                return accountProductsFromSessionAccount(account);
            },
            enabled: isAuthenticated && !isAdminAccount && !!effectiveAccountId,
            staleTime: 60 * 1000,
        });

    const sessionHomePath =
        !session?.user?.view_as_user_id && session?.user?.homePath
            ? session.user.homePath
            : undefined;

    const homePath = useMemo(() => {
        if (sessionHomePath) {
            return sessionHomePath;
        }

        if (!isAuthenticated) {
            return appHomePathFallback;
        }

        if (isAdminAccount) {
            return resolveAppHomePath({
                accountId: effectiveAccountId,
                permissions: [],
            });
        }

        if (isLoadingPermissions || isLoadingAccountProducts) {
            return null;
        }

        return resolveAppHomePath({
            accountId: effectiveAccountId,
            permissions: permissionsData?.permissions ?? [],
            accountProducts,
        });
    }, [
        sessionHomePath,
        isAuthenticated,
        isAdminAccount,
        effectiveAccountId,
        isLoadingPermissions,
        isLoadingAccountProducts,
        permissionsData?.permissions,
        accountProducts,
    ]);

    const isLoading =
        isAuthenticated &&
        !isAdminAccount &&
        !sessionHomePath &&
        (isLoadingPermissions || isLoadingAccountProducts);

    return { homePath, isLoading };
}
