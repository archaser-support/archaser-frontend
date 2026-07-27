import fs from "fs";
import path from "path";

import { ImportService } from "@/server/services/ImportService";

import { readGoldenExcelRows } from "./readGoldenExcelRows";
import {
    GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER,
    type GoldenImportFixturePaths,
    type GoldenInvoiceImportRow,
    type GoldenPaymentImportRow,
    type PreprocessedGoldenImportFiles,
} from "./types";

const PAYMENT_CUSTOMER_REMAP: Record<string, string> = {
    "5405": GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER,
};

function toOptionalNumber(value: unknown): number | undefined {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }
    const parsed = typeof value === "string" ? parseFloat(value) : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function toOptionalString(value: unknown): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    const trimmed = String(value).trim();
    return trimmed ? trimmed : undefined;
}

function normalizeGoldenDate(value: unknown): string | undefined {
    const normalized = ImportService.normalizeDateInput(value);
    if (normalized === null || normalized === undefined || normalized === "") {
        return undefined;
    }
    return normalized;
}

function looksLikeInvoiceNumber(value: unknown): boolean {
    const numeric = toOptionalNumber(value);
    if (numeric === undefined) {
        return false;
    }
    return Number.isInteger(numeric) && numeric >= 1_000_000;
}

function resolveCustomerNumber(
    rawValue: unknown,
    targetCustomerNumber: string
): string {
    const raw = toOptionalString(rawValue);
    if (!raw) {
        return targetCustomerNumber;
    }
    return PAYMENT_CUSTOMER_REMAP[raw] ?? raw;
}

function resolveMisalignedInvoiceNumber(row: Record<string, unknown>): {
    invoiceNumber?: string;
    customerTotalPaid?: number;
} {
    let invoiceNumber = toOptionalString(row.invoice_number);
    let customerTotalPaid = toOptionalNumber(row.customer_total_paid);

    if (!invoiceNumber && looksLikeInvoiceNumber(row.customer_total_paid)) {
        invoiceNumber = String(Math.trunc(Number(row.customer_total_paid)));
        customerTotalPaid = undefined;
    }

    if (
        invoiceNumber &&
        customerTotalPaid !== undefined &&
        looksLikeInvoiceNumber(customerTotalPaid) &&
        String(Math.trunc(customerTotalPaid)) === invoiceNumber
    ) {
        customerTotalPaid = undefined;
    }

    return { invoiceNumber, customerTotalPaid };
}

function resolveInvoiceAmounts(row: Record<string, unknown>): {
    amount: number;
    customerAmount: number;
    customerCurrency: string;
} {
    const customerAmount =
        toOptionalNumber(row.invoice_amount) ??
        toOptionalNumber(row.customer_amount) ??
        0;
    const baseAmount =
        toOptionalNumber(row.amount_base) ??
        toOptionalNumber(row.base_amount) ??
        toOptionalNumber(row.amount);

    const amount =
        baseAmount !== undefined && baseAmount === customerAmount
            ? baseAmount
            : customerAmount;

    const customerCurrency =
        toOptionalString(row.invoice_currency) ??
        toOptionalString(row.currency) ??
        toOptionalString(row.customer_currency) ??
        "";

    return {
        amount,
        customerAmount,
        customerCurrency,
    };
}

export function preprocessGoldenInvoiceRow(
    row: Record<string, unknown>,
    targetCustomerNumber: string = GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER
): GoldenInvoiceImportRow | null {
    const invoiceDate = normalizeGoldenDate(row.invoice_date);
    if (!invoiceDate) {
        return null;
    }

    const { invoiceNumber, customerTotalPaid } =
        resolveMisalignedInvoiceNumber(row);
    if (!invoiceNumber) {
        return null;
    }

    const { amount, customerAmount, customerCurrency } =
        resolveInvoiceAmounts(row);

    const normalized: GoldenInvoiceImportRow = {
        customer_number: resolveCustomerNumber(
            row.customer_id ?? row.customer_number,
            targetCustomerNumber
        ),
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        amount,
        customer_amount: customerAmount,
        customer_currency: customerCurrency,
    };

    const dueDate = normalizeGoldenDate(row.due_date);
    if (dueDate) {
        normalized.due_date = dueDate;
    }

    const totalPaid = toOptionalNumber(row.total_paid);
    if (totalPaid !== undefined) {
        normalized.total_paid = totalPaid;
    }

    if (customerTotalPaid !== undefined) {
        normalized.customer_total_paid = customerTotalPaid;
    }

    return normalized;
}

export function preprocessGoldenPaymentRow(
    row: Record<string, unknown>,
    targetCustomerNumber: string = GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER
): GoldenPaymentImportRow | null {
    const paymentDate = normalizeGoldenDate(
        row.payment_date ?? row.payment_date_
    );
    const customerAmount = toOptionalNumber(
        row.customer_amount ?? row.customer_amount_
    );
    const customerCurrency =
        toOptionalString(row.currency ?? row.customer_currency) ?? "";
    const invoiceNumber = toOptionalString(
        row.invoice_number ?? row.invoice_number_
    );
    const reference = toOptionalString(row.reference) ?? "";

    if (!paymentDate || !invoiceNumber || customerAmount === undefined) {
        return null;
    }

    const normalized: GoldenPaymentImportRow = {
        customer_number: resolveCustomerNumber(
            row.customer_number ?? row.customer_number_,
            targetCustomerNumber
        ),
        invoice_number: invoiceNumber,
        payment_date: paymentDate,
        customer_amount: customerAmount,
        customer_currency: customerCurrency,
        reference,
    };

    const amount = toOptionalNumber(row.amount);
    if (amount !== undefined) {
        normalized.amount = amount;
    }

    const paymentMethod = toOptionalString(row.payment_method);
    if (paymentMethod) {
        normalized.payment_method = paymentMethod;
    }

    return normalized;
}

export function preprocessGoldenImportRows(
    invoiceRows: Record<string, unknown>[],
    paymentRows: Record<string, unknown>[],
    options?: { targetCustomerNumber?: string }
): PreprocessedGoldenImportFiles {
    const targetCustomerNumber =
        options?.targetCustomerNumber ?? GOLDEN_LOOP_DEFAULT_CUSTOMER_NUMBER;

    const invoices = invoiceRows
        .map((row) => preprocessGoldenInvoiceRow(row, targetCustomerNumber))
        .filter((row): row is GoldenInvoiceImportRow => row !== null);

    const payments = paymentRows
        .map((row) => preprocessGoldenPaymentRow(row, targetCustomerNumber))
        .filter((row): row is GoldenPaymentImportRow => row !== null);

    return {
        customerNumber: targetCustomerNumber,
        invoices,
        payments,
    };
}

export async function preprocessGoldenImportFiles(
    fixturePaths: GoldenImportFixturePaths,
    options?: { targetCustomerNumber?: string }
): Promise<PreprocessedGoldenImportFiles> {
    const [invoiceRows, paymentRows] = await Promise.all([
        readGoldenExcelRows(fixturePaths.invoicesPath),
        readGoldenExcelRows(fixturePaths.paymentsPath),
    ]);

    return preprocessGoldenImportRows(invoiceRows, paymentRows, options);
}

export function defaultGoldenFixturePaths(
    fixturesDir?: string
): GoldenImportFixturePaths {
    const dir =
        fixturesDir ??
        [
            path.join(process.cwd(), "test/fixtures/import-golden-loop"),
            path.join(
                process.cwd(),
                "frontend/test/fixtures/import-golden-loop"
            ),
        ].find((candidate) => fs.existsSync(candidate)) ??
        path.join(process.cwd(), "frontend/test/fixtures/import-golden-loop");

    return {
        invoicesPath: path.join(dir, "invoices.xlsx"),
        paymentsPath: path.join(dir, "payments.xlsx"),
        expectedResultsPath: path.join(dir, "expected-results.xlsx"),
    };
}
