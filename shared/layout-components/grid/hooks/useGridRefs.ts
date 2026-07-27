import { useRef } from "react";
import { GridRefs } from "../types";

/**
 * Hook to consolidate all grid-related refs
 * Phase 3: State Consolidation
 */
export const useGridRefs = (): GridRefs => {
    return {
        container: useRef<HTMLDivElement>(null),
        header: useRef<HTMLDivElement>(null),
        body: useRef<HTMLDivElement>(null),
        highlightedRow: useRef<HTMLDivElement | null>(null),
        wrapper: useRef<HTMLDivElement>(null),
    };
};
