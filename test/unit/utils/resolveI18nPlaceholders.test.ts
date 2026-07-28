import { describe, expect, it, vi } from "vitest";

import {
    resolveI18nPlaceholders,
    translateStoredI18nKey,
} from "@/shared/utils/resolveI18nPlaceholders";

describe("resolveI18nPlaceholders", () => {
    const catalog: Record<string, Record<string, string>> = {
        activities: {
            "fields.overdue_block_applied_title": "Overdue block applied",
            "fields.overdue_block_cleared_title": "Overdue block cleared",
            "fields.collection_period_closed_title":
                "Collection period closed by {{userId}}",
            "fields.event": "Event",
            "fields.log_activity_comment": "Comment",
            "values.outcomes_open_dispute": "Open Dispute",
        },
        users: {
            "values.portal_user": "Portal User",
        },
    };

    const t = vi.fn((key: string, options?: Record<string, unknown>) => {
        const ns = String(options?.ns || "activities");
        const template = catalog[ns]?.[key];
        if (!template) {
            return options?.defaultValue === "___NOT_FOUND___"
                ? "___NOT_FOUND___"
                : key;
        }
        return template.replace(/\{\{(\w+)\}\}/g, (_m, p: string) =>
            options?.[p] != null ? String(options[p]) : `{{${p}}}`
        );
    });

    it("translates a fully wrapped activity title key", () => {
        expect(
            translateStoredI18nKey(
                "{{activities.fields.overdue_block_applied_title}}",
                t
            )
        ).toBe("Overdue block applied");
    });

    it("interpolates title_params for collection period closed", () => {
        expect(
            resolveI18nPlaceholders(
                "{{activities.fields.collection_period_closed_title}}",
                t,
                { userId: "Vera" }
            )
        ).toBe("Collection period closed by Vera");
    });

    it("resolves multiple placeholders inside HTML content", () => {
        const html =
            '<span class="activity-label-primary">{{activities.fields.event}}:</span> ' +
            '<span class="activity-value">done</span>';
        expect(resolveI18nPlaceholders(html, t)).toBe(
            '<span class="activity-label-primary">Event:</span> ' +
                '<span class="activity-value">done</span>'
        );
    });

    it("maps legacy activity.log_activity.* keys to activities.fields.*", () => {
        expect(
            resolveI18nPlaceholders("{{activity.log_activity.comment}}", t)
        ).toBe("Comment");
    });

    it("translates outcome keys used in last-call results", () => {
        expect(
            translateStoredI18nKey(
                "{{activities.values.outcomes_open_dispute}}",
                t
            )
        ).toBe("Open Dispute");
    });

    it("leaves unknown placeholders unchanged", () => {
        expect(
            resolveI18nPlaceholders("{{activities.fields.missing_key}}", t)
        ).toBe("{{activities.fields.missing_key}}");
    });
});
