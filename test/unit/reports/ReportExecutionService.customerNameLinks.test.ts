import { describe, expect, it } from "vitest";

import { ReportExecutionService } from "@/server/services/ReportExecutionService";

describe("ReportExecutionService.getFieldLinkMetadata customer name", () => {
    const service = new ReportExecutionService() as any;

    it("links Customer.name when Customer is the primary table", () => {
        const link = service.getFieldLinkMetadata(
            { table: "Customer", field: "name" },
            { id: 15, name: "Acme" },
            "Customer",
            "name"
        );
        expect(link).toEqual({ type: "customer", id: 15 });
    });

    it("links Customer.name on Invoice rows via customer_id", () => {
        const link = service.getFieldLinkMetadata(
            { table: "Customer", field: "name" },
            {
                id: 100,
                customer_id: 15,
                invoice_number: "25322122",
                Customer: { id: 15, Company: { name: "Acme" } },
            },
            "Invoice",
            "Customer.name"
        );
        expect(link).toEqual({ type: "customer", id: 15 });
    });

    it("links Customer.name on Invoice rows via Customer.id when FK missing", () => {
        const link = service.getFieldLinkMetadata(
            { table: "Customer", field: "name" },
            {
                id: 100,
                invoice_number: "25322122",
                Customer: { id: 22, Company: { name: "Beta" } },
            },
            "Invoice",
            "Customer.name"
        );
        expect(link).toEqual({ type: "customer", id: 22 });
    });

    it("does not link invoice_number", () => {
        const link = service.getFieldLinkMetadata(
            { table: "Invoice", field: "invoice_number" },
            { id: 42, invoice_number: "INV-42", customer_id: 15 },
            "Invoice",
            "invoice_number"
        );
        expect(link).toBeNull();
    });
});
