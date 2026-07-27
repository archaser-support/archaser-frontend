import { describe, it, expect, vi, beforeEach } from "vitest";

import { ImportService } from "@/server/services/ImportService";

describe("ImportService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("normalizeInvoiceInput", () => {
        it("should normalize string values correctly", () => {
            const rawInvoice = {
                account_id: "1",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                invoice_date: "2024-01-01T00:00:00.000Z",
                due_date: "2024-02-01T00:00:00.000Z",
                amount: "1000",
                customer_amount: "1200",
                customer_currency: "USD",
                total_paid: "300",
                credit_for_invoice_number: "CREDIT001",
            };

            const normalized = ImportService.normalizeInvoiceInput(
                rawInvoice,
                1
            );

            expect(normalized.account_id).toBe(1);
            expect(normalized.customer_number).toBe("CUSTOMER001");
            expect(normalized.invoice_number).toBe("INV001");
            expect(normalized.invoice_date).toBe("2024-01-01");
            expect(normalized.due_date).toBe("2024-02-01");
            expect(normalized.amount).toBe("1000");
            expect(normalized.customer_amount).toBe("1200");
            expect(normalized.customer_currency).toBe("USD");
            expect(normalized.total_paid).toBe("300");
            expect(normalized.credit_for_invoice_number).toBe("CREDIT001");
        });

        it("should handle Date objects for dates", () => {
            const rawInvoice = {
                account_id: 1,
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                invoice_date: new Date("2024-01-01"),
                due_date: new Date("2024-02-01"),
                amount: 1000,
            };

            const normalized = ImportService.normalizeInvoiceInput(
                rawInvoice,
                1
            );

            expect(normalized.invoice_date).toBe("2024-01-01");
            expect(normalized.due_date).toBe("2024-02-01");
        });

        it("should handle null and undefined values", () => {
            const rawInvoice = {
                account_id: 1,
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: null,
                amount: 1000,
                customer_amount: undefined,
                credit_for_invoice_number: null,
            };

            const normalized = ImportService.normalizeInvoiceInput(
                rawInvoice,
                1
            );

            expect(normalized.due_date).toBe(null);
            expect(normalized.customer_amount).toBe(undefined);
            expect(normalized.credit_for_invoice_number).toBe(undefined);
        });

        it("should handle empty credit_for_invoice_number", () => {
            const rawInvoice = {
                account_id: 1,
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                amount: 1000,
                credit_for_invoice_number: "",
            };

            const normalized = ImportService.normalizeInvoiceInput(
                rawInvoice,
                1
            );

            expect(normalized.credit_for_invoice_number).toBe(undefined);
        });

        it("should preserve existing values when already in correct format", () => {
            const rawInvoice = {
                account_id: 1,
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 1000,
                customer_amount: 1200,
            };

            const normalized = ImportService.normalizeInvoiceInput(
                rawInvoice,
                1
            );

            expect(normalized.invoice_date).toBe("2024-01-01");
            expect(normalized.due_date).toBe("2024-02-01");
            expect(normalized.amount).toBe(1000);
            expect(normalized.customer_amount).toBe(1200);
        });
    });

    describe("validateInvoiceData", () => {
        it("should validate correct invoice data", () => {
            const validInvoice = {
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 1000,
            };

            const validation = ImportService.validateInvoiceData(validInvoice);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it("should detect missing invoice number", () => {
            const invalidInvoice = {
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 1000,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Invoice number is required");
        });

        it("should detect missing invoice date", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                due_date: "2024-02-01",
                amount: 1000,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Invoice date is required");
        });

        it("should detect missing due date", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                amount: 1000,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Due date is required");
        });

        it("should detect missing amount", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain(
                "Amount is required and cannot be empty"
            );
        });

        it("should detect invalid amount format", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: "not-a-number",
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain(
                "Amount must be a valid number"
            );
        });

        it("should allow negative amounts for credit invoices", () => {
            const creditInvoice = {
                invoice_number: "CREDIT001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: -500,
            };

            const validation = ImportService.validateInvoiceData(creditInvoice);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it("should allow zero amounts", () => {
            const zeroInvoice = {
                invoice_number: "ZERO001",
                invoice_date: "2024-01-01",
                due_date: "2024-02-01",
                amount: 0,
            };

            const validation = ImportService.validateInvoiceData(zeroInvoice);

            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });

        it("should detect invalid invoice date format", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                invoice_date: "invalid-date",
                due_date: "2024-02-01",
                amount: 1000,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Invalid invoice date format");
        });

        it("should detect invalid due date format", () => {
            const invalidInvoice = {
                invoice_number: "INV001",
                invoice_date: "2024-01-01",
                due_date: "invalid-date",
                amount: 1000,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Invalid due date format");
        });

        it("should handle multiple validation errors", () => {
            const invalidInvoice = {
                invoice_number: "",
                invoice_date: "invalid-date",
                due_date: "invalid-date",
                amount: "not-a-number",
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(1);
            expect(validation.errors).toContain("Invoice number is required");
            expect(validation.errors).toContain("Invalid invoice date format");
            expect(validation.errors).toContain("Invalid due date format");
            expect(validation.errors).toContain(
                "Amount must be a valid number"
            );
        });

        it("should handle null and undefined values in validation", () => {
            const invalidInvoice = {
                invoice_number: null,
                invoice_date: undefined,
                due_date: null,
                amount: null,
            };

            const validation =
                ImportService.validateInvoiceData(invalidInvoice);

            expect(validation.isValid).toBe(false);
            expect(validation.errors).toContain("Invoice number is required");
            expect(validation.errors).toContain("Invoice date is required");
            expect(validation.errors).toContain("Due date is required");
            expect(validation.errors).toContain(
                "Amount is required and cannot be empty"
            );
        });
    });

    describe("excelSerialDateToISODate", () => {
        it("should convert Excel serial date to ISO date", () => {
            // Excel serial date for 2024-01-01 is 45292
            const excelDate = 45292;
            const isoDate = ImportService.excelSerialDateToISODate(excelDate);

            expect(isoDate).toBe("2024-01-01");
        });

        it("should handle different Excel dates", () => {
            // Excel serial date for 2023-12-31 is 45291
            const excelDate = 45291;
            const isoDate = ImportService.excelSerialDateToISODate(excelDate);

            expect(isoDate).toBe("2023-12-31");
        });

        it("should handle Excel date for 1900-01-01", () => {
            // Excel serial date for 1900-01-01 is 1
            const excelDate = 1;
            const isoDate = ImportService.excelSerialDateToISODate(excelDate);

            expect(isoDate).toBe("1899-12-31");
        });
    });

    describe("normalizePaymentInput", () => {
        it("should normalize payment input correctly", () => {
            const rawPayment = {
                account_id: "1",
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: "2024-01-01",
                amount: "500",
                customer_amount: "600",
                payment_method: "BANK_TRANSFER",
                customer_currency: "USD",
                reference: "REF001",
            };

            const normalized = ImportService.normalizePaymentInput(rawPayment);

            expect(normalized.account_id).toBe(1);
            expect(normalized.company_code).toBe("COMP001");
            expect(normalized.customer_number).toBe("CUSTOMER001");
            expect(normalized.invoice_number).toBe("INV001");
            expect(normalized.payment_date).toBe("2024-01-01");
            expect(normalized.amount).toBe(500);
            expect(normalized.customer_amount).toBe(600);
            expect(normalized.payment_method).toBe("BANK_TRANSFER");
            expect(normalized.customer_currency).toBe("USD");
            expect(normalized.reference).toBe("REF001");
        });

        it("should handle Excel serial dates for payment_date", () => {
            const rawPayment = {
                account_id: 1,
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: 45292, // Excel serial date for 2024-01-01
                amount: 500,
                customer_amount: 600,
                customer_currency: "USD",
            };

            const normalized = ImportService.normalizePaymentInput(rawPayment);

            expect(normalized.payment_date).toBe("2024-01-01");
        });

        it("should handle Date objects for payment_date", () => {
            const rawPayment = {
                account_id: 1,
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: new Date("2024-01-01"),
                amount: 500,
                customer_amount: 600,
                customer_currency: "USD",
            };

            const normalized = ImportService.normalizePaymentInput(rawPayment);

            expect(normalized.payment_date).toBe("2024-01-01");
        });

        it("should handle optional fields", () => {
            const rawPayment = {
                account_id: 1,
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: "2024-01-01",
                amount: 500,
                customer_amount: 600,
                customer_currency: "USD",
                // payment_method and reference are optional
            };

            const normalized = ImportService.normalizePaymentInput(rawPayment);

            expect(normalized.payment_method).toBe("");
            expect(normalized.reference).toBe("");
        });

        it("should treat missing or blank base amount as undefined", () => {
            const withoutAmount = ImportService.normalizePaymentInput({
                account_id: 1,
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: "2024-01-01",
                customer_amount: 600,
                customer_currency: "USD",
            });

            expect(withoutAmount.amount).toBeUndefined();

            const blankAmount = ImportService.normalizePaymentInput({
                account_id: 1,
                company_code: "COMP001",
                customer_number: "CUSTOMER001",
                invoice_number: "INV001",
                payment_date: "2024-01-01",
                amount: "",
                customer_amount: 600,
                customer_currency: "USD",
            });

            expect(blankAmount.amount).toBeUndefined();
        });
    });

    describe("normalizeCustomerInput", () => {
        it("should normalize customer input correctly", () => {
            const rawCustomer = {
                name: "Test Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "US",
                state_iso2: "CA",
                city: "San Francisco",
                address_line1: "123 Main St",
                address_line2: "Suite 100",
                postal_code: "94105",
                owner_email: "test@example.com",
            };

            const normalized = ImportService.normalizeCustomerInput(rawCustomer);

            expect(normalized.name).toBe("Test Customer");
            expect(normalized.customer_number).toBe("CUSTOMER001");
            expect(normalized.company_code).toBe("COMP001");
            expect(normalized.country_iso2).toBe("US");
            expect(normalized.state_iso2).toBe("CA");
            expect(normalized.city).toBe("San Francisco");
            expect(normalized.address_line1).toBe("123 Main St");
            expect(normalized.address_line2).toBe("Suite 100");
            expect(normalized.postal_code).toBe("94105");
            expect(normalized.owner_email).toBe("test@example.com");
        });

        it("should convert UK to GB for country code", () => {
            const rawCustomer = {
                name: "UK Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "UK",
            };

            const normalized = ImportService.normalizeCustomerInput(rawCustomer);

            expect(normalized.country_iso2).toBe("GB");
        });

        it("should convert uk to GB for country code (case insensitive)", () => {
            const rawCustomer = {
                name: "UK Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "uk",
            };

            const normalized = ImportService.normalizeCustomerInput(rawCustomer);

            expect(normalized.country_iso2).toBe("GB");
        });

        it("should handle optional fields", () => {
            const rawCustomer = {
                name: "Test Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "US",
                // Optional fields are undefined
            };

            const normalized = ImportService.normalizeCustomerInput(rawCustomer);

            expect(normalized.state_iso2).toBeUndefined();
            expect(normalized.city).toBeUndefined();
            expect(normalized.address_line1).toBeUndefined();
            expect(normalized.address_line2).toBeUndefined();
            expect(normalized.postal_code).toBeUndefined();
            expect(normalized.owner_email).toBeUndefined();
        });

        it("should ignore legacy credit insurance columns not supported on customer import", () => {
            const rawCustomer = {
                name: "Test Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "US",
                policy_number: " POL-1 ",
                approved_limit: "1000.50",
                limit_type: "dcl",
                max_payment_term: 45,
                max_allowed_mep: 90,
                reporting_days: 14,
                excluded_from_policy: "yes",
                policy_exclusion_reason: " Risk ",
            };

            const normalized = ImportService.normalizeCustomerInput(rawCustomer);

            expect(normalized).not.toHaveProperty("policy_number");
            expect(normalized).not.toHaveProperty("approved_limit");
            expect(normalized).not.toHaveProperty("limit_type");
            expect(normalized).not.toHaveProperty("max_payment_term");
            expect(normalized).not.toHaveProperty("max_allowed_mep");
            expect(normalized).not.toHaveProperty("reporting_days");
            expect(normalized).not.toHaveProperty("excluded_from_policy");
            expect(normalized).not.toHaveProperty("policy_exclusion_reason");
        });

        it("should normalize crn when present, null when empty, omit when undefined", () => {
            const base = {
                name: "Test Customer",
                customer_number: "CUSTOMER001",
                company_code: "COMP001",
                country_iso2: "US",
            };
            expect(
                ImportService.normalizeCustomerInput({
                    ...base,
                    crn: "  514123456  ",
                }).crn
            ).toBe("514123456");
            expect(
                ImportService.normalizeCustomerInput({
                    ...base,
                    crn: "",
                }).crn
            ).toBeNull();
            expect(
                ImportService.normalizeCustomerInput({
                    ...base,
                    crn: null,
                }).crn
            ).toBeNull();
            expect(
                ImportService.normalizeCustomerInput({ ...base }).crn
            ).toBeUndefined();
        });
    });

    describe("parseImportBoolean", () => {
        it("parses common truthy and falsy values", () => {
            expect(ImportService.parseImportBoolean(true)).toBe(true);
            expect(ImportService.parseImportBoolean(false)).toBe(false);
            expect(ImportService.parseImportBoolean(1)).toBe(true);
            expect(ImportService.parseImportBoolean(0)).toBe(false);
            expect(ImportService.parseImportBoolean("YES")).toBe(true);
            expect(ImportService.parseImportBoolean("no")).toBe(false);
        });
    });

    describe("normalizeContactInput", () => {
        it("should normalize contact input correctly", () => {
            const rawContact = {
                first_name: "John",
                last_name: "Doe",
                customer_number: "CUST001",
                email: "john.doe@example.com",
                phone: "+1234567890",
                mobile: "+0987654321",
                role: "Manager",
                company_wide_address: true,
                receives_standard_reminder: true,
                receives_escalated_reminder: false,
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.first_name).toBe("John");
            expect(normalized.last_name).toBe("Doe");
            expect(normalized.customer_number).toBe("CUST001");
            expect(normalized.email).toBe("john.doe@example.com");
            expect(normalized.phone).toBe("+1234567890");
            expect(normalized.mobile).toBe("+0987654321");
            expect(normalized.role).toBe("Manager");
            expect(normalized.company_wide_address).toBe(true);
            expect(normalized.receives_standard_reminder).toBe(true);
            expect(normalized.receives_escalated_reminder).toBe(false);
        });

        it("should handle boolean string conversion", () => {
            const rawContact = {
                first_name: "John",
                customer_number: "CUST001",
                company_wide_address: false,
                receives_standard_reminder: true,
                receives_escalated_reminder: false,
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.company_wide_address).toBe(false);
            expect(normalized.receives_standard_reminder).toBe(true);
            expect(normalized.receives_escalated_reminder).toBe(false);
        });

        it("should handle actual boolean values", () => {
            const rawContact = {
                first_name: "John",
                customer_number: "CUST001",
                company_wide_address: false,
                receives_standard_reminder: true,
                receives_escalated_reminder: false,
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.company_wide_address).toBe(false);
            expect(normalized.receives_standard_reminder).toBe(true);
            expect(normalized.receives_escalated_reminder).toBe(false);
        });

        it("should handle optional fields", () => {
            const rawContact = {
                first_name: "John",
                customer_number: "CUST001",
                // Optional fields are undefined
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.last_name).toBeUndefined();
            expect(normalized.email).toBeUndefined();
            expect(normalized.phone).toBeUndefined();
            expect(normalized.mobile).toBeUndefined();
            expect(normalized.role).toBeUndefined();
            expect(normalized.company_wide_address).toBe(false);
            expect(normalized.receives_standard_reminder).toBe(false);
            expect(normalized.receives_escalated_reminder).toBe(false);
        });

        it("should parse string boolean values correctly", () => {
            const rawContact = {
                first_name: "John",
                customer_number: "CUST001",
                company_wide_address: "TRUE",
                receives_standard_reminder: "true",
                receives_escalated_reminder: "1",
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.company_wide_address).toBe(true);
            expect(normalized.receives_standard_reminder).toBe(true);
            expect(normalized.receives_escalated_reminder).toBe(true);
        });

        it("should parse various string formats as true", () => {
            const testCases = [
                { value: "TRUE", expected: true },
                { value: "true", expected: true },
                { value: "1", expected: true },
                { value: "YES", expected: true },
                { value: "yes", expected: true },
                { value: "Y", expected: true },
                { value: "y", expected: true },
                { value: "ON", expected: true },
                { value: "on", expected: true },
            ];

            testCases.forEach(({ value, expected }) => {
                const rawContact = {
                    first_name: "John",
                    customer_number: "CUST001",
                    company_wide_address: value,
                    receives_standard_reminder: value,
                    receives_escalated_reminder: value,
                };

                const normalized = ImportService.normalizeContactInput(rawContact);

                expect(normalized.company_wide_address).toBe(expected);
                expect(normalized.receives_standard_reminder).toBe(expected);
                expect(normalized.receives_escalated_reminder).toBe(expected);
            });
        });

        it("should parse various string formats as false", () => {
            const testCases = [
                { value: "FALSE", expected: false },
                { value: "false", expected: false },
                { value: "0", expected: false },
                { value: "NO", expected: false },
                { value: "no", expected: false },
                { value: "N", expected: false },
                { value: "n", expected: false },
                { value: "OFF", expected: false },
                { value: "off", expected: false },
                { value: "", expected: false },
                { value: "invalid", expected: false },
            ];

            testCases.forEach(({ value, expected }) => {
                const rawContact = {
                    first_name: "John",
                    customer_number: "CUST001",
                    company_wide_address: value,
                    receives_standard_reminder: value,
                    receives_escalated_reminder: value,
                };

                const normalized = ImportService.normalizeContactInput(rawContact);

                expect(normalized.company_wide_address).toBe(expected);
                expect(normalized.receives_standard_reminder).toBe(expected);
                expect(normalized.receives_escalated_reminder).toBe(expected);
            });
        });

        it("should handle number boolean values", () => {
            const rawContact = {
                first_name: "John",
                customer_number: "CUST001",
                company_wide_address: 1,
                receives_standard_reminder: 0,
                receives_escalated_reminder: 1,
            };

            const normalized = ImportService.normalizeContactInput(rawContact);

            expect(normalized.company_wide_address).toBe(true);
            expect(normalized.receives_standard_reminder).toBe(false);
            expect(normalized.receives_escalated_reminder).toBe(true);
        });
    });
});
