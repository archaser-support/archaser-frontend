import { Invoice, InvoicePayment } from "@prisma/client";

import { DbClient, prisma } from "@/lib/prisma";

import { CustomerService } from "../CustomerService";

export type LinkDeferredPaymentAndRecalcResult = {
    invoicePayment: InvoicePayment;
    updatedInvoice: Invoice;
    alreadyLinked: boolean;
};

export async function recalculateInvoiceFromLinkedPayments(
    tx: DbClient,
    invoiceId: number
): Promise<Invoice> {
    const totals = await tx.invoicePayment.aggregate({
        where: {
            invoice_id: invoiceId,
        },
        _sum: {
            amount: true,
            customer_amount: true,
        },
    });

    const totalPaid = totals._sum.amount ?? 0;
    const totalCustomerPaid = totals._sum.customer_amount ?? 0;

    const invoice = await tx.invoice.findUnique({
        where: { id: invoiceId },
    });

    if (!invoice) {
        throw new Error(`Invoice ${invoiceId} not found`);
    }

    const newOutstanding = (invoice.net_amount ?? 0) - totalPaid;
    const newCustomerOutstanding =
        (invoice.customer_net_amount ?? 0) - totalCustomerPaid;

    const becomesPaid = newCustomerOutstanding === 0;

    return tx.invoice.update({
        where: { id: invoiceId },
        data: {
            total_paid: totalPaid,
            customer_total_paid: totalCustomerPaid,
            outstanding_debt: newOutstanding,
            customer_outstanding_debt: newCustomerOutstanding,
            status: becomesPaid ? "Paid" : invoice.status,
            ...(becomesPaid && {
                zero_limit_alert: false,
                reporting_breach: false,
            }),
        },
    });
}

export async function runInvoicePaymentSideEffects(params: {
    customerId: number;
    accountId: number;
    invoiceId: number;
}): Promise<void> {
    await CustomerService.recalculateAllAmountsForCustomers([
        params.customerId,
    ]);
    const { syncCustomerInsuranceFields } = await import(
        "@/server/services/creditInsurance/syncCustomerInsuranceFields"
    );
    await syncCustomerInsuranceFields(params.customerId, {
        invoiceIds: [params.invoiceId],
    });

    try {
        const { invalidateDashboardCacheForAccount } = await import(
            "@/server/utils/cacheInvalidationHelper"
        );
        await invalidateDashboardCacheForAccount(params.accountId);
    } catch (error) {
        console.error("Failed to invalidate dashboard cache:", error);
    }
}

/**
 * Promote a deferred payment (invoice_id null) to a linked payment and
 * recalculate invoice totals, customer rollups, and capacity gap sync.
 */
export async function linkDeferredPaymentAndRecalc(params: {
    invoicePaymentId: number;
    invoiceId: number;
    skipSideEffects?: boolean;
    /** Re-run invoice totals when payment is already linked (chronological AR replay). */
    forceRecalc?: boolean;
}): Promise<LinkDeferredPaymentAndRecalcResult> {
    const {
        invoicePaymentId,
        invoiceId,
        skipSideEffects = false,
        forceRecalc = false,
    } = params;

    const result = await prisma.$transaction(async (tx) => {
        const payment = await tx.invoicePayment.findUnique({
            where: { id: invoicePaymentId },
        });

        if (!payment) {
            throw new Error(`InvoicePayment ${invoicePaymentId} not found`);
        }

        if (payment.invoice_id === invoiceId) {
            if (!forceRecalc) {
                const invoice = await tx.invoice.findUnique({
                    where: { id: invoiceId },
                });
                if (!invoice) {
                    throw new Error(`Invoice ${invoiceId} not found`);
                }
                return {
                    invoicePayment: payment,
                    updatedInvoice: invoice,
                    alreadyLinked: true,
                };
            }

            const updatedInvoice = await recalculateInvoiceFromLinkedPayments(
                tx,
                invoiceId
            );
            return {
                invoicePayment: payment,
                updatedInvoice,
                alreadyLinked: true,
            };
        }

        if (payment.invoice_id !== null) {
            throw new Error(
                `InvoicePayment ${invoicePaymentId} is already linked to invoice ${payment.invoice_id}`
            );
        }

        const linkedPayment = await tx.invoicePayment.update({
            where: { id: invoicePaymentId },
            data: { invoice_id: invoiceId },
        });

        const updatedInvoice = await recalculateInvoiceFromLinkedPayments(
            tx,
            invoiceId
        );

        return {
            invoicePayment: linkedPayment,
            updatedInvoice,
            alreadyLinked: false,
        };
    });

    if (!skipSideEffects && (!result.alreadyLinked || forceRecalc)) {
        await runInvoicePaymentSideEffects({
            customerId: result.invoicePayment.customer_id,
            accountId: result.invoicePayment.account_id,
            invoiceId,
        });
    }

    return result;
}
