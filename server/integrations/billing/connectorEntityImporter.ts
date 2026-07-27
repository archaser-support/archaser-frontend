import { prisma } from "@/lib/prisma";
import { ImportContactService } from "@/server/services/import/ImportContactService";
import {
    findCountryAndState,
    upsertCustomerAndRelated,
} from "@/server/services/import/ImportCustomerService";
import { ImportInvoiceService } from "@/server/services/import/ImportInvoiceService";
import { ImportPaymentService } from "@/server/services/import/ImportPaymentService";
import { ImportService } from "@/server/services/ImportService";
import type { InvoiceInput } from "@/server/services/InvoiceService";
import type { ContactInput, InvoicePaymentInput } from "@/server/services/ImportService";

export interface EntityImportBatchResult {
    success: number;
    failed: number;
    skipped: number;
    affectedCustomerIds: number[];
    errors: string[];
}

function toPaymentInput(
    row: Record<string, unknown>,
    accountId: number
): InvoicePaymentInput {
    return ImportService.normalizePaymentInput({
        ...row,
        account_id: accountId,
        company_code: row.company_code ?? "",
    });
}

export async function importMappedEntityBatch(
    importType: "Customer" | "Contact" | "Invoice" | "Payment",
    rows: Record<string, unknown>[],
    accountId: number,
    userId?: string
): Promise<EntityImportBatchResult> {
    const result: EntityImportBatchResult = {
        success: 0,
        failed: 0,
        skipped: 0,
        affectedCustomerIds: [],
        errors: [],
    };

    if (rows.length === 0) {
        return result;
    }

    if (importType === "Customer") {
        for (const row of rows) {
            try {
                const normalized = ImportService.normalizeCustomerInput(row);
                const { country, state } = await findCountryAndState(
                    normalized.country_iso2,
                    normalized.state_iso2
                );
                const existing = await prisma.customer.findFirst({
                    where: {
                        account_id: accountId,
                        customer_number: normalized.customer_number,
                    },
                });
                const customerId = await upsertCustomerAndRelated(
                    existing,
                    normalized,
                    country.id,
                    state?.id ?? null,
                    accountId,
                    userId
                );
                result.success += 1;
                result.affectedCustomerIds.push(customerId);
            } catch (error) {
                result.failed += 1;
                result.errors.push(
                    error instanceof Error ? error.message : String(error)
                );
            }
        }
        return result;
    }

    if (importType === "Contact") {
        const contactService = new ImportContactService();
        for (const row of rows) {
            try {
                const value = row as unknown as ContactInput & {
                    erp_contact_id?: string;
                };
                const { customerId, companyId } =
                    await contactService.findCustomerWithCompany(
                        String(value.customer_number),
                        accountId
                    );
                await contactService.importContact(
                    value,
                    companyId,
                    customerId,
                    userId
                );
                result.success += 1;
                result.affectedCustomerIds.push(customerId);
            } catch (error) {
                result.failed += 1;
                result.errors.push(
                    error instanceof Error ? error.message : String(error)
                );
            }
        }
        return result;
    }

    if (importType === "Invoice") {
        const invoiceService = new ImportInvoiceService();
        const invoices = rows.map(
            (row) =>
                ({
                    account_id: accountId,
                    ...row,
                }) as InvoiceInput
        );
        try {
            const importResult = await invoiceService.importInvoices(invoices);
            result.affectedCustomerIds = importResult.affectedCustomerIds ?? [];
            const successCount = importResult.results.filter(
                (row) => row.success
            ).length;
            result.success = successCount;
            result.failed = Math.max(0, rows.length - successCount);
        } catch (error) {
            result.failed = rows.length;
            result.errors.push(
                error instanceof Error ? error.message : String(error)
            );
        }
        return result;
    }

    const paymentService = new ImportPaymentService();
    const payments = rows.map((row) => toPaymentInput(row, accountId));
    const paymentResults = await paymentService.importPayments(
        payments,
        accountId
    );
    for (const paymentResult of paymentResults) {
        if (paymentResult.skipped) {
            result.skipped += 1;
        } else if (paymentResult.success) {
            result.success += 1;
        } else {
            result.failed += 1;
            if (paymentResult.message) {
                result.errors.push(paymentResult.message);
            }
        }
    }

    return result;
}

export function extractMaxUpdatedAt(
    records: Record<string, unknown>[]
): Date | null {
    let max: Date | null = null;
    for (const record of records) {
        const raw = record.UDATE;
        if (!raw) {
            continue;
        }
        const parsed = new Date(String(raw));
        if (Number.isNaN(parsed.getTime())) {
            continue;
        }
        if (!max || parsed > max) {
            max = parsed;
        }
    }
    return max;
}
