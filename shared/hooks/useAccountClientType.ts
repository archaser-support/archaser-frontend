"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

import { apiFetch } from "@/utils/apiFetch";

export type AccountClientType = "All" | "Person" | "Company";

/**
 * Account-level customer type ("All" means the account mixes people and
 * companies, so type columns/filters stay visible). Defaults to "All" while
 * loading or when the account cannot be read.
 */
export function useAccountClientType(): AccountClientType {
    const { data: session } = useSession();
    const accountId = session?.user?.account_id;
    const [clientType, setClientType] = useState<AccountClientType>("All");

    useEffect(() => {
        if (!accountId) {
            return;
        }
        let cancelled = false;

        (async () => {
            try {
                const response = await apiFetch(
                    `/api/entities/accounts/${accountId}`
                );
                if (!response.ok) {
                    return;
                }
                const data = (await response.json()) as {
                    client_type?: string | null;
                };
                const value = data?.client_type;
                if (
                    !cancelled &&
                    (value === "Person" ||
                        value === "Company" ||
                        value === "All")
                ) {
                    setClientType(value);
                }
            } catch {
                // Keep the "All" default when the account lookup fails.
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [accountId]);

    return clientType;
}
