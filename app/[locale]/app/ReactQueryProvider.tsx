"use client";

import { broadcastQueryClient } from "@tanstack/query-broadcast-client-experimental";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient, type Query } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React from "react";

const MINUTE = 1000 * 60;

/** List/grid/search payloads are large — never write them into localStorage. */
function shouldPersistQuery(query: Query): boolean {
    if (query.state.status !== "success") {
        return false;
    }
    const root = query.queryKey[0];
    if (typeof root !== "string") {
        return false;
    }
    // Home KPIs are small enough to persist; skip other credit-* payloads.
    if (root === "credit-insurance" && query.queryKey[1] === "summary") {
        return true;
    }
    const skipPrefixes = [
        "globalSearch",
        "customers",
        "customer",
        "invoices",
        "invoice",
        "contacts",
        "disputes",
        "activities",
        "billing-connector",
        "endless",
        "grid",
        "report",
        "credit",
        "portfolio",
        "claims",
        "controlCenter",
        "import",
    ];
    return !skipPrefixes.some(
        (prefix) =>
            root === prefix ||
            root.startsWith(`${prefix}-`) ||
            root.startsWith(prefix)
    );
}

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Short stale window avoids refetch storms on every focus/navigation
            // while still feeling fresh for collections work.
            staleTime: 30 * 1000,
            // Keep data in cache for 5 minutes
            gcTime: 5 * MINUTE,
            // Refetch on window focus for better session handling
            refetchOnWindowFocus: true,
            // Retry failed requests twice
            retry: 2,
        },
    },
});

const persister = createSyncStoragePersister({
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
});

// Track if broadcast client has been initialized to prevent duplicates during hot reloading
// Use global to persist across hot reloads in development
if (typeof global !== "undefined") {
    (global as any).__reactQueryBroadcastInitialized =
        (global as any).__reactQueryBroadcastInitialized || false;
}

if (!(global as any).__reactQueryBroadcastInitialized) {
    broadcastQueryClient({
        queryClient,
        broadcastChannel: "archaser-broadcast-channel",
    });
    (global as any).__reactQueryBroadcastInitialized = true;
}

// Set global query client for cache invalidation utilities
import { setGlobalQueryClient } from "@/utils/cacheUtils";
setGlobalQueryClient(queryClient);

export default function ReactQueryProvider({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: 5 * MINUTE,
                // Drop pre-filter localStorage blobs that rehydrated full grids into heap.
                buster: "rq-persist-v2-skip-lists",
                dehydrateOptions: {
                    shouldDehydrateQuery: shouldPersistQuery,
                },
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
