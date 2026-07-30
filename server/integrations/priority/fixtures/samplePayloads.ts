/**
 * Priority OData sample payloads for mapper tests and the local mock server.
 * Field names follow Priority Developer Portal conventions; pilot must confirm
 * via GetMetadataFor(entity=...) against the target environment.
 *
 * Dated-backfill fixtures (cutover 2025-06-01):
 * - INV-2024-OPEN: unpaid, IVDATE before cutover (include when older-open on)
 * - INV-2024-PAID: paid (IVBALANCE 0), IVDATE before cutover (exclude from older-open)
 * - INV-2025-*: on/after window samples
 * - Payments: related to open invoice (any PAYDATE) + unrelated for filter smoke
 */

import type { ImportType } from "@prisma/client";

export type PriorityEntityImportType = Extract<
    ImportType,
    "Customer" | "Contact" | "Invoice" | "Payment"
>;

/** Raw Priority CUSTOMERS records (entity set CUSTOMERS). */
export const CUSTOMER_SAMPLES = [
    {
        CUSTNAME: "T000001",
        CDES: "Acme Trading Ltd",
        CUSTDES: "Acme Trading Ltd",
        EMAIL: "billing@acme.example",
        PHONE: "+1-415-555-0100",
        STATDES: "Active",
        COUNTRYNAME: "United States",
        STATE: "CA",
        ADDRESS: "100 Market St",
        ZIP: "94105",
        WTAXNUM: "US-514123456",
        UDATE: "2025-06-01T08:15:00Z",
    },
    {
        CUSTNAME: "T000002",
        CDES: "Beta Industries",
        CUSTDES: "Beta Industries",
        EMAIL: "ap@beta.example",
        PHONE: "+1-212-555-0200",
        STATDES: "Active",
        COUNTRYNAME: "United States",
        STATE: "NY",
        ADDRESS: "200 Broadway",
        ZIP: "10007",
        WTAXNUM: "US-514987654",
        UDATE: "2025-06-10T14:30:00Z",
    },
    {
        CUSTNAME: "T000003",
        CDES: "Gamma Services",
        CUSTDES: "Gamma Services",
        EMAIL: null,
        PHONE: "+972-3-555-0300",
        STATDES: "Active",
        COUNTRYNAME: "Israel",
        STATE: null,
        ADDRESS: "12 Rothschild Blvd",
        ZIP: "6688101",
        WTAXNUM: "514111222",
        UDATE: "2025-06-15T09:00:00Z",
    },
] as const;

/** Raw Priority CUSTPERSONNEL records (customer contacts). */
export const CONTACT_SAMPLES = [
    {
        KLINE: 10001,
        CUSTNAME: "T000001",
        NAME: "Jane Smith",
        FIRSTNAME: "Jane",
        LASTNAME: "Smith",
        EMAIL: "jane.smith@acme.example",
        PHONE: "+1-415-555-0101",
        CELLPHONE: "+1-415-555-0199",
        POSITIONDES: "AP Manager",
        UDATE: "2025-06-02T11:00:00Z",
    },
    {
        KLINE: 10002,
        CUSTNAME: "T000001",
        NAME: "Bob Lee",
        FIRSTNAME: "Bob",
        LASTNAME: "Lee",
        EMAIL: "bob.lee@acme.example",
        PHONE: "+1-415-555-0102",
        CELLPHONE: null,
        POSITIONDES: "Controller",
        UDATE: "2025-06-05T16:45:00Z",
    },
    {
        KLINE: 10003,
        CUSTNAME: "T000002",
        NAME: "Maria Garcia",
        FIRSTNAME: "Maria",
        LASTNAME: "Garcia",
        EMAIL: "maria@beta.example",
        PHONE: "+1-212-555-0201",
        CELLPHONE: "+1-212-555-0299",
        POSITIONDES: "Finance",
        UDATE: "2025-06-12T10:20:00Z",
    },
] as const;

/**
 * Raw Priority CINVOICES records (AR invoices; includes credit note +
 * dated-backfill unpaid/paid older opens).
 * IVBALANCE is mock/local — live CINVOICES may omit it (use TFNCITEMS2ONE).
 *
 * Cutover fixture start: 2025-06-01T00:00:00Z
 * - Before + unpaid: INV-2024-OPEN, INV-2025-0002
 * - Before + paid: INV-2024-PAID, INV-2025-0001
 * - On/after: INV-2025-0003
 */
export const INVOICE_SAMPLES = [
    {
        IVNUM: "INV-2024-OPEN",
        IVTYPE: "A",
        DEBIT: "D",
        CUSTNAME: "T000001",
        IVDATE: "2024-03-15T00:00:00Z",
        DUEDATE: "2024-04-15T00:00:00Z",
        TOTPRICE: 5000.0,
        IVBALANCE: 3500.0,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "SO-9001",
        UDATE: "2024-03-15T07:00:00Z",
        CREDITFOR: null,
    },
    {
        IVNUM: "INV-2024-PAID",
        IVTYPE: "A",
        DEBIT: "D",
        CUSTNAME: "T000002",
        IVDATE: "2024-02-01T00:00:00Z",
        DUEDATE: "2024-03-01T00:00:00Z",
        TOTPRICE: 800.0,
        IVBALANCE: 0,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "SO-9002",
        UDATE: "2024-02-01T08:00:00Z",
        CREDITFOR: null,
    },
    {
        IVNUM: "INV-2025-0001",
        IVTYPE: "A",
        DEBIT: "D",
        CUSTNAME: "T000001",
        IVDATE: "2025-05-01T00:00:00Z",
        DUEDATE: "2025-06-01T00:00:00Z",
        TOTPRICE: 1500.0,
        IVBALANCE: 0,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "SO-1001",
        UDATE: "2025-05-01T07:00:00Z",
        CREDITFOR: null,
    },
    {
        IVNUM: "INV-2025-0002",
        IVTYPE: "A",
        DEBIT: "D",
        CUSTNAME: "T000002",
        IVDATE: "2025-05-15T00:00:00Z",
        DUEDATE: "2025-06-15T00:00:00Z",
        TOTPRICE: 2270.33,
        IVBALANCE: 2270.33,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "SO-1002",
        UDATE: "2025-05-15T12:30:00Z",
        CREDITFOR: null,
    },
    {
        IVNUM: "INV-2025-0003",
        IVTYPE: "A",
        DEBIT: "D",
        CUSTNAME: "T000003",
        IVDATE: "2025-06-10T00:00:00Z",
        DUEDATE: "2025-07-10T00:00:00Z",
        TOTPRICE: 990.0,
        IVBALANCE: 990.0,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "SO-1003",
        UDATE: "2025-06-10T09:00:00Z",
        CREDITFOR: null,
    },
    {
        IVNUM: "CN-2025-0001",
        IVTYPE: "A",
        DEBIT: "C",
        CUSTNAME: "T000001",
        IVDATE: "2025-05-20T00:00:00Z",
        DUEDATE: "2025-05-20T00:00:00Z",
        TOTPRICE: -250.0,
        IVBALANCE: 0,
        CODE: "USD",
        STATDES: "Final",
        BOOKNUM: "CN-2001",
        UDATE: "2025-05-20T09:15:00Z",
        CREDITFOR: "INV-2025-0001",
    },
] as const;

/**
 * Raw Priority TOTARPAY records (AR payment receipts).
 * Includes related payments for INV-2024-OPEN (any date) and an unrelated row.
 */
export const PAYMENT_SAMPLES = [
    {
        PAYNUM: "PAY-2024-OPEN-1",
        CUSTNAME: "T000001",
        IVNUM: "INV-2024-OPEN",
        IVTYPE: "A",
        PAYDATE: "2024-06-01T00:00:00Z",
        PAYMENT: 1000.0,
        CODE: "USD",
        PAYMENTCODE: "1",
        PAYDES: "Wire transfer",
        UDATE: "2024-06-01T10:00:00Z",
    },
    {
        PAYNUM: "PAY-2024-OPEN-2",
        CUSTNAME: "T000001",
        IVNUM: "INV-2024-OPEN",
        IVTYPE: "A",
        PAYDATE: "2025-01-15T00:00:00Z",
        PAYMENT: 500.0,
        CODE: "USD",
        PAYMENTCODE: "1",
        PAYDES: "Wire transfer",
        UDATE: "2025-01-15T11:00:00Z",
    },
    {
        PAYNUM: "PAY-2024-PAID-1",
        CUSTNAME: "T000002",
        IVNUM: "INV-2024-PAID",
        IVTYPE: "A",
        PAYDATE: "2024-02-20T00:00:00Z",
        PAYMENT: 800.0,
        CODE: "USD",
        PAYMENTCODE: "2",
        PAYDES: "Credit Card",
        UDATE: "2024-02-20T09:00:00Z",
    },
    {
        PAYNUM: "PAY-2025-0001",
        CUSTNAME: "T000001",
        IVNUM: "INV-2025-0001",
        IVTYPE: "A",
        PAYDATE: "2025-05-25T00:00:00Z",
        PAYMENT: 1250.0,
        CODE: "USD",
        PAYMENTCODE: "1",
        PAYDES: "Wire transfer",
        UDATE: "2025-05-25T10:00:00Z",
    },
    {
        PAYNUM: "PAY-2025-0002",
        CUSTNAME: "T000002",
        IVNUM: "INV-2025-0002",
        IVTYPE: "A",
        PAYDATE: "2025-06-01T00:00:00Z",
        PAYMENT: 2270.33,
        CODE: "USD",
        PAYMENTCODE: "2",
        PAYDES: "Credit Card",
        UDATE: "2025-06-01T14:00:00Z",
    },
    {
        PAYNUM: "PAY-2025-0003",
        CUSTNAME: "T000001",
        IVNUM: "INV-2025-0001",
        IVTYPE: "A",
        PAYDATE: "2025-06-10T00:00:00Z",
        PAYMENT: 250.0,
        CODE: "USD",
        PAYMENTCODE: "1",
        PAYDES: "Wire transfer",
        UDATE: "2025-06-10T08:30:00Z",
    },
] as const;

export const SAMPLE_PAYLOADS_BY_IMPORT_TYPE: Record<
    PriorityEntityImportType,
    readonly Record<string, unknown>[]
> = {
    Customer: CUSTOMER_SAMPLES,
    Contact: CONTACT_SAMPLES,
    Invoice: INVOICE_SAMPLES,
    Payment: PAYMENT_SAMPLES,
};

/** Example cutover instant used in mock / unit smoke checks. */
export const DATED_BACKFILL_FIXTURE_START_ISO = "2025-06-01T00:00:00Z";
