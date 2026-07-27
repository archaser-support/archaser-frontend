import { prisma } from "@/lib/prisma";
import {
    InvoiceInput,
    InvoiceService,
} from "@/server/services/InvoiceService";

import { normalizeInvoiceImportInput } from "./normalizeInvoiceImportInput";
import { sortInvoicesForImport } from "./sortInvoicesForImport";

export class ImportInvoiceService {
    private invoiceService = new InvoiceService();

    async importInvoices(invoices: InvoiceInput[]) {
        const normalized = invoices.map((invoice) =>
            normalizeInvoiceImportInput(
                invoice as unknown as Record<string, unknown>,
                invoice.account_id
            )
        );
        const sorted = sortInvoicesForImport(normalized);

        // Payments win: if payment records already exist for an invoice number,
        // zero out file total_paid so replay owns those totals (D4 in PRD).
        const invoiceNumbersWithPayments =
            await this.getInvoiceNumbersWithPayments(sorted);

        const adjusted =
            invoiceNumbersWithPayments.size > 0
                ? sorted.map((invoice) => {
                      if (
                          invoice.invoice_number &&
                          invoiceNumbersWithPayments.has(invoice.invoice_number)
                      ) {
                          return {
                              ...invoice,
                              total_paid: 0,
                              customer_total_paid: 0,
                          };
                      }
                      return invoice;
                  })
                : sorted;

        return this.invoiceService.createMany(adjusted);
    }

    /**
     * Returns the set of invoice numbers (within the same account) that already
     * have at least one InvoicePayment row — deferred or linked.
     * Used to enforce "payments win" over file total_paid columns.
     */
    private async getInvoiceNumbersWithPayments(
        invoices: InvoiceInput[]
    ): Promise<Set<string>> {
        const invoiceNumbers = invoices
            .map((i) => i.invoice_number)
            .filter((n): n is string => Boolean(n));

        if (invoiceNumbers.length === 0) {
            return new Set();
        }

        const accountId = invoices[0]?.account_id;
        if (!accountId) {
            return new Set();
        }

        const rows = await prisma.invoicePayment.findMany({
            where: {
                account_id: accountId,
                invoice_number: { in: invoiceNumbers },
            },
            select: { invoice_number: true },
        });

        return new Set(
            rows
                .map((r) => r.invoice_number)
                .filter((n): n is string => Boolean(n))
        );
    }
}
