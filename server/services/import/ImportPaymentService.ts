import { prismaJobs } from "@/lib/prisma";
import { CustomerService } from "@/server/services/CustomerService";
import { InvoicePaymentInput } from "@/server/services/ImportService";
import { PaymentService } from "@/server/services/PaymentService";
import { resolvePaymentImportAmounts } from "@/server/services/import/resolvePaymentImportAmounts";

function getPrisma() {
    return prismaJobs();
}

export interface ImportPaymentResult {
    index: number;
    success: boolean;
    skipped?: boolean;
    deferred?: boolean;
    invoicePaymentId?: number;
    customerId?: number;
    message?: string;
}

export interface BusinessUnitAccessError {
    index: number;
    businessUnitId: number | null;
}

function resolveDeferredPaymentAmounts(record: InvoicePaymentInput): {
    amount: number;
    customer_amount: number;
    customer_currency: string;
} {
    const customer_amount = record.customer_amount;
    const customer_currency = record.customer_currency.trim();

    if (record.amount !== undefined && Number.isFinite(record.amount)) {
        return {
            amount: record.amount,
            customer_amount,
            customer_currency,
        };
    }

    return {
        amount: customer_amount,
        customer_amount,
        customer_currency,
    };
}

export class ImportPaymentService {
    private paymentService = new PaymentService();

    async importPayments(
        paymentRecords: InvoicePaymentInput[],
        accountId: number,
        options?: {
            businessUnitAccessErrors?: BusinessUnitAccessError[];
            businessUnitExternalIdMap?: Map<number, string>;
        }
    ): Promise<ImportPaymentResult[]> {
        const businessUnitAccessErrors = options?.businessUnitAccessErrors ?? [];
        const businessUnitExternalIdMap =
            options?.businessUnitExternalIdMap ?? new Map<number, string>();

        const paymentCustomerNumbers = paymentRecords.map(
            (payment) => payment.customer_number
        );
        const customerByCustomerNumber =
            await CustomerService.findCustomersByCustomerNumber(
                paymentCustomerNumbers,
                accountId
            );

        const results: ImportPaymentResult[] = [];

        for (let i = 0; i < paymentRecords.length; i++) {
            const record = paymentRecords[i];

            const buAccessError = businessUnitAccessErrors.find(
                (error) => error.index === i
            );
            if (buAccessError) {
                const externalId =
                    businessUnitExternalIdMap.get(
                        buAccessError.businessUnitId!
                    ) || `BU-${buAccessError.businessUnitId}`;
                results.push({
                    index: i,
                    success: false,
                    message: `import.validation.businessUnitAccessDenied:${externalId}`,
                });
                continue;
            }

            const customerId = customerByCustomerNumber.get(
                record.customer_number
            );

            if (!customerId) {
                results.push({
                    index: i,
                    success: false,
                    message: `Customer ${record.customer_number} not found`,
                });
                continue;
            }

            if (!record.reference) {
                results.push({
                    index: i,
                    success: false,
                    message: "Reference ID is required",
                });
                continue;
            }

            const existingPayment = await getPrisma().invoicePayment.findFirst({
                where: {
                    account_id: record.account_id,
                    customer_id: customerId,
                    reference: record.reference,
                },
                select: { id: true },
            });

            if (existingPayment) {
                results.push({
                    index: i,
                    success: true,
                    skipped: true,
                    invoicePaymentId: existingPayment.id,
                    customerId,
                    message: "import.results.paymentSkipped",
                });
                continue;
            }

            const invoice = await getPrisma().invoice.findFirst({
                where: {
                    invoice_number: record.invoice_number,
                    customer_id: customerId,
                },
                select: {
                    id: true,
                    amount: true,
                    customer_amount: true,
                    customer_currency: true,
                },
            });

            if (!invoice) {
                const deferredAmounts = resolveDeferredPaymentAmounts(record);

                try {
                    const deferredPayment =
                        await this.paymentService.createDeferredInvoicePayment({
                            invoice_number: record.invoice_number,
                            amount: deferredAmounts.amount,
                            payment_date: new Date(record.payment_date),
                            payment_method: record.payment_method ?? "",
                            reference: record.reference,
                            customer_id: customerId,
                            account_id: record.account_id,
                            customer_currency: deferredAmounts.customer_currency,
                            customer_amount: deferredAmounts.customer_amount,
                        });

                    record.amount = deferredAmounts.amount;
                    record.customer_amount = deferredAmounts.customer_amount;
                    record.customer_currency =
                        deferredAmounts.customer_currency;

                    results.push({
                        index: i,
                        success: true,
                        deferred: true,
                        invoicePaymentId: deferredPayment.id,
                        customerId,
                        message: "import.results.paymentDeferred",
                    });
                } catch (err) {
                    results.push({
                        index: i,
                        success: false,
                        message:
                            err instanceof Error ? err.message : "Unknown error",
                    });
                }
                continue;
            }

            const amountResolution = resolvePaymentImportAmounts(
                {
                    amount: record.amount,
                    customer_amount: record.customer_amount,
                    customer_currency: record.customer_currency,
                },
                {
                    amount: invoice.amount,
                    customer_amount: invoice.customer_amount,
                    customer_currency: invoice.customer_currency,
                }
            );

            if (!amountResolution.ok) {
                results.push({
                    index: i,
                    success: false,
                    message: amountResolution.errorKey,
                });
                continue;
            }

            record.amount = amountResolution.amount;
            record.customer_amount = amountResolution.customer_amount;
            record.customer_currency = amountResolution.customer_currency;

            try {
                const { invoicePayment } =
                    await this.paymentService.createInvoicePayment(
                        {
                            invoice_id: invoice.id,
                            invoice_number: record.invoice_number,
                            amount: amountResolution.amount,
                            payment_date: new Date(record.payment_date),
                            payment_method: record.payment_method ?? "",
                            reference: record.reference,
                            customer_id: customerId,
                            account_id: record.account_id,
                            customer_currency:
                                amountResolution.customer_currency,
                            customer_amount: amountResolution.customer_amount,
                            customer_number: record.customer_number,
                        },
                        // Job complete runs shared AR post-ingest once per batch.
                        { skipArPostIngest: true }
                    );

                results.push({
                    index: i,
                    success: true,
                    invoicePaymentId: invoicePayment.id,
                    customerId,
                });
            } catch (err) {
                results.push({
                    index: i,
                    success: false,
                    message:
                        err instanceof Error ? err.message : "Unknown error",
                });
            }
        }

        return results;
    }
}
