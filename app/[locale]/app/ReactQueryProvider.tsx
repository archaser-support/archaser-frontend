"use client";

import { broadcastQueryClient } from "@tanstack/query-broadcast-client-experimental";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import React from "react";

const MINUTE = 1000 * 60;

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // Default stale time to 0 for real-time data
            staleTime: 0,
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
                maxAge: 5 * MINUTE, // Increased max age for better persistence
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
