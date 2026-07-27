import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
    prisma: {
        report: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/server/services/ReportExecutionService", () => ({
    ReportExecutionService: {
        getInstance: () => ({
            executeReport: vi.fn().mockResolvedValue({
                data: [
                    {
                        "Customer.name": "Acme",
                        "Invoice.amount": 100,
                        "formula:f1": 5,
                        "___formatted_formula:f1": "5",
                    },
                ],
                totalRecords: 1,
                executionTimeMs: 1,
            }),
        }),
    },
}));

vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: () => ({ logMessage: vi.fn() }),
    },
}));

describe("ReportExportService formula parity", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses formula labels and interleaved column order in CSV headers", async () => {
        const { prisma } = await import("@/lib/prisma");
        (prisma as any).report.findUnique.mockResolvedValue({
            id: 1,
            account_id: 10,
            name: "Monthly",
            report_config: {
                tables: ["Invoice", "Customer"],
                fields: [
                    { table: "Customer", field: "name" },
                    { table: "Invoice", field: "amount" },
                ],
                formulas: [
                    {
                        id: "f1",
                        label: "Premium",
                        expression: "[Invoice.amount]*5/100",
                        format: "number",
                    },
                ],
                columnOrder: [
                    "Customer.name",
                    "formula:f1",
                    "Invoice.amount",
                ],
            },
        });

        const { ReportExportService } = await import(
            "@/server/services/ReportExportService"
        );
        const service = ReportExportService.getInstance();
        const csv = (await service.exportReport(1, 10, "csv")) as string;

        const headerLine = csv.split("\n")[0];
        expect(headerLine).toBe("Name,Premium,Amount");
        expect(csv).toContain("Acme");
        expect(csv).toContain("5");
        // Interleaved order: field, formula, field
        expect(headerLine.indexOf("Name")).toBeLessThan(
            headerLine.indexOf("Premium")
        );
        expect(headerLine.indexOf("Premium")).toBeLessThan(
            headerLine.indexOf("Amount")
        );
    });
});
