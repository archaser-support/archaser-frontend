import { prisma } from "@/lib/prisma";
import {
    TooltipPreferencesResponse,
    TooltipSeenMetadata,
    MarkTooltipSeenRequest,
} from "@/types/guidedTooltips";

/**
 * Service for managing user preferences, specifically tooltip preferences
 */
export class UserPreferencesService {
    private static readonly TOOLTIP_PREFERENCE_PREFIX = "tooltip_seen_";

    /**
     * Get tooltip preferences for a user
     */
    static async getTooltipPreferences(
        userId: string
    ): Promise<TooltipPreferencesResponse> {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { guided_tooltips_enabled: true },
        });

        if (!user) {
            throw new Error("User not found");
        }

        const enabled = user.guided_tooltips_enabled ?? true;

        const preferences = await prisma.userPreferences.findMany({
            where: {
                userId,
                preferenceKey: {
                    startsWith: this.TOOLTIP_PREFERENCE_PREFIX,
                },
            },
        });

        const seenTooltips = preferences.map((pref) => {
            const tooltipId = pref.preferenceKey.replace(
                this.TOOLTIP_PREFERENCE_PREFIX,
                ""
            );
            // Safely cast JsonValue to TooltipSeenMetadata
            const rawMetadata = pref.preferenceValue;
            let metadata: TooltipSeenMetadata;
            if (
                rawMetadata &&
                typeof rawMetadata === "object" &&
                !Array.isArray(rawMetadata) &&
                "tier" in rawMetadata &&
                "order" in rawMetadata &&
                "seenAt" in rawMetadata
            ) {
                metadata = rawMetadata as unknown as TooltipSeenMetadata;
            } else {
                metadata = {
                    tier: 1,
                    order: 0,
                    seenAt: pref.created_at.toISOString(),
                };
            }

            return {
                tooltipId,
                metadata,
            };
        });

        return {
            enabled,
            seenTooltips,
        };
    }

    /**
     * Mark a tooltip as seen for a user
     */
    static async markTooltipSeen(
        userId: string,
        request: MarkTooltipSeenRequest
    ): Promise<void> {
        const preferenceKey = `${this.TOOLTIP_PREFERENCE_PREFIX}${request.tooltipId}`;
        const metadata: TooltipSeenMetadata = {
            tier: request.tier,
            order: request.order,
            seenAt: new Date().toISOString(),
            page: request.page,
        };

        await prisma.userPreferences.upsert({
            where: {
                userId_preferenceKey: {
                    userId,
                    preferenceKey,
                },
            },
            create: {
                userId,
                preferenceKey,
                preferenceValue: metadata as any,
            },
            update: {
                preferenceValue: metadata as any,
                modified_at: new Date(),
            },
        });
    }

    /**
     * Toggle guided tooltips enabled/disabled for a user
     */
    static async toggleTooltipsEnabled(
        userId: string,
        enabled: boolean
    ): Promise<void> {
        await prisma.user.update({
            where: { id: userId },
            data: { guided_tooltips_enabled: enabled },
        });
    }

    /**
     * Reset all tooltip preferences for a user (clear all seen tooltips)
     */
    static async resetTooltipPreferences(userId: string): Promise<void> {
        await prisma.userPreferences.deleteMany({
            where: {
                userId,
                preferenceKey: {
                    startsWith: this.TOOLTIP_PREFERENCE_PREFIX,
                },
            },
        });
    }
}
