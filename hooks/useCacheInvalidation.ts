import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const useCacheInvalidation = () => {
    const queryClient = useQueryClient();

    const invalidateCustomerCache = useCallback(
        async (customerIds: number[]) => {
            try {
                // Invalidate specific customer queries
                await Promise.all(
                    customerIds.map((customerId) =>
                        queryClient.invalidateQueries({
                            queryKey: ["customer", customerId.toString()],
                        })
                    )
                );

                // Invalidate general customers list
                await queryClient.invalidateQueries({ queryKey: ["customer"] });

                // Invalidate invoices queries for affected customers
                await queryClient.invalidateQueries({ queryKey: ["invoices"] });

                // Invalidate control center stats since invoice changes affect stats
                await queryClient.invalidateQueries({
                    queryKey: ["controlCenterStats"],
                });

                return true;
            } catch (error) {
                console.error("Error invalidating customer cache:", error);
                return false;
            }
        },
        [queryClient]
    );

    const invalidateInvoiceCache = useCallback(
        async (invoiceIds: number[]) => {
            try {
                // Invalidate specific invoice queries
                await Promise.all(
                    invoiceIds.map((invoiceId) =>
                        queryClient.invalidateQueries({
                            queryKey: ["invoice", invoiceId.toString()],
                        })
                    )
                );

                // Invalidate general invoices list
                await queryClient.invalidateQueries({ queryKey: ["invoices"] });

                // Invalidate control center stats
                await queryClient.invalidateQueries({
                    queryKey: ["controlCenterStats"],
                });

                return true;
            } catch (error) {
                console.error("Error invalidating invoice cache:", error);
                return false;
            }
        },
        [queryClient]
    );

    const invalidateAllCache = useCallback(async () => {
        try {
            // Invalidate all queries
            await queryClient.invalidateQueries();
            return true;
        } catch (error) {
            console.error("Error invalidating all cache:", error);
            return false;
        }
    }, [queryClient]);

    const invalidateCacheByReason = useCallback(
        async (
            reason: string,
            affectedIds?: { customerIds?: number[]; invoiceIds?: number[] }
        ) => {
            try {
                const promises: Promise<any>[] = [];

                // Invalidate control center stats for most operations
                promises.push(
                    queryClient.invalidateQueries({
                        queryKey: ["controlCenterStats"],
                    })
                );

                if (affectedIds?.customerIds?.length) {
                    promises.push(invalidateCustomerCache(affectedIds.customerIds));
                }

                if (affectedIds?.invoiceIds?.length) {
                    promises.push(
                        invalidateInvoiceCache(affectedIds.invoiceIds)
                    );
                }

                await Promise.all(promises);
                return true;
            } catch (error) {
                console.error("Error invalidating cache by reason:", error);
                return false;
            }
        },
        [queryClient, invalidateCustomerCache, invalidateInvoiceCache]
    );

    return {
        invalidateCustomerCache,
        invalidateInvoiceCache,
        invalidateAllCache,
        invalidateCacheByReason,
    };
};
