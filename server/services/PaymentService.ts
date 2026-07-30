import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import {
    recalculateInvoiceFromLinkedPayments,
    runInvoicePaymentSideEffects,
} from "./invoicePayment/linkDeferredPaymentAndRecalc";
import { validateInvoicePaymentFields } from "./invoicePayment/validateInvoicePaymentFields";
import { LogService } from "./LogService";

interface CreatePaymentDTO {
    invoice_id: number;
    amount: number;
    payment_date: Date;
    payment_method: string;
    reference: string;
    customer_id: number;
    account_id?: number;
    customer_currency: string;
    customer_amount: number;
    customer_number: string;
    /** When set, stored on InvoicePayment so chronological AR replay can see linked rows. */
    invoice_number?: string;
}

/** Options for linked payment create side paths (import batch vs UI/API). */
export type CreateInvoicePaymentOptions = {
    /**
     * When true, skip chronological AR replay + live refresh even if
     * payment_date is backdated. Import uses this because payment job
     * complete runs the shared orchestration once for all affected customers.
     */
    skipArPostIngest?: boolean;
};

interface CreateDeferredPaymentDTO {
    invoice_number: string;
    amount: number;
    payment_date: Date;
    payment_method: string;
    reference: string;
    customer_id: number;
    account_id: number;
    customer_currency: string;
    customer_amount: number;
}

export class PaymentService {
    private logService = LogService.getInstance();
    public async createInvoicePayment(
        data: CreatePaymentDTO,
        options?: CreateInvoicePaymentOptions
    ) {
        try {
            const { invoicePayment, updatedInvoice } = await prisma.$transaction(
                async (tx) => {
                    let invoiceNumber =
                        typeof data.invoice_number === "string"
                            ? data.invoice_number.trim()
                            : "";
                    if (!invoiceNumber) {
                        const invoice = await tx.invoice.findUnique({
                            where: { id: data.invoice_id },
                            select: { invoice_number: true },
                        });
                        invoiceNumber = invoice?.invoice_number?.trim() ?? "";
                    }

                    const createdPayment = await tx.invoicePayment.create({
                        data: {
                            invoice_id: data.invoice_id,
                            ...(invoiceNumber
                                ? { invoice_number: invoiceNumber }
                                : {}),
                            customer_currency: data.customer_currency,
                            payment_date: data.payment_date,
                            amount: data.amount,
                            payment_method: data.payment_method,
                            reference: data.reference,
                            customer_id: data.customer_id,
                            account_id: data.account_id!,
                            customer_amount: data.customer_amount,
                        },
                    });

                    const nextInvoice = await recalculateInvoiceFromLinkedPayments(
                        tx,
                        data.invoice_id
                    );

                    return {
                        invoicePayment: createdPayment,
                        updatedInvoice: nextInvoice,
                    };
                }
            );

            await runInvoicePaymentSideEffects({
                customerId: data.customer_id,
                accountId: data.account_id!,
                invoiceId: data.invoice_id,
            });

            // A settlement dated in the past changes open AR on the days from the
            // payment date forward; rewrite that window overnight.
            if (data.account_id != null) {
                const { enqueueAsOfRewrite } = await import(
                    "@/server/services/creditInsurance/asOfRewriteQueue"
                );
                const { startOfTodayUtc, toUtcDateOnly } = await import(
                    "@/shared/creditInsurance/insurancePolicyLifecycle"
                );
                const todayUtc = startOfTodayUtc();
                await enqueueAsOfRewrite({
                    accountId: data.account_id,
                    customerIds: [data.customer_id],
                    fromDate: data.payment_date,
                    toDate: todayUtc,
                }).catch(() => {});

                // Backdated UI/API create: chronological AR replay + live refresh.
                // Same-day creates keep the lighter path. Import batches skip here
                // and rely on payment job complete instead.
                const isBackdated =
                    toUtcDateOnly(data.payment_date).getTime() <
                    todayUtc.getTime();
                if (isBackdated && !options?.skipArPostIngest) {
                    const { runArPostIngestForCustomers } = await import(
                        "@/server/services/import/arPostIngestForCustomers"
                    );
                    await runArPostIngestForCustomers({
                        accountId: data.account_id,
                        customerIds: [data.customer_id],
                        runMaturity: false,
                        runLiveRefresh: true,
                    });
                }
            }

            return { invoicePayment, updatedInvoice };
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "PaymentService.createInvoicePayment",
                "PaymentService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    /**
     * Store a payment awaiting invoice linkage (invoice_id null).
     * Does not update invoice totals or customer rollups until linked.
     */
    public async createDeferredInvoicePayment(data: CreateDeferredPaymentDTO) {
        validateInvoicePaymentFields({
            invoice_id: null,
            invoice_number: data.invoice_number,
        });

        try {
            return await prisma.invoicePayment.create({
                data: {
                    invoice_id: null,
                    invoice_number: data.invoice_number,
                    customer_currency: data.customer_currency,
                    payment_date: data.payment_date,
                    amount: data.amount,
                    payment_method: data.payment_method,
                    reference: data.reference,
                    customer_id: data.customer_id,
                    account_id: data.account_id,
                    customer_amount: data.customer_amount,
                },
            });
        } catch (error: unknown) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "PaymentService.createDeferredInvoicePayment",
                "PaymentService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined,
                undefined,
                undefined,
                undefined
            );
            throw error;
        }
    }

    public async processPayment(
        paymentId: number,
        allocations: Array<{ invoiceId: number; amount: number }>
    ): Promise<void> {
        return prisma.$transaction(async (tx) => {
            try {
                const payment = await tx.invoicePayment.findUnique({
                    where: { id: paymentId },
                });
                if (!payment) throw new Error("Payment not found");

                for (const alloc of allocations) {
                    await tx.invoicePayment.create({
                        data: {
                            invoice_id: alloc.invoiceId,
                            amount: alloc.amount,
                            payment_date: new Date(),
                            customer_currency: payment.customer_currency,
                            payment_method: "Allocation",
                            reference: `Allocation for payment ${paymentId}`,
                            customer_id: payment.customer_id,
                            account_id: payment.account_id,
                            customer_amount: alloc.amount,
                        },
                    });
                }
            } catch (error: any) {
                await this.logService.logMessage(
                    LogLevel.ERROR,
                    "PaymentService.processPayment",
                    "PaymentService",
                    {
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    },
                    undefined, // accountId
                    undefined, // userId
                    undefined, // jobId
                    undefined // correlationId
                );
                throw error;
            }
        });
    }

    public async schedulePaymentFollowUp(
        paymentId: number,
        followUpDate: Date
    ): Promise<void> {
        try {
            const payment = await prisma.invoicePayment.findUnique({
                where: { id: paymentId },
            });
            if (!payment) throw new Error("Payment not found");

            const collectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: payment.customer_id,
                        period_end_date: null,
                    },
                });
            if (!collectionPeriod)
                throw new Error("No active collection period found");

            await prisma.activity.create({
                data: {
                    title: "{{activities.fields.payment_follow_up}}",
                    content: `Follow up for payment ${paymentId}`,
                    type: "Call",
                    actual_delivery_time: new Date(),
                    schedule_time: followUpDate,
                    customer_id: payment.customer_id,
                    collection_period_id: collectionPeriod.id,
                    account_id: payment.account_id,
                    status: "SCHEDULED",
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "PaymentService.schedulePaymentFollowUp",
                "PaymentService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }

    public async getPaymentById(paymentId: number): Promise<any> {
        try {
            return await prisma.invoicePayment.findUnique({
                where: { id: paymentId },
                include: {
                    Invoice: true,
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                "PaymentService.getPaymentById",
                "PaymentService",
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                undefined, // accountId
                undefined, // userId
                undefined, // jobId
                undefined // correlationId
            );
            throw error;
        }
    }
}
