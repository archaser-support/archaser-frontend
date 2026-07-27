import { describe, expect, it } from "vitest";

import {
    buildEntityCollectionUrl,
    buildIncrementalQueryParams,
    isPriorityEntityImportType,
    PRIORITY_CREDIT_NOTE_HANDLING,
    PRIORITY_ENTITY_ENDPOINTS,
    PRIORITY_GATE_OUTCOMES,
    PRIORITY_OVERLAP_WINDOW_TEST,
    priorityApiContract,
} from "@/server/integrations/priority/priorityApiContract";
import {
    CONTACT_SAMPLES,
    CUSTOMER_SAMPLES,
    INVOICE_SAMPLES,
    PAYMENT_SAMPLES,
} from "@/server/integrations/priority/fixtures/samplePayloads";

describe("priorityApiContract", () => {
    it("documents all four MVP entities with PK → Archaser field mapping", () => {
        expect(PRIORITY_ENTITY_ENDPOINTS.Customer.archaserIdField).toBe(
            "customer_number"
        );
        expect(PRIORITY_ENTITY_ENDPOINTS.Contact.archaserIdField).toBe(
            "erp_contact_id"
        );
        expect(PRIORITY_ENTITY_ENDPOINTS.Invoice.archaserIdField).toBe(
            "invoice_number"
        );
        expect(PRIORITY_ENTITY_ENDPOINTS.Payment.archaserIdField).toBe(
            "reference"
        );
    });

    it("exposes 2–3 sample payloads per entity", () => {
        expect(CUSTOMER_SAMPLES.length).toBeGreaterThanOrEqual(2);
        expect(CONTACT_SAMPLES.length).toBeGreaterThanOrEqual(2);
        expect(INVOICE_SAMPLES.length).toBeGreaterThanOrEqual(2);
        expect(PAYMENT_SAMPLES.length).toBeGreaterThanOrEqual(2);
    });

    it("documents credit notes as negative CINVOICES (D4)", () => {
        expect(PRIORITY_CREDIT_NOTE_HANDLING.strategy).toBe("negative_invoice");
        expect(PRIORITY_CREDIT_NOTE_HANDLING.separateCreditNoteEntity).toBe(
            false
        );

        const creditNote = INVOICE_SAMPLES.find(
            (row) => row.DEBIT === "C" && row.TOTPRICE < 0
        );
        expect(creditNote).toBeDefined();
        expect(creditNote?.CREDITFOR).toBe("INV-2025-0001");
    });

    it("documents Phase 0 gate outcomes", () => {
        const gateIds = PRIORITY_GATE_OUTCOMES.map((g) => g.gate);
        expect(gateIds).toContain("deleted_records");
        expect(gateIds).toContain("token_refresh");
        expect(gateIds).toContain("sandbox_availability");
    });

    it("documents overlap window test procedure", () => {
        expect(PRIORITY_OVERLAP_WINDOW_TEST.overlapMinutes).toBe(5);
        expect(PRIORITY_OVERLAP_WINDOW_TEST.steps.length).toBeGreaterThanOrEqual(
            4
        );
    });

    it("builds entity collection URLs from service root", () => {
        const url = buildEntityCollectionUrl(
            "https://example.com/odata/Priority/tab.ini/env",
            "Customer"
        );
        expect(url).toBe(
            "https://example.com/odata/Priority/tab.ini/env/CUSTOMERS"
        );
    });

    it("builds incremental query with overlap subtracted from watermark", () => {
        const params = buildIncrementalQueryParams({
            watermarkIso: "2025-06-10T10:00:00.000Z",
            overlapMinutes: 5,
            preferSince: true,
            top: 100,
        });

        expect(params.$since).toBe("2025-06-10T09:55:00.000Z");
        expect(params.$top).toBe("100");
    });

    it("exports a complete contract object", () => {
        expect(priorityApiContract.provider).toBe("PRIORITY");
        expect(priorityApiContract.auth.credentialsShape.API_KEY).toContain(
            "token"
        );
        expect(
            priorityApiContract.samplePayloads.Invoice.some(
                (row) => row.DEBIT === "C"
            )
        ).toBe(true);
    });

    it("narrows ImportType to Priority MVP entities", () => {
        expect(isPriorityEntityImportType("Customer")).toBe(true);
        expect(isPriorityEntityImportType("Invoice")).toBe(true);
    });
});
