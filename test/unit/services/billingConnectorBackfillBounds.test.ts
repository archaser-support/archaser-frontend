import { describe, expect, it } from "vitest";

import {
    DEFAULT_ACCOUNT_TIMEZONE,
    areBackfillOptionsLocked,
    buildBackfillEntityPullPhases,
    buildDatedBackfillPullFilter,
    calendarDateStartOfDayUtcIso,
    encodeBackfillCursor,
    extractInvoiceCustomerLinks,
    formatBackfillStartDateForApi,
    normalizeBackfillStartDateInput,
    parseBackfillCursor,
    resolveBackfillStartDateChange,
    resolveIncludeOlderOpenInvoicesChange,
    resolveSkipReportingBreachOnBackfillChange,
    shouldSkipReportingBreachOnConnectorWrite,
} from "@/server/services/billingConnectorBackfillBounds";

describe("calendarDateStartOfDayUtcIso", () => {
    it("converts account calendar day to inclusive UTC lower bound", () => {
        // Asia/Jerusalem is UTC+2 in January (standard time)
        expect(
            calendarDateStartOfDayUtcIso("2024-01-01", "Asia/Jerusalem")
        ).toBe("2023-12-31T22:00:00.000Z");
    });

    it("defaults to Asia/Jerusalem when timezone unset", () => {
        expect(calendarDateStartOfDayUtcIso("2024-01-01")).toBe(
            calendarDateStartOfDayUtcIso("2024-01-01", DEFAULT_ACCOUNT_TIMEZONE)
        );
    });
});

describe("normalizeBackfillStartDateInput", () => {
    it("accepts YYYY-MM-DD and blank/null as full history", () => {
        expect(normalizeBackfillStartDateInput("2024-06-15")).toEqual(
            new Date(Date.UTC(2024, 5, 15))
        );
        expect(normalizeBackfillStartDateInput("")).toBeNull();
        expect(normalizeBackfillStartDateInput(null)).toBeNull();
        expect(normalizeBackfillStartDateInput(undefined)).toBeUndefined();
    });

    it("rejects invalid calendar dates", () => {
        expect(() => normalizeBackfillStartDateInput("2024-13-01")).toThrow(
            /invalid|YYYY-MM-DD/i
        );
        expect(() => normalizeBackfillStartDateInput("not-a-date")).toThrow(
            /invalid|YYYY-MM-DD/i
        );
    });
});

describe("areBackfillOptionsLocked / resolveBackfillStartDateChange", () => {
    it("locks after backfill_started_at is set", () => {
        expect(areBackfillOptionsLocked(null)).toBe(false);
        expect(areBackfillOptionsLocked(new Date("2024-01-01T00:00:00Z"))).toBe(
            true
        );
    });

    it("rejects start-date changes while locked", () => {
        const lockedAt = new Date("2024-01-01T00:00:00Z");
        const existing = new Date(Date.UTC(2024, 0, 1));
        const result = resolveBackfillStartDateChange({
            backfillStartedAt: lockedAt,
            existingStartDate: existing,
            nextInput: "2024-02-01",
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });

    it("allows same start date while locked (idempotent PUT)", () => {
        const lockedAt = new Date("2024-01-01T00:00:00Z");
        const existing = new Date(Date.UTC(2024, 0, 1));
        const result = resolveBackfillStartDateChange({
            backfillStartedAt: lockedAt,
            existingStartDate: existing,
            nextInput: "2024-01-01",
        });
        expect(result).toEqual({ ok: true, value: existing });
    });

    it("allows start-date changes when unlocked", () => {
        const result = resolveBackfillStartDateChange({
            backfillStartedAt: null,
            existingStartDate: null,
            nextInput: "2024-03-15",
        });
        expect(result).toEqual({
            ok: true,
            value: new Date(Date.UTC(2024, 2, 15)),
        });
    });
});

describe("buildDatedBackfillPullFilter", () => {
    const start = new Date(Date.UTC(2024, 0, 1));

    it("filters invoices and payments on backfill when start date is set", () => {
        const invoiceFilter = buildDatedBackfillPullFilter({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            timeZone: "Asia/Jerusalem",
        });
        const paymentFilter = buildDatedBackfillPullFilter({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            timeZone: "Asia/Jerusalem",
        });
        expect(invoiceFilter).toBe(
            "IVDATE ge 2023-12-31T22:00:00.000Z"
        );
        expect(paymentFilter).toBe(
            "PAYDATE ge 2023-12-31T22:00:00.000Z"
        );
    });

    it("keeps customers/contacts full history even with start date", () => {
        expect(
            buildDatedBackfillPullFilter({
                entityType: "Customer",
                syncMode: "BACKFILL",
                backfillStartDate: start,
            })
        ).toBeNull();
        expect(
            buildDatedBackfillPullFilter({
                entityType: "Contact",
                syncMode: "BACKFILL",
                backfillStartDate: start,
            })
        ).toBeNull();
    });

    it("preserves full-history backfill when start date is blank", () => {
        expect(
            buildDatedBackfillPullFilter({
                entityType: "Invoice",
                syncMode: "BACKFILL",
                backfillStartDate: null,
            })
        ).toBeNull();
    });

    it("ignores start-date window on incremental sync (watermarks only)", () => {
        expect(
            buildDatedBackfillPullFilter({
                entityType: "Invoice",
                syncMode: "INCREMENTAL",
                backfillStartDate: start,
            })
        ).toBeNull();
        expect(
            buildDatedBackfillPullFilter({
                entityType: "Payment",
                syncMode: "INCREMENTAL",
                backfillStartDate: start,
            })
        ).toBeNull();
    });
});

describe("resolveIncludeOlderOpenInvoicesChange", () => {
    it("rejects include-older-open mutation while locked", () => {
        const result = resolveIncludeOlderOpenInvoicesChange({
            backfillStartedAt: new Date("2024-01-01T00:00:00Z"),
            existingValue: true,
            nextInput: false,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });

    it("allows same include-older-open value while locked", () => {
        const result = resolveIncludeOlderOpenInvoicesChange({
            backfillStartedAt: new Date("2024-01-01T00:00:00Z"),
            existingValue: true,
            nextInput: true,
        });
        expect(result).toEqual({ ok: true, value: true });
    });
});

describe("resolveSkipReportingBreachOnBackfillChange", () => {
    it("rejects skip-breach mutation while locked", () => {
        const result = resolveSkipReportingBreachOnBackfillChange({
            backfillStartedAt: new Date("2024-01-01T00:00:00Z"),
            existingValue: false,
            nextInput: true,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.code).toBe("BACKFILL_OPTIONS_LOCKED");
        }
    });

    it("allows same skip-breach value while locked", () => {
        const result = resolveSkipReportingBreachOnBackfillChange({
            backfillStartedAt: new Date("2024-01-01T00:00:00Z"),
            existingValue: true,
            nextInput: true,
        });
        expect(result).toEqual({ ok: true, value: true });
    });

    it("allows skip-breach changes when unlocked", () => {
        const result = resolveSkipReportingBreachOnBackfillChange({
            backfillStartedAt: null,
            existingValue: false,
            nextInput: true,
        });
        expect(result).toEqual({ ok: true, value: true });
    });
});

describe("shouldSkipReportingBreachOnConnectorWrite", () => {
    it("skips only on backfill when the switch is on", () => {
        expect(
            shouldSkipReportingBreachOnConnectorWrite({
                syncMode: "BACKFILL",
                skipReportingBreachOnBackfill: true,
            })
        ).toBe(true);
    });

    it("does not skip on incremental even when the switch is on", () => {
        expect(
            shouldSkipReportingBreachOnConnectorWrite({
                syncMode: "INCREMENTAL",
                skipReportingBreachOnBackfill: true,
            })
        ).toBe(false);
    });

    it("does not skip on backfill when the switch is off", () => {
        expect(
            shouldSkipReportingBreachOnConnectorWrite({
                syncMode: "BACKFILL",
                skipReportingBreachOnBackfill: false,
            })
        ).toBe(false);
    });
});

describe("buildBackfillEntityPullPhases", () => {
    const start = new Date(Date.UTC(2024, 0, 1));

    it("unions older-open then dated invoice filters when include-older-open is on", () => {
        const phases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "Asia/Jerusalem",
        });
        expect(phases.map((p) => p.id)).toEqual(["older_open", "dated"]);
        expect(phases[0].filter).toBe(
            "(IVBALANCE gt 0 or IVBALANCE lt 0) and IVDATE lt 2023-12-31T22:00:00.000Z"
        );
        expect(phases[1].filter).toBe("IVDATE ge 2023-12-31T22:00:00.000Z");
    });

    it("uses only on/after invoice filter when include-older-open is off", () => {
        const phases = buildBackfillEntityPullPhases({
            entityType: "Invoice",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: false,
            timeZone: "Asia/Jerusalem",
        });
        expect(phases).toEqual([
            { id: "dated", filter: "IVDATE ge 2023-12-31T22:00:00.000Z" },
        ]);
    });

    it("plans related then dated payment phases when include-older-open is on", () => {
        const phases = buildBackfillEntityPullPhases({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: true,
            timeZone: "Asia/Jerusalem",
        });
        expect(phases).toEqual([
            { id: "related", filter: "dynamic_related" },
            { id: "dated", filter: "PAYDATE ge 2023-12-31T22:00:00.000Z" },
        ]);
    });

    it("uses only on/after payment filter when include-older-open is off", () => {
        const phases = buildBackfillEntityPullPhases({
            entityType: "Payment",
            syncMode: "BACKFILL",
            backfillStartDate: start,
            includeOlderOpenInvoices: false,
            timeZone: "Asia/Jerusalem",
        });
        expect(phases).toEqual([
            { id: "dated", filter: "PAYDATE ge 2023-12-31T22:00:00.000Z" },
        ]);
    });

    it("keeps full history when start date is blank", () => {
        expect(
            buildBackfillEntityPullPhases({
                entityType: "Invoice",
                syncMode: "BACKFILL",
                backfillStartDate: null,
                includeOlderOpenInvoices: true,
            })
        ).toEqual([{ id: "full", filter: null }]);
    });
});

describe("backfill multi-phase cursor", () => {
    it("round-trips phase/skip/chunk and accepts legacy numeric skip", () => {
        const encoded = encodeBackfillCursor({
            phaseIndex: 1,
            skip: 40,
            chunk: 2,
        });
        expect(parseBackfillCursor(encoded, 2)).toEqual({
            phaseIndex: 1,
            skip: 40,
            chunk: 2,
        });
        expect(parseBackfillCursor("50", 1)).toEqual({
            phaseIndex: 0,
            skip: 50,
            chunk: 0,
        });
    });
});

describe("extractInvoiceCustomerLinks", () => {
    it("dedupes IVNUM+CUSTNAME pairs for related payment filters", () => {
        expect(
            extractInvoiceCustomerLinks([
                { IVNUM: "INV-1", CUSTNAME: "C1" },
                { IVNUM: "INV-1", CUSTNAME: "C1" },
                { IVNUM: "INV-2", CUSTNAME: "C2" },
                { IVNUM: "", CUSTNAME: "C3" },
            ])
        ).toEqual([
            { ivnum: "INV-1", custname: "C1" },
            { ivnum: "INV-2", custname: "C2" },
        ]);
    });
});
