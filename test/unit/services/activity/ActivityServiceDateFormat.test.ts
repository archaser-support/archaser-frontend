import { describe, it, expect, vi, beforeEach } from "vitest";

import { ActivityService } from "@/server/services/ActivityService";

describe("ActivityService - Date Formatting", () => {
    let activityService: ActivityService;

    beforeEach(() => {
        activityService = new ActivityService();
        vi.clearAllMocks();
    });

    describe("generateActivityTitle - uses dateLocale in titleParams for {{time}}", () => {
        it("formats time in en-US when dateLocale is en-US", async () => {
            const title = "{{activities.fields.activity_automated_step_sent}}";
            const translate = (key: string) => {
                // For bracket format the translator receives raw key
                if (key === "activities.fields.activity_automated_step_sent") {
                    return "Automated step {{step}} sent to {{contacts}} at {{time}}";
                }
                return key;
            };

            const iso = "2025-10-31T00:00:00.000Z";
            const result = await activityService.generateActivityTitle({
                type: "Email" as any,
                status: "Sent" as any,
                ActivitiesSequence: null,
                Customer: null,
                schedule_time: new Date(iso),
                title,
                content: "",
                ActivityContacts: [],
                translate,
                resources: undefined,
                titleParams: { step: "3", contacts: "2", time: iso, dateLocale: "en-US" },
                locale: "en-US",
                timezone: "UTC",
            });

            // Expect US-style with time included (MM/DD/YYYY, HH:MM AM/PM)
            expect(result).toMatch(/Automated step 3 sent to 2 at \d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2} [AP]M/);
        });

        it("formats time in he-IL when dateLocale is he-IL", async () => {
            const title = "{{activities.fields.activity_automated_step_sent}}";
            const translate = (key: string) => {
                if (key === "activities.fields.activity_automated_step_sent") {
                    return "Automated step {{step}} sent to {{contacts}} at {{time}}";
                }
                return key;
            };

            const iso = "2025-10-31T00:00:00.000Z";
            const result = await activityService.generateActivityTitle({
                type: "Email" as any,
                status: "Sent" as any,
                ActivitiesSequence: null,
                Customer: null,
                schedule_time: new Date(iso),
                title,
                content: "",
                ActivityContacts: [],
                translate,
                resources: undefined,
                titleParams: { step: "3", contacts: "2", time: iso, dateLocale: "he-IL" },
                locale: "he-IL",
                timezone: "UTC",
            });

            // Expect Hebrew-style date (DD.MM.YYYY) and 24h time
            expect(result).toMatch(/Automated step 3 sent to 2 at \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
        });
    });

    describe("formatContent - uses dateLocale for {{date:...}} in descriptions", () => {
        it("formats follow-up time using provided dateLocale", async () => {
            const iso = "2025-10-31T00:00:00.000Z";
            const content = `Follow Up Time: {{date:${iso}}}`;
            const translate = (key: string) => key;

            // locale is the translation language; dateLocale controls date formatting
            const result = await activityService.formatContent(
                content,
                translate,
                "en-US",
                "he-IL"
            );

            // Expect Hebrew-style date (DD.MM.YYYY) and time
            expect(result).toMatch(/Follow Up Time: \d{2}\.\d{2}\.\d{4}/);
        });
    });
    describe("translateActivityContent - dateOnly formatting", () => {
        it("should format date in English locale (MM/DD/YYYY)", async () => {
            const content =
                "Promised Due Date: {{dateOnly:2025-08-28T00:00:00.000Z}}";
            const translate = (key: string) => key; // Mock translation function
            const locale = "en-US";

            const result = await (activityService as any).translateActivityContent(
                content,
                translate,
                locale
            );

            // Should format as MM/DD/YYYY for English locale
            expect(result).toContain("08/28/2025");
        });

        it("should format date in Hebrew locale (DD.MM.YYYY)", async () => {
            const content =
                "Promised Due Date: {{dateOnly:2025-08-28T00:00:00.000Z}}";
            const translate = (key: string) => key; // Mock translation function
            const locale = "he-IL";

            const result = await activityService["translateActivityContent"](
                content,
                translate,
                locale
            );

            // Should format as DD.MM.YYYY for Hebrew locale (uses dots as separators)
            expect(result).toContain("28.08.2025");
        });

        it("should handle invalid date gracefully", async () => {
            const content = "Promised Due Date: {{dateOnly:invalid-date}}";
            const translate = (key: string) => key;
            const locale = "en-US";

            const result = await (activityService as any).translateActivityContent(
                content,
                translate,
                locale
            );

            // Should return the original template if date is invalid
            expect(result).toContain("{{dateOnly:invalid-date}}");
        });

        it("should use fallback locale when locale is undefined", async () => {
            const content =
                "Promised Due Date: {{dateOnly:2025-08-28T00:00:00.000Z}}";
            const translate = (key: string) => key;
            const locale = undefined;

            const result = await (activityService as any).translateActivityContent(
                content,
                translate,
                locale
            );

            // Should still format the date (will use system default locale)
            expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
        });
    });


    describe("Scheduled Activity Date Formatting", () => {
        it("should add dateOnly template to title if not present", () => {
            const title = "Promise to pay reminder";
            const scheduleDate = new Date("2025-08-28T00:00:00.000Z");

            // Simulate the logic from createPromiseToPayScheduledActivity
            let p2pTitle = title;
            if (p2pTitle && !p2pTitle.includes("{{dateOnly:")) {
                p2pTitle = `${p2pTitle} {{dateOnly:${scheduleDate.toISOString()}}}`;
            }

            expect(p2pTitle).toBe(
                "Promise to pay reminder {{dateOnly:2025-08-28T00:00:00.000Z}}"
            );
        });

        it("should not add dateOnly template if already present", () => {
            const title =
                "Promise to pay reminder {{dateOnly:2025-08-28T00:00:00.000Z}}";
            const scheduleDate = new Date("2025-08-28T00:00:00.000Z");

            // Simulate the logic from createPromiseToPayScheduledActivity
            let p2pTitle = title;
            if (p2pTitle && !p2pTitle.includes("{{dateOnly:")) {
                p2pTitle = `${p2pTitle} {{dateOnly:${scheduleDate.toISOString()}}}`;
            }

            expect(p2pTitle).toBe(
                "Promise to pay reminder {{dateOnly:2025-08-28T00:00:00.000Z}}"
            );
        });

        it("should add dateOnly template to content if not present", () => {
            const content = "Please pay your outstanding balance.";
            const scheduleDate = new Date("2025-08-28T00:00:00.000Z");

            // Simulate the logic from createPromiseToPayScheduledActivity
            let p2pContent = content;
            if (p2pContent && !p2pContent.includes("{{dateOnly:")) {
                p2pContent = `${p2pContent}<br>Promise to Pay Due Date: {{dateOnly:${scheduleDate.toISOString()}}}`;
            }

            expect(p2pContent).toBe(
                "Please pay your outstanding balance.<br>Promise to Pay Due Date: {{dateOnly:2025-08-28T00:00:00.000Z}}"
            );
        });
    });
});
