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
            "fields.category_change":
                "Category changed from <b>{{oldCategory}}</b> to <b>{{newCategory}}</b> by {{userId}}",
            "fields.event": "Event",
            "fields.log_activity_comment": "Comment",
            "fields.activity_general_call":
                "{{userId}} - {{callType}} call with {{contact}} - {{outcome}}",
            "values.outcomes_open_dispute": "Open Dispute",
            "values.outcomes_general": "General call",
            "values.call_direction_outgoing": "outgoing",
        },
        customers: {
            "values.category_agent": "Agent",
            "values.category_promise_to_pay": "Promise to Pay",
        },
        users: {
            "values.portal_user": "Portal User",
            "values.unknown_user": "Unknown User",
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

    it("translates title_params values that are themselves namespaced keys", () => {
        expect(
            resolveI18nPlaceholders(
                "{{activities.fields.category_change}}",
                t,
                {
                    oldCategory: "customers.values.category_promise_to_pay",
                    newCategory: "customers.values.category_agent",
                    userId: "system",
                }
            )
        ).toBe(
            "Category changed from <b>Promise to Pay</b> to <b>Agent</b> by system"
        );
    });

    it("leaves param values that are not translation keys untouched", () => {
        expect(
            resolveI18nPlaceholders(
                "{{activities.fields.collection_period_closed_title}}",
                t,
                { userId: "Vera Cohen" }
            )
        ).toBe("Collection period closed by Vera Cohen");
    });

    it("leaves unknown placeholders unchanged", () => {
        expect(
            resolveI18nPlaceholders("{{activities.fields.missing_key}}", t)
        ).toBe("{{activities.fields.missing_key}}");
    });

    it("renders a call title with the direction resolved from its param key", () => {
        expect(
            resolveI18nPlaceholders(
                "{{activities.fields.activity_general_call}}",
                t,
                {
                    userId: "Vera Cohen",
                    callType: "activities.values.call_direction_outgoing",
                    contact: "Yosef Gonen",
                    outcome: "activities.values.outcomes_general",
                }
            )
        ).toBe("Vera Cohen - outgoing call with Yosef Gonen - General call");
    });

    it("drops a placeholder the stored params predate instead of showing the token", () => {
        // Call rows written before `callType` joined the template must not render
        // a literal "{{callType}}" — nor the double space it would leave behind.
        expect(
            resolveI18nPlaceholders(
                "{{activities.fields.activity_general_call}}",
                t,
                {
                    userId: "Vera Cohen",
                    contact: "Yosef Gonen",
                    outcome: "activities.values.outcomes_general",
                }
            )
        ).toBe("Vera Cohen - call with Yosef Gonen - General call");
    });

    it("renders the agent name embedded as a {{user:...}} content token", () => {
        const html =
            '<span class="activity-label-primary">Agent:</span> ' +
            '<span class="activity-value">{{user:Mirit Shem Tov}}</span>';
        expect(resolveI18nPlaceholders(html, t)).toBe(
            '<span class="activity-label-primary">Agent:</span> ' +
                '<span class="activity-value">Mirit Shem Tov</span>'
        );
    });

    it("translates non-user actors the API maps to keys", () => {
        expect(
            resolveI18nPlaceholders("{{user:users.values.portal_user}}", t)
        ).toBe("Portal User");
        expect(
            resolveI18nPlaceholders("{{user:users.values.unknown_user}}", t)
        ).toBe("Unknown User");
    });

    it("formats embedded date tokens with the supplied formatter", () => {
        const formatDate = vi.fn(
            (date: Date, kind: string) => `${kind}:${date.getFullYear()}`
        );
        expect(
            resolveI18nPlaceholders(
                "{{dateOnly:2026-03-24T00:00:00.000Z}}",
                t,
                undefined,
                { formatDate }
            )
        ).toBe("date:2026");
        expect(
            resolveI18nPlaceholders(
                "{{date:2026-03-24T07:00:00.000Z}}",
                t,
                undefined,
                { formatDate }
            )
        ).toBe("datetime:2026");
    });

    it("anchors date-only values to local midnight so the day never shifts", () => {
        // Stored as UTC midnight; reading it as an instant would roll the date
        // back a day for viewers behind UTC.
        const seen: Date[] = [];
        resolveI18nPlaceholders(
            "{{dateOnly:2026-03-24T00:00:00.000Z}}",
            t,
            undefined,
            {
                formatDate: (date) => {
                    seen.push(date);
                    return "";
                },
            }
        );
        expect(seen[0].getDate()).toBe(24);
        expect(seen[0].getMonth()).toBe(2);
    });

    it("falls back to the raw value for an unparseable date token", () => {
        expect(resolveI18nPlaceholders("{{date:not-a-date}}", t)).toBe(
            "not-a-date"
        );
    });
});
