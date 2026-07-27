"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/app/api";
import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";

import {
    TooltipMetadata,
    GuidedTooltipContextValue,
    TooltipTier,
    MarkTooltipSeenRequest,
} from "@/types/guidedTooltips";

const SESSION_LIMIT = 3;

interface GuidedTooltipProviderProps {
    children: React.ReactNode;
    permissions?: string[];
    modules?: string[];
}

const GuidedTooltipContext = createContext<GuidedTooltipContextValue | null>(
    null
);

export function GuidedTooltipProvider({
    children,
    permissions = [],
    modules = [],
}: GuidedTooltipProviderProps) {
    const { data: session } = useSession();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const [registeredTooltips, setRegisteredTooltips] = useState<
        Map<string, TooltipMetadata>
    >(new Map());
    const [sessionCount, setSessionCount] = useState(0);
    const sessionCountRef = useRef(0);
    const [tooltipHistory, setTooltipHistory] = useState<TooltipMetadata[]>([]);

    // Reset session count on mount (new session)
    useEffect(() => {
        sessionCountRef.current = 0;
        setSessionCount(0);
    }, []);

    const userId = session?.user?.id;

    const { data: preferences, isLoading } = useQuery({
        queryKey: ["tooltipPreferences", userId],
        queryFn: async () => {
            const response = await api.get("/api/user-preferences/tooltips");
            return response.data;
        },
        enabled: !!userId,
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const markSeenMutation = useMutation({
        mutationFn: async (request: MarkTooltipSeenRequest) => {
            const response = await api.post(
                "/api/user-preferences/tooltips",
                request
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["tooltipPreferences", userId],
            });
        },
    });

    const toggleEnabledMutation = useMutation({
        mutationFn: async (enabled: boolean) => {
            const response = await api.put("/api/user-preferences/tooltips", {
                enabled,
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["tooltipPreferences", userId],
            });
        },
    });

    const resetMutation = useMutation({
        mutationFn: async () => {
            const response = await api.delete(
                "/api/user-preferences/tooltips"
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["tooltipPreferences", userId],
            });
            // Reset session state
            sessionCountRef.current = 0;
            setSessionCount(0);
            setTooltipHistory([]);
            setActiveTooltip(null);
        },
    });

    const enabled = preferences?.enabled ?? true;
    const seenTooltipsSet = useMemo(() => {
        const set = new Set<string>();
        if (preferences?.seenTooltips) {
            preferences.seenTooltips.forEach((item: any) => {
                set.add(item.tooltipId);
            });
        }
        return set;
    }, [preferences]);

    const registerTooltip = useCallback((metadata: TooltipMetadata) => {
        setRegisteredTooltips((prev) => {
            const next = new Map(prev);
            next.set(metadata.id, metadata);
            return next;
        });
    }, []);

    const unregisterTooltip = useCallback((id: string) => {
        setRegisteredTooltips((prev) => {
            const next = new Map(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const hasPermission = useCallback(
        (requiredPermission?: string, requiredModule?: string) => {
            if (
                requiredPermission &&
                !permissions.includes(requiredPermission)
            ) {
                return false;
            }
            if (requiredModule && !modules.includes(requiredModule)) {
                return false;
            }
            return true;
        },
        [permissions, modules]
    );

    const getNextTooltip = useCallback((): TooltipMetadata | null => {
        if (!enabled || isLoading || registeredTooltips.size === 0) {
            return null;
        }

        const tooltips = Array.from(registeredTooltips.values());

        const availableTooltips = tooltips.filter((tooltip) => {
            if (seenTooltipsSet.has(tooltip.id)) {
                return false;
            }
            if (
                !hasPermission(
                    tooltip.requiredPermission,
                    tooltip.requiredModule
                )
            ) {
                return false;
            }
            // Filter by page: if tooltip has a page property, only show it on that page
            if (tooltip.page) {
                // Remove locale prefix from pathname for comparison
                const pathWithoutLocale =
                    pathname?.replace(/^\/[a-z]{2}/, "") || "";
                // Check if current path matches the tooltip's page or starts with it
                if (
                    pathWithoutLocale !== tooltip.page &&
                    !pathWithoutLocale.startsWith(tooltip.page)
                ) {
                    return false;
                }
            }
            return true;
        });

        if (availableTooltips.length === 0) {
            return null;
        }

        const sortedByTier = availableTooltips.sort((a, b) => {
            if (a.tier !== b.tier) {
                return a.tier - b.tier;
            }
            return a.order - b.order;
        });

        const currentTier = sortedByTier[0].tier;
        const tierTooltips = sortedByTier.filter((t) => t.tier === currentTier);

        const nextInTier = tierTooltips.find((t) => !seenTooltipsSet.has(t.id));

        if (nextInTier && sessionCountRef.current < SESSION_LIMIT) {
            return nextInTier;
        }

        return null;
    }, [
        enabled,
        isLoading,
        registeredTooltips,
        seenTooltipsSet,
        hasPermission,
        pathname,
    ]);

    const [activeTooltip, setActiveTooltip] = useState<TooltipMetadata | null>(
        null
    );

    useEffect(() => {
        if (!enabled || isLoading) {
            setActiveTooltip(null);
            return;
        }

        const next = getNextTooltip();
        setActiveTooltip(next);
    }, [enabled, isLoading, getNextTooltip]);

    const markSeen = useCallback(
        async (tooltipId: string) => {
            const tooltip = registeredTooltips.get(tooltipId);
            if (!tooltip) {
                return;
            }

            await markSeenMutation.mutateAsync({
                tooltipId,
                tier: tooltip.tier,
                order: tooltip.order,
                page: tooltip.page,
            });

            setSessionCount((prev) => {
                const newCount = prev + 1;
                sessionCountRef.current = newCount;
                return newCount;
            });
        },
        [registeredTooltips, markSeenMutation]
    );

    const next = useCallback(() => {
        if (activeTooltip) {
            setTooltipHistory((prev) => [...prev, activeTooltip]);
            markSeen(activeTooltip.id).then(() => {
                const nextTooltip = getNextTooltip();
                setActiveTooltip(nextTooltip);
            });
        }
    }, [activeTooltip, markSeen, getNextTooltip]);

    const previous = useCallback(() => {
        if (tooltipHistory.length > 0) {
            const previousTooltip = tooltipHistory[tooltipHistory.length - 1];
            setTooltipHistory((prev) => prev.slice(0, -1));
            setActiveTooltip(previousTooltip);
        }
    }, [tooltipHistory]);

    const close = useCallback(() => {
        if (activeTooltip) {
            markSeen(activeTooltip.id).then(() => {
                setActiveTooltip(null);
            });
        }
    }, [activeTooltip, markSeen]);

    const closeAll = useCallback(async () => {
        await toggleEnabledMutation.mutateAsync(false);
        setActiveTooltip(null);
    }, [toggleEnabledMutation]);

    const reset = useCallback(async () => {
        await resetMutation.mutateAsync();
    }, [resetMutation]);

    // Expose reset function to window for console access
    useEffect(() => {
        if (typeof window !== "undefined") {
            (window as any).__resetTooltips = reset;
        }
        return () => {
            if (typeof window !== "undefined") {
                delete (window as any).__resetTooltips;
            }
        };
    }, [reset]);

    const value: GuidedTooltipContextValue = {
        enabled,
        activeTooltip,
        seenTooltips: seenTooltipsSet,
        sessionCount: sessionCountRef.current,
        hasHistory: tooltipHistory.length > 0,
        registerTooltip,
        unregisterTooltip,
        markSeen,
        next,
        previous,
        close,
        closeAll,
        reset,
        isLoading,
    };

    return (
        <GuidedTooltipContext.Provider value={value}>
            {children}
        </GuidedTooltipContext.Provider>
    );
}

export function useGuidedTooltip() {
    const context = useContext(GuidedTooltipContext);
    if (!context) {
        throw new Error(
            "useGuidedTooltip must be used within GuidedTooltipProvider"
        );
    }
    return context;
}
