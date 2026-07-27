/**
 * Types for the guided tooltip system
 */

export type TooltipTier = 1 | 2 | 3; // 1 = essential, 2 = intermediate, 3 = advanced

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

export interface TooltipMetadata {
    id: string;
    tier: TooltipTier;
    order: number;
    messageKey: string;
    placement: TooltipPlacement;
    offset?: { x?: number; y?: number };
    requiredPermission?: string;
    requiredModule?: string;
    page?: string;
}

export interface TooltipSeenMetadata {
    tier: TooltipTier;
    order: number;
    seenAt: string;
    page?: string;
}

export interface TooltipPreferences {
    enabled: boolean;
    seenTooltips: string[];
}

export interface TooltipPreferencesResponse {
    enabled: boolean;
    seenTooltips: Array<{
        tooltipId: string;
        metadata: TooltipSeenMetadata;
    }>;
}

export interface MarkTooltipSeenRequest {
    tooltipId: string;
    tier: TooltipTier;
    order: number;
    page?: string;
}

export interface ToggleTooltipsEnabledRequest {
    enabled: boolean;
}

export interface GuidedTooltipContextValue {
    enabled: boolean;
    activeTooltip: TooltipMetadata | null;
    seenTooltips: Set<string>;
    sessionCount: number;
    hasHistory: boolean;
    registerTooltip: (metadata: TooltipMetadata) => void;
    unregisterTooltip: (id: string) => void;
    markSeen: (tooltipId: string) => Promise<void>;
    next: () => void;
    previous: () => void;
    close: () => void;
    closeAll: () => Promise<void>;
    reset: () => Promise<void>;
    isLoading: boolean;
}
