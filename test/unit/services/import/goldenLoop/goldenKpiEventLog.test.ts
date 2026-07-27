import { describe, expect, it } from "vitest";

import {
    formatGoldenEventKpiMatrix,
    formatHealthIndexPercent,
} from "@/server/services/import/goldenLoop/goldenKpiEventLog";
import type { GoldenEventKpiLogEntry } from "@/server/services/import/goldenLoop/types";

describe("goldenKpiEventLog", () => {
    it("formats health index as integer percent", () => {
        expect(formatHealthIndexPercent(0.85)).toBe("85%");
        expect(formatHealthIndexPercent(1)).toBe("100%");
    });

    it("formats event KPI matrix with actual vs expected columns", () => {
        const entry: GoldenEventKpiLogEntry = {
            eventIndex: 0,
            eventType: "invoice_open",
            date: "2026-01-14",
            invoiceNumber: "5584561",
            amount: 900,
            actual: {
                date: "2026-01-14",
                totalAr: 10_600,
                termBreach: 1000,
                capacity: 600,
                notInsured: 1600,
                healthIndex: 0.85,
            },
            expected: {
                date: "2026-01-14",
                totalAr: 10_600,
                termBreach: 1000,
                capacity: 600,
                notInsured: 1600,
                healthIndex: 0.85,
            },
        };

        const text = formatGoldenEventKpiMatrix(entry);
        expect(text).toContain("[GOLDEN_KPI] #1 invoice_open");
        expect(text).toContain("Total AR");
        expect(text).toContain("actual= 10600");
        expect(text).toContain("expected= 10600");
        expect(text).toContain("Health Index");
        expect(text).toContain("85%");
        expect(text).toContain("OK");
    });

    it("marks mismatched KPI values", () => {
        const entry: GoldenEventKpiLogEntry = {
            eventIndex: 1,
            eventType: "payment_apply",
            date: "2026-01-02",
            invoiceNumber: "5584561",
            amount: 150,
            actual: {
                date: "2026-01-02",
                totalAr: 700,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
            expected: {
                date: "2026-01-02",
                totalAr: 750,
                termBreach: 0,
                capacity: 0,
                notInsured: 0,
                healthIndex: 1,
            },
        };

        expect(formatGoldenEventKpiMatrix(entry)).toContain("MISMATCH");
    });
});
