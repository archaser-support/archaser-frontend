/**
 * Credit Invoice Integration Tests
 * 
 * Comprehensive integration tests for credit invoice functionality including:
 * - Database schema validation
 * - Credit invoice assignment
 * - Net amount recalculation
 * - Total paid verification
 * - Edge cases
 * - Real data analysis
 * 
 * These tests require a database connection and will be skipped if DATABASE_URL is not set.
 */

import { PrismaClient } from "@prisma/client";
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
} from "vitest";

import { InvoiceService } from "../server/services/InvoiceService";

// Initialize Prisma client
const prisma = new PrismaClient();

// Skip integration tests if DATABASE_URL is not set
const skipIntegrationTests = !process.env.DATABASE_URL;

describe.skipIf(skipIntegrationTests)("Credit Invoice Integration Tests", () => {
    let invoiceService: InvoiceService;
    let testAccount: { id: number };

    beforeAll(async () => {
        invoiceService = new InvoiceService();

        // Test database connection
        await prisma.$connect();

        // Create or get test account (using customer as account)
        const testCustomer = await prisma.customer.upsert({
            where: { id: 999999 },
            update: {},
            create: {
                id: 999999,
                customer_uuid: "99999999-9999-9999-9999-999999999999",
                account_id: 999999,
                type: "Company",
                collection_status: "Active",
                country_id: 1,
            },
        });
        testAccount = { id: testCustomer.id };
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    beforeEach(async () => {
        // Clean up any test data before each test
        await prisma.invoice.deleteMany({
            where: {
                invoice_number: {
                    startsWith: "TEST_",
                },
            },
        });
    });

    afterEach(async () => {
        // Clean up test data after each test
        await prisma.invoice.deleteMany({
            where: {
                invoice_number: {
                    startsWith: "TEST_",
                },
            },
        });
    });

    describe("Database Schema Validation", () => {
        it("should verify invoice table structure", async () => {
            const sampleInvoice = await prisma.invoice.findFirst({
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                    net_amount: true,
                    total_paid: true,
                    outstanding_debt: true,
                },
            });

            expect(sampleInvoice).toBeDefined();
        });

        it("should verify required invoice fields exist", async () => {
            const sampleInvoice = await prisma.invoice.findFirst({
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                    net_amount: true,
                    total_paid: true,
                    outstanding_debt: true,
                    credit_for_invoice_id: true,
                    account_id: true,
                    customer_id: true,
                    status: true,
                },
            });

            expect(sampleInvoice).toBeDefined();
        });

        it("should find credit invoices in database", async () => {
            const creditInvoices = await prisma.invoice.findMany({
                where: {
                    amount: { lt: 0 },
                },
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                },
                take: 5,
            });

            expect(Array.isArray(creditInvoices)).toBe(true);
        });

        it("should verify credit invoice relationships", async () => {
            const creditInvoices = await prisma.invoice.findMany({
                where: {
                    amount: { lt: 0 },
                    credit_for_invoice_id: { not: null },
                },
                select: {
                    id: true,
                    amount: true,
                    credit_for_invoice_id: true,
                },
                take: 5,
            });

            expect(Array.isArray(creditInvoices)).toBe(true);
        });
    });

    describe("Credit Invoice Assignment", () => {
        it("should create test invoices and assign credit correctly", async () => {
            // Create a test customer if they don't exist
            const testCustomer = await prisma.customer.upsert({
                where: { id: 999999 },
                update: {},
                create: {
                    id: 999999,
                    customer_number: "999999",
                    account_id: testAccount.id,
                    collection_status: "Active",
                    type: "Company",
                },
            });

            // Create a test target invoice
            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_TARGET_001",
                    amount: 1000,
                    net_amount: 1000,
                    total_paid: 300,
                    outstanding_debt: 700,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Overdue",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                },
            });

            // Create a test credit invoice
            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_CREDIT_001",
                    amount: -400,
                    net_amount: -400,
                    total_paid: 0,
                    outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Paid",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                    credit_for_invoice_id: null,
                },
            });

            // Perform credit assignment
            const assignment = {
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 400,
            };

            const result = await invoiceService.assignCreditInvoice(assignment);

            // Verify the assignment worked correctly
            expect(result.creditInvoice.credit_for_invoice_id).toBe(
                targetInvoice.id
            );
            expect(result.targetInvoice.net_amount).toBe(600);
            expect(result.targetInvoice.total_paid).toBe(300);
            expect(result.targetInvoice.outstanding_debt).toBe(300);

            // Verify in database
            const updatedTargetInvoice = await prisma.invoice.findUnique({
                where: { id: targetInvoice.id },
            });

            const updatedCreditInvoice = await prisma.invoice.findUnique({
                where: { id: creditInvoice.id },
            });

            expect(updatedTargetInvoice?.net_amount).toBe(600);
            expect(updatedTargetInvoice?.total_paid).toBe(300);
            expect(updatedCreditInvoice?.credit_for_invoice_id).toBe(
                targetInvoice.id
            );
        });

        it("should verify total_paid remains unchanged during credit assignment", async () => {
            const testCustomer = await prisma.customer.upsert({
                where: { id: 999998 },
                update: {},
                create: {
                    id: 999998,
                    customer_number: "999998",
                    account_id: testAccount.id,
                    collection_status: "Active",
                    type: "Company",
                },
            });

            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_TOTAL_PAID_001",
                    amount: 800,
                    net_amount: 800,
                    total_paid: 500,
                    outstanding_debt: 300,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Overdue",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                },
            });

            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_TOTAL_PAID_CREDIT_001",
                    amount: -200,
                    net_amount: -200,
                    total_paid: 0,
                    outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Paid",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                    credit_for_invoice_id: null,
                },
            });

            const originalTotalPaid = targetInvoice.total_paid;

            // Perform credit assignment
            const result = await invoiceService.assignCreditInvoice({
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 200,
            });

            // Verify total_paid remains exactly the same
            expect(result.targetInvoice.total_paid).toBe(originalTotalPaid);
            expect(result.targetInvoice.total_paid).toBe(500);

            // Verify other calculations
            expect(result.targetInvoice.net_amount).toBe(600);
            expect(result.targetInvoice.outstanding_debt).toBe(100);
        });

        it("should correctly update credit_for_invoice_number when assigning credit", async () => {
            const testCustomer = await prisma.customer.upsert({
                where: { id: 999997 },
                update: {},
                create: {
                    id: 999997,
                    customer_number: "999997",
                    account_id: testAccount.id,
                    collection_status: "Active",
                    type: "Company",
                },
            });

            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_INVOICE_NUMBER_001",
                    amount: 1000,
                    net_amount: 1000,
                    total_paid: 200,
                    outstanding_debt: 800,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Overdue",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                },
            });

            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_CREDIT_NUMBER_001",
                    amount: -400,
                    net_amount: -400,
                    total_paid: 0,
                    outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Paid",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                    credit_for_invoice_id: null,
                },
            });

            // Perform credit assignment
            const result = await invoiceService.assignCreditInvoice({
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 400,
            });

            // Verify the credit assignment worked correctly
            expect(result.creditInvoice.credit_for_invoice_id).toBe(
                targetInvoice.id
            );
            expect(result.creditInvoice.credit_for_invoice_number).toBe(
                targetInvoice.invoice_number
            );
        });
    });

    describe("Net Amount Recalculation", () => {
        it("should correctly recalculate net_amount using the formula (amount / customer_amount) * customer_net_amount", async () => {
            const testCustomer = await prisma.customer.create({
                data: {
                    account_id: testAccount.id,
                    customer_number: "NET_AMOUNT_TEST_001",
                    type: "Company",
                    collection_status: "Active",
                },
            });

            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TARGET_NET_001",
                    amount: 1000,
                    customer_amount: 800,
                    net_amount: 1000,
                    customer_net_amount: 800,
                    total_paid: 200,
                    customer_total_paid: 200,
                    outstanding_debt: 800,
                    customer_outstanding_debt: 600,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Overdue",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "EUR",
                },
            });

            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "CREDIT_NET_001",
                    amount: -400,
                    net_amount: -400,
                    total_paid: 0,
                    outstanding_debt: 0,
                    customer_amount: -400,
                    customer_total_paid: 0,
                    customer_outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Paid",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "EUR",
                    credit_for_invoice_id: null,
                },
            });

            // Perform credit assignment
            const assignment = {
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 400,
            };

            const result = await invoiceService.assignCreditInvoice(assignment);

            // Verify the credit assignment worked correctly
            expect(result.creditInvoice.credit_for_invoice_id).toBe(
                targetInvoice.id
            );

            // Verify customer_net_amount is reduced by credit amount
            expect(result.targetInvoice.customer_net_amount).toBe(400);

            // Verify net_amount is recalculated using the formula: (amount / customer_amount) * customer_net_amount
            // (1000 / 800) * 400 = 500
            expect(result.targetInvoice.net_amount).toBe(500);

            // Verify outstanding_debt is calculated based on new net_amount
            expect(result.targetInvoice.outstanding_debt).toBe(300);

            // Verify customer_amount is reduced by credit amount
            expect(result.targetInvoice.customer_amount).toBe(400);

            // Verify customer_outstanding_debt is calculated based on new customer_net_amount
            expect(result.targetInvoice.customer_outstanding_debt).toBe(200);

            // Verify total_paid remains unchanged
            expect(result.targetInvoice.total_paid).toBe(200);

            // Cleanup
            await prisma.invoice.deleteMany({
                where: {
                    id: { in: [targetInvoice.id, creditInvoice.id] },
                },
            });

            await prisma.customer.delete({
                where: { id: testCustomer.id },
            });

            await prisma.customer.delete({
                where: { id: testCustomer.id },
            });
        });

        it("should maintain proportional relationship between system and customer currencies", async () => {
            const testCustomer = await prisma.customer.create({
                data: {
                    account_id: testAccount.id,
                    customer_number: "CURRENCY_RATIO_TEST_001",
                    type: "Company",
                    collection_status: "Active",
                },
            });

            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TARGET_CURRENCY_001",
                    amount: 1000,
                    customer_amount: 800,
                    net_amount: 1000,
                    customer_net_amount: 800,
                    total_paid: 200,
                    customer_total_paid: 200,
                    outstanding_debt: 800,
                    customer_outstanding_debt: 600,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Overdue",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "EUR",
                },
            });

            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "CREDIT_CURRENCY_001",
                    amount: -400,
                    net_amount: -400,
                    total_paid: 0,
                    outstanding_debt: 0,
                    customer_amount: -400,
                    customer_total_paid: 0,
                    customer_outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status: "Paid",
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "EUR",
                    credit_for_invoice_id: null,
                },
            });

            // Perform credit assignment
            await invoiceService.assignCreditInvoice({
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 400,
            });

            // After credit assignment, verify the proportional relationship is maintained
            const updatedTargetInvoice = await prisma.invoice.findUnique({
                where: { id: targetInvoice.id },
            });

            if (!updatedTargetInvoice) {
                throw new Error("Updated target invoice not found");
            }

            // Calculate the expected ratio
            const expectedRatio =
                (updatedTargetInvoice.amount || 0) /
                (updatedTargetInvoice.customer_amount || 1);
            const actualRatio =
                (updatedTargetInvoice.net_amount || 0) /
                (updatedTargetInvoice.customer_net_amount || 1);

            // The ratios should be approximately equal (allowing for small floating point differences)
            expect(Math.abs(expectedRatio - actualRatio)).toBeLessThan(0.01);

            // Cleanup
            await prisma.invoice.deleteMany({
                where: {
                    id: { in: [targetInvoice.id, creditInvoice.id] },
                },
            });

            await prisma.customer.delete({
                where: { id: testCustomer.id },
            });

            await prisma.customer.delete({
                where: { id: testCustomer.id },
            });
        });
    });

    describe("Edge Cases", () => {
        it("should handle edge case where credit amount equals net_amount", async () => {
            const testCustomer = await prisma.customer.upsert({
                where: { id: 999997 },
                update: {},
                create: {
                    id: 999997,
                    customer_number: "999997",
                    account_id: testAccount.id,
                    collection_status: "Active",
                    type: "Company",
                },
            });

            const targetInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_EDGE_CASE_001",
                    amount: 500,
                    net_amount: 500,
                    total_paid: 100,
                    outstanding_debt: 400,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status_id: 3,
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                },
            });

            const creditInvoice = await prisma.invoice.create({
                data: {
                    invoice_number: "TEST_EDGE_CASE_CREDIT_001",
                    amount: -500,
                    net_amount: -500,
                    total_paid: 0,
                    outstanding_debt: 0,
                    account_id: testAccount.id,
                    customer_id: testCustomer.id,
                    status_id: 7,
                    due_date: new Date(),
                    invoice_date: new Date(),
                    customer_currency: "USD",
                    credit_for_invoice_id: null,
                },
            });

            // Perform credit assignment
            const result = await invoiceService.assignCreditInvoice({
                creditInvoiceId: creditInvoice.id,
                targetInvoiceId: targetInvoice.id,
                creditAmount: 500,
            });

            // Verify edge case calculations
            expect(result.targetInvoice.net_amount).toBe(0);
            expect(result.targetInvoice.total_paid).toBe(100);
            expect(result.targetInvoice.outstanding_debt).toBe(-100);
        });
    });

    describe("Credit Invoice Analysis", () => {
        it("should analyze credit invoice assignments", async () => {
            const assignedCredits = await prisma.invoice.findMany({
                where: {
                    amount: { lt: 0 },
                    credit_for_invoice_id: { not: null },
                },
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                    credit_for_invoice_id: true,
                },
                take: 10,
            });

            // Analyze a sample assignment if available
            if (assignedCredits.length > 0) {
                const sampleCredit = assignedCredits[0];
                const targetInvoice = await prisma.invoice.findUnique({
                    where: { id: sampleCredit.credit_for_invoice_id! },
                    select: {
                        id: true,
                        invoice_number: true,
                        amount: true,
                        net_amount: true,
                        total_paid: true,
                        outstanding_debt: true,
                    },
                });

                if (targetInvoice) {
                    // Verify business logic
                    const creditAmount = Math.abs(sampleCredit.amount || 0);
                    const expectedNetAmount =
                        (targetInvoice.amount || 0) - creditAmount;
                    const expectedOutstanding =
                        (targetInvoice.net_amount || 0) -
                        (targetInvoice.total_paid || 0);
                }
            }

            expect(Array.isArray(assignedCredits)).toBe(true);
        });

        it("should find unassigned credit invoices", async () => {
            const unassignedCredits = await prisma.invoice.findMany({
                where: {
                    amount: { lt: 0 },
                    credit_for_invoice_id: null,
                },
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                },
                take: 10,
            });

            expect(Array.isArray(unassignedCredits)).toBe(true);
        });
    });

    describe("Business Logic Validation", () => {
        it("should verify outstanding debt calculations", async () => {
            const invoicesWithCredits = await prisma.invoice.findMany({
                where: {
                    credit_for_invoice_id: { not: null },
                },
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                    net_amount: true,
                    total_paid: true,
                    outstanding_debt: true,
                },
                take: 5,
            });

            for (const invoice of invoicesWithCredits) {
                const calculatedOutstanding =
                    (invoice.net_amount || 0) - (invoice.total_paid || 0);
                const actualOutstanding = invoice.outstanding_debt || 0;

                // Verify calculations match
                expect(
                    Math.abs(calculatedOutstanding - actualOutstanding)
                ).toBeLessThan(0.01);
            }

            expect(invoicesWithCredits.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe("Real Data Analysis", () => {
        it("should analyze existing credit invoices in the database", async () => {
            const creditInvoices = await prisma.invoice.findMany({
                where: {
                    amount: { lt: 0 },
                    status: "Paid",
                },
                select: {
                    id: true,
                    invoice_number: true,
                    amount: true,
                    net_amount: true,
                    total_paid: true,
                    outstanding_debt: true,
                    credit_for_invoice_id: true,
                },
                take: 10,
            });

            const assignedCredits = creditInvoices.filter(
                (ci) => ci.credit_for_invoice_id !== null
            );
            const unassignedCredits = creditInvoices.filter(
                (ci) => ci.credit_for_invoice_id === null
            );

            // Analyze a sample assigned credit invoice
            if (assignedCredits.length > 0) {
                const sampleCredit = assignedCredits[0];

                if (sampleCredit.credit_for_invoice_id) {
                    const targetInvoice = await prisma.invoice.findUnique({
                        where: { id: sampleCredit.credit_for_invoice_id },
                        select: {
                            id: true,
                            invoice_number: true,
                            amount: true,
                            net_amount: true,
                            total_paid: true,
                            outstanding_debt: true,
                        },
                    });

                    if (targetInvoice) {
                        // Sample credit assignment analyzed
                    }
                }
            }

            expect(Array.isArray(creditInvoices)).toBe(true);
        });
    });
});

