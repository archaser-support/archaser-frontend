import { Prisma, PrismaClient, type Invoice, invoice_status } from "@prisma/client";
import { DefaultArgs } from "@prisma/client/runtime/library";
import { v4 as uuidv4 } from "uuid";

import { DbClient, prisma, type ExtendedPrismaClient } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";
import { resolveCustomerFirstCurrency } from "@/utils/stringFormatters";

import {
    computeCreatedTermsViolationSnapshot,
    computeInvoiceInsuranceRowData,
    computeLimitAssessedAmountForNewOpenInvoice,
    invoiceOutstandingInLimitCurrency,
    parseImportDateToLocalCalendarDate,
    shouldSetReportingBreach,
} from "./creditInsurance/invoiceInsuranceFields";
import {
    restampCustomerOpenInvoiceLimitAssessment,
    sumOpenArByCustomerPolicyInLimitCurrency,
} from "./creditInsurance/restampCustomerLimitAssessment";
import {
    sweepReportingBreachForOverdueInvoiceIds,
    syncInvoiceReportingBreach,
} from "./creditInsurance/syncInvoiceReportingBreach";
import { syncCustomerInsuranceFields } from "./creditInsurance/syncCustomerInsuranceFields";
import { syncCreditInsuranceGapPipelineForCustomer } from "./creditInsurance/syncCreditInsuranceGapPipeline";
import { CollectionPeriodService } from "./CollectionPeriodService";
import { CustomerService } from "./CustomerService";
import { DueNotificationService } from "./DueNotificationService";
import { LogService } from "./LogService";
import { PaymentService } from "./PaymentService";

export interface InvoiceInput {
    account_id: number;
    customer_number: string;
    status?: string;
    invoice_date: string;
    due_date?: string;
    amount: number;
    customer_amount?: number;
    total_paid?: number;
    customer_total_paid?: number;
    customer_currency?: string;
    invoice_number: string;
    credit_for_invoice_number?: string;
    actual_reporting_date?: string | Date | null;
}

export interface CreditInvoiceAssignment {
    creditInvoiceId: number;
    targetInvoiceId: number;
    creditAmount: number;
}

export interface CreditInvoiceUpdate {
    creditInvoiceId: number;
    oldTargetInvoiceId?: number;
    newTargetInvoiceId?: number;
    creditAmount: number;
}

interface Invoicecreated_ata {
    account_id: number;
    customer_id: number;
    status: invoice_status;
    invoice_date: Date;
    due_date: Date | null;
    amount: number;
    net_amount: number;
    customer_amount: number | null;
    customer_net_amount: number;
    total_paid: number;
    customer_total_paid: number;
    customer_currency: string | null;
    invoice_number: string;
    credit_for_invoice_number?: string;
    credit_for_invoice_id?: number;
    outstanding_debt: number;
    customer_outstanding_debt: number;
    payment_term?: number | null;
    target_reporting_date?: Date | null;
    target_mep_date?: Date | null;
    actual_reporting_date?: Date | null;
    reported_status?: import("@prisma/client").invoice_reported_status | null;
    reporting_breach?: boolean;
    ctv_payment_term?: boolean;
    ctv_customer_overdue_mep?: boolean;
    ctv_customer_excluded_from_policy?: boolean;
    ctv_outdated_dcl?: boolean;
    ctv_invoice_after_policy_end?: boolean;
}

interface ExistingInvoicePaymentUpdate {
    total_paid: number;
    customer_total_paid: number;
}

interface InvoiceUpdateOperation {
    where: { id: number };
    data: ExistingInvoicePaymentUpdate;
}

export const INVOICE_STATUS = {
    OVERDUE: "Overdue",
    PAID: "Paid",
    DUE: "Due",
} as const;

/** Import batch runs many writes + per-customer status updates; default 5s Prisma tx timeout is too low. */
const INVOICE_IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;

export type RefreshInsuranceFieldsOptions = {
    /** When true, skip syncCustomerInsuranceFields (caller batches customer sync). */
    skipCustomerInsuranceSync?: boolean;
    dbClient?: DbClient;
    runFollowUpEffects?: boolean;
};

export class InvoiceService {
    private prisma: ExtendedPrismaClient;
    private paymentService: PaymentService;
    private logService: LogService;

    constructor(prismaClient?: ExtendedPrismaClient) {
        this.prisma = prismaClient ?? prisma;
        this.paymentService = new PaymentService();
        this.logService = LogService.getInstance();
    }

    private generateUniqueReference(prefix: string): string {
        const timestamp = new Date().getTime();
        const randomString = uuidv4().slice(0, 8);
        return `${prefix}-${timestamp}-${randomString}`;
    }

    private customerPolicyScopeKey(
        customerId: number,
        policyId: number
    ): string {
        return `${customerId}:${policyId}`;
    }

    private isOpenInvoiceStatus(status: invoice_status | string): boolean {
        return status === invoice_status.Due || status === invoice_status.Overdue;
    }

    /**
     * Calculate total_paid using the original invoice amount and customer_amount ratio
     * Since customer_total_paid is always provided in imports, we calculate total_paid from it
     * Handles both positive and negative amounts
     */
    private calculateTotalPaidFromRatio(
        originalAmount: number,
        originalCustomerAmount: number,
        customerTotalPaid: number
    ): number {
        // Handle cases where either amount is 0 or both are 0
        if (originalAmount === 0 && originalCustomerAmount === 0) {
            // If both amounts are 0, return 0 for total_paid
            return 0;
        }

        // Handle cases where one amount is 0 but the other isn't
        if (originalAmount === 0 || originalCustomerAmount === 0) {
            // If one amount is 0, we can't calculate a ratio, so return 0
            return 0;
        }

        // Calculate ratio and apply it to customer_total_paid
        // This works for both positive and negative amounts
        const ratio = originalAmount / originalCustomerAmount;
        const calculatedTotalPaid = customerTotalPaid * ratio;

        return calculatedTotalPaid;
    }

    /**
     * When an invoice already exists, import may only change payment totals.
     * Invoice amounts, dates, and insurance metadata stay as stored in the DB.
     */
    private buildExistingInvoicePaymentOnlyUpdate(
        currentInvoice: {
            amount: number | null;
            customer_amount: number | null;
            customer_total_paid: number | null;
        },
        importedCustomerTotalPaid: number
    ): ExistingInvoicePaymentUpdate {
        return {
            total_paid: this.calculateTotalPaidFromRatio(
                currentInvoice.amount ?? 0,
                currentInvoice.customer_amount ?? 0,
                importedCustomerTotalPaid
            ),
            customer_total_paid: importedCustomerTotalPaid,
        };
    }

    convertInvoiceCurrencies(invoice: InvoiceInput): InvoiceInput {
        // Since customer_total_paid is always provided, we only need to calculate total_paid
        // Note: For existing invoices, we'll calculate total_paid using database values later
        if (!invoice.customer_total_paid) {
            return invoice;
        }

        // For new invoices, calculate total_paid from import values
        // For existing invoices, this will be recalculated using database values
        if (invoice.amount && invoice.customer_amount) {
            return {
                ...invoice,
                total_paid: this.calculateTotalPaidFromRatio(
                    invoice.amount,
                    invoice.customer_amount,
                    invoice.customer_total_paid
                ),
            };
        }

        // If amount or customer_amount is missing/zero, return as-is
        // The total_paid will be calculated later using database values for existing invoices
        return invoice;
    }

    /**
     * For imported invoices, persist the customer's oldest overdue due_date onto the
     * invoice rows touched by the import (created or updated).
     */
    private async syncOldestOverdueDateOnImportedInvoices(
        affectedInvoices: Array<{ id: number; customer_id: number | null }>,
        dbClient: DbClient = prisma
    ): Promise<void> {
        if (affectedInvoices.length === 0) {
            return;
        }

        const customerIds = Array.from(
            new Set(
                affectedInvoices
                    .map((inv) => inv.customer_id)
                    .filter(
                        (id): id is number => id !== null && id !== undefined
                    )
            )
        );

        if (customerIds.length === 0) {
            return;
        }

        const oldestOverdueByCustomer = await dbClient.invoice.groupBy({
            by: ["customer_id"],
            where: {
                customer_id: { in: customerIds },
                status: INVOICE_STATUS.OVERDUE,
                due_date: { not: null },
            },
            _min: {
                due_date: true,
            },
        });

        const oldestByCustomerId = new Map<number, Date | null>();
        customerIds.forEach((customerId) => {
            oldestByCustomerId.set(customerId, null);
        });
        oldestOverdueByCustomer.forEach((row) => {
            if (row.customer_id !== null) {
                oldestByCustomerId.set(
                    row.customer_id,
                    row._min.due_date ?? null
                );
            }
        });

        const updateGroups = new Map<string, { ids: number[]; value: Date | null }>();
        affectedInvoices.forEach((inv) => {
            if (!inv.customer_id) {
                return;
            }
            const oldestOverdueDate =
                oldestByCustomerId.get(inv.customer_id) ?? null;
            const groupKey = oldestOverdueDate
                ? oldestOverdueDate.toISOString()
                : "null";
            if (!updateGroups.has(groupKey)) {
                updateGroups.set(groupKey, { ids: [], value: oldestOverdueDate });
            }
            updateGroups.get(groupKey)!.ids.push(inv.id);
        });

        await Promise.all(
            Array.from(updateGroups.values()).map(({ ids, value }) =>
                dbClient.invoice.updateMany({
                    where: { id: { in: ids } },
                    data: {
                        oldest_overdue_invoice_date: value,
                    } as any,
                })
            )
        );
    }

    static updateTotalPaid(
        _tx: any,
        _id: number,
        _applyAmount: number
    ) {
        throw new Error("Method not implemented.");
    }

    static async getInvoicesByInvoiceNumber(
        invoiceNumbers: string[],
        accountId: number,
        customerNumbers: string[]
    ): Promise<
        Map<string, { id: number; status: string; customer_id: number }>
    > {
        const invoices = await prisma.invoice.findMany({
            where: {
                account_id: accountId,
                invoice_number: { in: Array.from(invoiceNumbers) },
            },
            select: {
                id: true,
                invoice_number: true,
                status: true,
                customer_id: true,
            },
        });

        const invoiceMap = new Map<
            string,
            { id: number; status: string; customer_id: number }
        >();
        for (const inv of invoices) {
            if (inv.invoice_number && inv.customer_id != null) {
                invoiceMap.set(inv.invoice_number, {
                    id: inv.id,
                    status: inv.status as string,
                    customer_id: inv.customer_id,
                });
            }
        }

        return invoiceMap;
    }

    static async findInvoiceByInvoiceNumber(
        invoiceNumber: string,
        accountId: number
    ): Promise<{ id: number; status: string } | null> {
        const invoice = await prisma.invoice.findFirst({
            where: {
                invoice_number: invoiceNumber,
                account_id: accountId,
            },
            select: {
                id: true,
                status: true,
            },
        });

        return invoice;
    }

    public async getInvoiceById(
        id: number
    ): Promise<{ id: number; status: string } | null> {
        return await this.prisma.invoice.findUnique({
            where: { id },
            select: {
                id: true,
                status: true,
            },
        });
    }

    /**
     * Create multiple invoices and run post-insert logic on each
     */
    async createMany(invoices: InvoiceInput[]) {
        // Handle empty array case
        if (invoices.length === 0) {
            return {
                results: [],
                affectedCustomerIds: [],
            };
        }

        // Initialize comprehensive logging data
        const logData = {
            invoiceCount: invoices.length,
            accountId: invoices[0].account_id,
            startTime: new Date(),
            paidInvoices: [] as Array<{
                invoiceId: number;
                invoiceNumber: string;
                customerId: number;
                outstandingDebt: number;
            }>,
            createdPayments: [] as Array<{
                invoiceId: number;
                invoiceNumber: string;
                paymentAmount: number;
                paymentMethod: string;
            }>,
            affectedCustomerIds: [] as number[],
            errors: [] as string[],
        };

        // Initialize results array with all records marked as pending
        const results: Array<{
            index: number;
            success: boolean;
            message?: string;
            invoiceId?: number;
            originalInvoiceNumber?: string;
        }> = [];
        for (let i = 0; i < invoices.length; i++) {
            results[i] = { index: i, success: false, message: "Processing..." };
        }

        // Process without transaction
        try {
            // Pre-fetch all required data in bulk
            const invoiceNumbers = invoices
                .map((i) => i.invoice_number)
                .filter(Boolean) as string[];
            const customerNumbers = invoices.map((i) => i.customer_number);

            const [existing_invoice_map, customerByCustomerNumber] =
                await Promise.all([
                    InvoiceService.getInvoicesByInvoiceNumber(
                        invoiceNumbers,
                        invoices[0].account_id,
                        customerNumbers
                    ),
                    CustomerService.findCustomersByCustomerNumber(
                        customerNumbers,
                        invoices[0].account_id
                    ),
                ]);

            const customerIdList = Array.from(
                new Set(Array.from(customerByCustomerNumber.values()))
            );
            const { loadEffectiveInsuranceForCustomers } = await import(
                "@/server/services/creditInsurance/loadEffectiveInsuranceForCustomers"
            );
            const insuranceByCustomerId =
                await loadEffectiveInsuranceForCustomers(customerIdList);
            const policyIdList = Array.from(
                new Set(
                    Array.from(insuranceByCustomerId.values())
                        .map((c) => c.policy_id)
                        .filter((id): id is number => id != null)
                )
            );
            const insurancePolicies =
                policyIdList.length > 0
                    ? await prisma.insurancePolicy.findMany({
                        where: { id: { in: policyIdList } },
                        select: {
                            id: true,
                            end_date: true,
                            score_validity_period_months: true,
                            min_credit_score: true,
                            dcl_customer_since_months: true,
                        },
                    })
                    : [];
            const insurancePolicyById = new Map(
                insurancePolicies.map((p) => [p.id, p])
            );

            const account = await prisma.account.findUnique({
                where: { id: invoices[0].account_id },
                select: {
                    balance_evaluation_method: true,
                    currency: true,
                } as any,
            });
            const accountCurrency =
                (account as { currency?: string | null } | null)?.currency ??
                null;

            const limitCurrencyByPolicyId = new Map(
                Array.from(insuranceByCustomerId.values())
                    .filter((c) => c.policy_id != null)
                    .map((c) => [
                        c.policy_id!,
                        c.approved_limit_currency ?? null,
                    ])
            );
            const openArInvoiceRows = await prisma.invoice.findMany({
                where: {
                    account_id: invoices[0].account_id,
                    customer_id: { in: customerIdList },
                    policy_id: { not: null },
                    status: { in: [invoice_status.Due, invoice_status.Overdue] },
                },
                select: {
                    customer_id: true,
                    policy_id: true,
                    outstanding_debt: true,
                    customer_outstanding_debt: true,
                    customer_currency: true,
                    amount: true,
                },
            });
            const openArByCustomerPolicy = sumOpenArByCustomerPolicyInLimitCurrency(
                openArInvoiceRows.filter(
                    (
                        r
                    ): r is typeof r & {
                        customer_id: number;
                        policy_id: number;
                    } => r.customer_id != null && r.policy_id != null
                ),
                limitCurrencyByPolicyId,
                accountCurrency
            );

            // Get account details for payment generation

            // Customer details logged only if needed for debugging

            // Separate invoices into new and existing
            const newInvoices: Invoicecreated_ata[] = [];
            const updateOperations: InvoiceUpdateOperation[] = [];
            const existingInvoiceIds = new Set<number>();
            const originalInvoiceValues = new Map<
                number,
                { total_paid: number; customer_total_paid: number }
            >();
            const pendingLimitStamps: {
                invoiceData: Invoicecreated_ata;
                customerId: number;
                icBase: {
                    policy_id: number | null;
                    approved_limit: import("@prisma/client").Prisma.Decimal | null;
                    approved_limit_currency: string | null;
                };
                stampAsOfDate: Date;
            }[] = [];
            const insuranceSyncInvoiceIdsByCustomer = new Map<
                number,
                number[]
            >();

            // Store affected customer IDs for logging
            logData.affectedCustomerIds = Array.from(
                customerByCustomerNumber.values()
            );

            let _processedCount = 0;
            let _customerNotFoundCount = 0;

            for (let i = 0; i < invoices.length; i++) {
                const invoice = this.convertInvoiceCurrencies(invoices[i]);

                const customerId = customerByCustomerNumber.get(
                    invoice.customer_number
                );

                if (customerId === undefined) {
                    _customerNotFoundCount++;
                    results[i] = {
                        index: i,
                        success: false,
                        message: "import.results.customerNotFound",
                        originalInvoiceNumber: invoice.invoice_number,
                    };
                    continue;
                }

                _processedCount++;

                // Use regular status logic for all invoices (including credit invoices)
                const importStatus =
                    (invoice.status as invoice_status) || INVOICE_STATUS.DUE;

                // For import: net_amount should be initialized with amount (system currency)
                // customer_net_amount should be initialized with customer_amount (customer currency)
                // Ensure amounts are numbers (convert from strings if needed)
                const amount =
                    typeof invoice.amount === "string"
                        ? parseFloat(invoice.amount)
                        : (invoice.amount ?? 0);
                const customerAmount =
                    invoice.customer_amount !== null &&
                        invoice.customer_amount !== undefined
                        ? typeof invoice.customer_amount === "string"
                            ? parseFloat(invoice.customer_amount)
                            : invoice.customer_amount
                        : null;
                const totalPaid =
                    typeof invoice.total_paid === "string"
                        ? parseFloat(invoice.total_paid)
                        : (invoice.total_paid ?? 0);
                const customerTotalPaid =
                    typeof invoice.customer_total_paid === "string"
                        ? parseFloat(invoice.customer_total_paid)
                        : (invoice.customer_total_paid ?? 0);

                const invoiceDateParsed = parseImportDateToLocalCalendarDate(
                    invoice.invoice_date
                );
                const dueDateParsed = parseImportDateToLocalCalendarDate(
                    invoice.due_date
                );

                const isExistingInvoice =
                    Boolean(invoice.invoice_number) &&
                    existing_invoice_map.has(invoice.invoice_number);

                if (isExistingInvoice) {
                    const existingRow = existing_invoice_map.get(
                        invoice.invoice_number
                    )!;
                    if (existingRow.customer_id !== customerId) {
                        results[i] = {
                            index: i,
                            success: false,
                            message:
                                "import.results.processingFailed: Invoice number already assigned to another customer",
                            originalInvoiceNumber: invoice.invoice_number,
                        };
                        continue;
                    }
                }

                const effectiveStatus: invoice_status = isExistingInvoice
                    ? (existing_invoice_map.get(invoice.invoice_number)!
                          .status as invoice_status)
                    : importStatus;
                const actualReportingDateParsed =
                    parseImportDateToLocalCalendarDate(
                        invoice.actual_reporting_date
                    );

                const invoiceData: Invoicecreated_ata = {
                    account_id: invoice.account_id,
                    customer_id: customerId,
                    status: effectiveStatus,
                    invoice_date:
                        invoiceDateParsed ??
                        new Date(String(invoice.invoice_date)),
                    due_date: dueDateParsed,
                    amount: amount, // Ensure amount is never NULL and is a number
                    net_amount: amount, // Initialize with amount (system currency)
                    customer_amount: customerAmount,
                    customer_net_amount: customerAmount ?? 0, // Initialize with customer_amount (customer currency)
                    total_paid: totalPaid,
                    customer_total_paid: customerTotalPaid,
                    customer_currency: invoice.customer_currency ?? null,
                    invoice_number:
                        invoice.invoice_number ?? `AUTO-${Date.now()}-${i}`,
                    outstanding_debt: amount - totalPaid,
                    customer_outstanding_debt:
                        (customerAmount ?? 0) - customerTotalPaid, // Will be recalculated using calculateCustomerOutstandingDebt method
                    credit_for_invoice_number:
                        invoice.credit_for_invoice_number,
                };

                const icBase =
                    insuranceByCustomerId.get(customerId) ?? {
                        reporting_days: null,
                        max_allowed_mep: null,
                        max_payment_term: null,
                        mep_cutoff_day_of_month: null,
                        mep_substitute_day_of_month: null,
                        reporting_cutoff_day_of_month: null,
                        reporting_substitute_day_of_month: null,
                        overdue_block: false,
                        excluded_from_policy: false,
                        credit_score_input_date: null,
                        policy_id: null,
                        limit_type: null,
                        approved_limit: null,
                        approved_limit_currency: null,
                        credit_score: null,
                        active_customer_since: null,
                    };
                const insuranceEvaluationDate =
                    parseImportDateToLocalCalendarDate(
                        invoiceDateParsed ?? invoiceData.invoice_date
                    ) ??
                    invoiceDateParsed ??
                    invoiceData.invoice_date;
                const insRow = computeInvoiceInsuranceRowData({
                    status: effectiveStatus,
                    invoice_date: invoiceDateParsed ?? invoiceData.invoice_date,
                    due_date: dueDateParsed,
                    actual_reporting_date: actualReportingDateParsed,
                    customer: icBase,
                    today: insuranceEvaluationDate,
                });
                const policyForCustomer =
                    icBase.policy_id != null
                        ? insurancePolicyById.get(icBase.policy_id) ?? null
                        : null;
                const termsSnapshot = computeCreatedTermsViolationSnapshot({
                    invoice_date: invoiceDateParsed ?? invoiceData.invoice_date,
                    customer: icBase,
                    policy: policyForCustomer,
                });
                Object.assign(invoiceData, {
                    payment_term: insRow.payment_term,
                    // Credit insurance: due_date + Customer.reporting_days / max_allowed_mep (calculated)
                    target_reporting_date: insRow.target_reporting_date,
                    target_mep_date: insRow.target_mep_date,
                    ...(actualReportingDateParsed
                        ? { actual_reporting_date: actualReportingDateParsed }
                        : {}),
                    reporting_breach: insRow.reporting_breach,
                    ctv_payment_term:
                        insRow.ctv_payment_term,
                    policy_id: icBase.policy_id,
                    ...termsSnapshot,
                });

                if (
                    !isExistingInvoice &&
                    icBase.policy_id != null &&
                    this.isOpenInvoiceStatus(effectiveStatus)
                ) {
                    pendingLimitStamps.push({
                        invoiceData,
                        customerId,
                        icBase,
                        stampAsOfDate:
                            invoiceDateParsed ?? invoiceData.invoice_date,
                    });
                }

                if (isExistingInvoice) {
                    const existingInvoiceId = existing_invoice_map.get(
                        invoice.invoice_number
                    )!.id;
                    existingInvoiceIds.add(existingInvoiceId);

                    const currentInvoice = await prisma.invoice.findUnique({
                        where: { id: existingInvoiceId },
                        select: {
                            id: true,
                            total_paid: true,
                            customer_total_paid: true,
                            amount: true,
                            customer_amount: true,
                            customer_net_amount: true,
                            policy_id: true,
                        },
                    });

                    if (currentInvoice) {
                        originalInvoiceValues.set(existingInvoiceId, {
                            total_paid: currentInvoice.total_paid || 0,
                            customer_total_paid:
                                currentInvoice.customer_total_paid || 0,
                        });

                        if (
                            invoice.customer_total_paid !== undefined &&
                            invoice.customer_total_paid !== null
                        ) {
                            const paymentUpdate =
                                this.buildExistingInvoicePaymentOnlyUpdate(
                                    currentInvoice,
                                    customerTotalPaid
                                );
                            updateOperations.push({
                                where: { id: existingInvoiceId },
                                data: paymentUpdate,
                            });
                            const paymentSyncIds =
                                insuranceSyncInvoiceIdsByCustomer.get(
                                    customerId
                                ) ?? [];
                            paymentSyncIds.push(existingInvoiceId);
                            insuranceSyncInvoiceIdsByCustomer.set(
                                customerId,
                                paymentSyncIds
                            );

                            const policyIdForAr =
                                currentInvoice.policy_id ?? icBase.policy_id;
                            if (policyIdForAr != null) {
                                const limitCurrency =
                                    icBase.approved_limit_currency ?? null;
                                const oldOutstanding = Math.max(
                                    0,
                                    invoiceOutstandingInLimitCurrency({
                                        outstanding_debt:
                                            this.calculateOutstandingDebt(
                                                currentInvoice
                                            ),
                                        customer_outstanding_debt:
                                            this.calculateCustomerOutstandingDebt(
                                                currentInvoice
                                            ),
                                        amount: currentInvoice.amount,
                                        customer_currency:
                                            invoice.customer_currency ?? null,
                                        limit_assessed_currency: limitCurrency,
                                        accountCurrency,
                                    })
                                );
                                const newOutstanding = Math.max(
                                    0,
                                    invoiceOutstandingInLimitCurrency({
                                        outstanding_debt:
                                            this.calculateOutstandingDebt({
                                                ...currentInvoice,
                                                total_paid:
                                                    paymentUpdate.total_paid,
                                            }),
                                        customer_outstanding_debt:
                                            this.calculateCustomerOutstandingDebt(
                                                {
                                                    ...currentInvoice,
                                                    customer_total_paid:
                                                        paymentUpdate.customer_total_paid,
                                                    total_paid:
                                                        paymentUpdate.total_paid,
                                                }
                                            ),
                                        amount: currentInvoice.amount,
                                        customer_currency:
                                            invoice.customer_currency ?? null,
                                        limit_assessed_currency: limitCurrency,
                                        accountCurrency,
                                    })
                                );
                                const scopeKey = this.customerPolicyScopeKey(
                                    customerId,
                                    policyIdForAr
                                );
                                const mapVal =
                                    openArByCustomerPolicy.get(scopeKey) ?? 0;
                                openArByCustomerPolicy.set(
                                    scopeKey,
                                    mapVal - oldOutstanding + newOutstanding
                                );
                            }
                        }
                    }
                } else if (
                    icBase.policy_id == null ||
                    !this.isOpenInvoiceStatus(effectiveStatus)
                ) {
                    newInvoices.push(invoiceData);
                }
            }

            for (const pending of pendingLimitStamps) {
                const { invoiceData, customerId, icBase, stampAsOfDate } =
                    pending;
                const scopeKey = this.customerPolicyScopeKey(
                    customerId,
                    icBase.policy_id!
                );
                const currentOpenAr =
                    openArByCustomerPolicy.get(scopeKey) ?? 0;
                const approvedLimit =
                    icBase.approved_limit == null
                        ? null
                        : Number(icBase.approved_limit);
                let topUpTotal = 0;
                const { resolveEffectiveApprovedLimit } = await import(
                    "@/server/services/creditInsurance/resolveEffectiveApprovedLimit"
                );
                const resolved = await resolveEffectiveApprovedLimit(
                    customerId,
                    {
                        baseApprovedLimit: icBase.approved_limit,
                        baseApprovedLimitCurrency:
                            icBase.approved_limit_currency,
                        parentPrimaryPolicyId: icBase.policy_id!,
                        asOfDate: stampAsOfDate,
                    }
                );
                topUpTotal = resolved.topUpTotalInLimitCurrency;
                const newOutstanding = Math.max(
                    0,
                    invoiceOutstandingInLimitCurrency({
                        outstanding_debt: invoiceData.outstanding_debt,
                        customer_outstanding_debt:
                            invoiceData.customer_outstanding_debt,
                        amount: invoiceData.amount,
                        customer_currency: invoiceData.customer_currency,
                        limit_assessed_currency:
                            icBase.approved_limit_currency ?? null,
                        accountCurrency,
                    })
                );
                const limitAssessedAmount =
                    computeLimitAssessedAmountForNewOpenInvoice({
                        approvedLimit,
                        topUpTotal,
                        openArOnPolicyBeforeInvoice: currentOpenAr,
                        newInvoiceOutstanding: newOutstanding,
                    });
                Object.assign(invoiceData, {
                    limit_assessed_amount: new Prisma.Decimal(
                        limitAssessedAmount
                    ),
                    limit_assessed_at: new Date(),
                    limit_assessed_currency:
                        icBase.approved_limit_currency ?? null,
                } as any);
                openArByCustomerPolicy.set(
                    scopeKey,
                    currentOpenAr + newOutstanding
                );
                newInvoices.push(invoiceData);
            }

            const expectedNewInvoiceCount = newInvoices.length;
            const txResult = await prisma.$transaction(
                async (tx) => {
                    let createdNewInvoiceCount = 0;
                    // Create new invoices in bulk
                    if (newInvoices.length > 0) {
                        const createResult = await tx.invoice.createMany({
                            data: newInvoices,
                            skipDuplicates: true,
                        });
                        createdNewInvoiceCount = createResult.count;
                    }

                    // Group updates by data structure to minimize database calls
                    if (updateOperations.length > 0) {
                        const updateGroups = new Map<
                            string,
                            { data: any; ids: number[] }
                        >();
                        updateOperations.forEach((op) => {
                            const dataKey = JSON.stringify(op.data);
                            if (!updateGroups.has(dataKey)) {
                                updateGroups.set(dataKey, {
                                    data: op.data,
                                    ids: [],
                                });
                            }
                            updateGroups.get(dataKey)!.ids.push(op.where.id);
                        });

                        await Promise.all(
                            Array.from(updateGroups.values()).map(
                                async ({ data, ids }) => {
                                    if (ids.length === 1) {
                                        return tx.invoice.update({
                                            where: { id: ids[0] },
                                            data,
                                        });
                                    }

                                    return tx.invoice.updateMany({
                                        where: { id: { in: ids } },
                                        data,
                                    });
                                }
                            )
                        );
                    }

                    const affectedInvoicesWhere = {
                        account_id: invoices[0].account_id,
                        invoice_number: { in: invoiceNumbers },
                        OR: [
                            { invoice_number: { in: invoiceNumbers } },
                            {
                                id: {
                                    in: updateOperations.map((op) => op.where.id),
                                },
                            },
                        ],
                    };

                    let affectedInvoices = await tx.invoice.findMany({
                        where: affectedInvoicesWhere,
                    });

                    const outstandingDebtGroups = new Map<
                        string,
                        {
                            data: any;
                            ids: number[];
                            paidInvoices: typeof logData.paidInvoices;
                        }
                    >();

                    affectedInvoices.forEach((invoice) => {
                        const outstandingDebt =
                            this.calculateOutstandingDebt(invoice);
                        const customerOutstandingDebt =
                            this.calculateCustomerOutstandingDebt(invoice);
                        const isCreditInvoice = this.isCreditInvoice(invoice);
                        const shouldMarkAsPaid =
                            !isCreditInvoice &&
                            customerOutstandingDebt === 0;

                        const modified_ata = {
                            outstanding_debt: outstandingDebt,
                            customer_outstanding_debt: customerOutstandingDebt,
                            ...(shouldMarkAsPaid && {
                                status: INVOICE_STATUS.PAID,
                                zero_limit_alert: false,
                            }),
                        };

                        const dataKey = JSON.stringify(modified_ata);
                        if (!outstandingDebtGroups.has(dataKey)) {
                            outstandingDebtGroups.set(dataKey, {
                                data: modified_ata,
                                ids: [],
                                paidInvoices: [],
                            });
                        }

                        const group = outstandingDebtGroups.get(dataKey)!;
                        group.ids.push(invoice.id);

                        if (shouldMarkAsPaid && invoice.customer_id != null) {
                            group.paidInvoices.push({
                                invoiceId: invoice.id,
                                invoiceNumber: invoice.invoice_number || "",
                                customerId: invoice.customer_id,
                                outstandingDebt: customerOutstandingDebt,
                            });
                        }
                    });

                    for (const group of Array.from(outstandingDebtGroups.values())) {
                        logData.paidInvoices.push(...group.paidInvoices);
                    }

                    await Promise.all(
                        Array.from(outstandingDebtGroups.values()).map(
                            async ({ data, ids }) => {
                                if (ids.length === 1) {
                                    return tx.invoice.update({
                                        where: { id: ids[0] },
                                        data,
                                    });
                                }

                                return tx.invoice.updateMany({
                                    where: { id: { in: ids } },
                                    data,
                                });
                            }
                        )
                    );

                    affectedInvoices = await tx.invoice.findMany({
                        where: affectedInvoicesWhere,
                    });

                    if (
                        (account as any)?.balance_evaluation_method ===
                        "Invoice-Based"
                    ) {
                        for (const invoice of affectedInvoices) {
                            if (!this.shouldGeneratePayment(invoice)) {
                                continue;
                            }

                            if (
                                !existing_invoice_map.has(
                                    invoice.invoice_number || ""
                                )
                            ) {
                                if (
                                    invoice.customer_total_paid &&
                                    invoice.customer_total_paid !== 0
                                ) {
                                    await tx.invoicePayment.create({
                                        data: {
                                            invoice_id: invoice.id,
                                            amount: invoice.total_paid || 0,
                                            payment_date: new Date(),
                                            payment_method:
                                                (invoice.customer_total_paid ||
                                                    0) > 0
                                                    ? "Import"
                                                    : "Refund",
                                            reference:
                                                this.generateUniqueReference(
                                                    `INV-${invoice.invoice_number}`
                                                ),
                                            customer_id:
                                                invoice.customer_id ?? 0,
                                            account_id: invoice.account_id,
                                            customer_currency:
                                                resolveCustomerFirstCurrency({
                                                    customerCurrencyPrimary:
                                                        invoice.customer_currency,
                                                }),
                                            customer_amount:
                                                invoice.customer_total_paid || 0,
                                        },
                                    });

                                    logData.createdPayments.push({
                                        invoiceId: invoice.id,
                                        invoiceNumber:
                                            invoice.invoice_number || "",
                                        paymentAmount:
                                            invoice.customer_total_paid || 0,
                                        paymentMethod:
                                            (invoice.customer_total_paid || 0) >
                                            0
                                                ? "Import"
                                                : "Refund",
                                    });
                                }
                                continue;
                            }

                            const originalValues = originalInvoiceValues.get(
                                invoice.id
                            );
                            if (
                                !originalValues ||
                                invoice.customer_total_paid === undefined ||
                                invoice.customer_total_paid === null ||
                                invoice.customer_total_paid ===
                                    originalValues.customer_total_paid
                            ) {
                                continue;
                            }

                            const currentInvoice = await tx.invoice.findUnique({
                                where: { id: invoice.id },
                                select: {
                                    amount: true,
                                    customer_amount: true,
                                },
                            });

                            const calculatedTotalPaid = currentInvoice
                                ? this.calculateTotalPaidFromRatio(
                                      currentInvoice.amount || 0,
                                      currentInvoice.customer_amount || 0,
                                      invoice.customer_total_paid
                                  )
                                : 0;

                            const paymentDifference =
                                calculatedTotalPaid - originalValues.total_paid;
                            const customerPaymentDifference =
                                (invoice.customer_total_paid || 0) -
                                originalValues.customer_total_paid;

                            await tx.invoicePayment.create({
                                data: {
                                    invoice_id: invoice.id,
                                    amount: paymentDifference,
                                    payment_date: new Date(),
                                    payment_method:
                                        customerPaymentDifference > 0
                                            ? "Import"
                                            : "Refund",
                                    reference: this.generateUniqueReference(
                                        `INV-${invoice.invoice_number}`
                                    ),
                                    customer_id: invoice.customer_id as number,
                                    account_id: invoice.account_id,
                                    customer_currency:
                                        invoice.customer_currency || "USD",
                                    customer_amount: customerPaymentDifference,
                                },
                            });

                            logData.createdPayments.push({
                                invoiceId: invoice.id,
                                invoiceNumber: invoice.invoice_number || "",
                                paymentAmount: customerPaymentDifference,
                                paymentMethod:
                                    customerPaymentDifference > 0
                                        ? "Import"
                                        : "Refund",
                            });
                        }
                    }

                    const representativeInvoices = new Map<number, Invoice>();
                    affectedInvoices.forEach((invoice) => {
                        if (
                            invoice.customer_id &&
                            !representativeInvoices.has(invoice.customer_id)
                        ) {
                            representativeInvoices.set(
                                invoice.customer_id,
                                invoice as Invoice
                            );
                        }
                    });

                    const oldestOverduePayload = affectedInvoices.map(
                        (inv) => ({
                            id: inv.id,
                            customer_id: inv.customer_id,
                        })
                    );
                    const sweepInvoiceIds = affectedInvoices.map(
                        (inv) => inv.id
                    );

                    for (let i = 0; i < invoices.length; i++) {
                        const invoice = invoices[i];

                        if (
                            results[i] &&
                            results[i].message !== "Processing..."
                        ) {
                            continue;
                        }

                        const createdInvoice = affectedInvoices.find(
                            (inv) => inv.invoice_number === invoice.invoice_number
                        );
                        const expectedCustomerId =
                            customerByCustomerNumber.get(
                                invoice.customer_number
                            );

                        if (
                            createdInvoice &&
                            expectedCustomerId !== undefined &&
                            createdInvoice.customer_id !== expectedCustomerId
                        ) {
                            results[i] = {
                                index: i,
                                success: false,
                                message:
                                    "import.results.processingFailed: Invoice number already assigned to another customer",
                                originalInvoiceNumber:
                                    invoice.invoice_number,
                            };
                        } else if (createdInvoice) {
                            results[i] = {
                                index: i,
                                success: true,
                                message: "import.results.importedSuccessfully",
                                invoiceId: createdInvoice.id,
                                originalInvoiceNumber:
                                    invoice.invoice_number,
                            };
                        } else {
                            results[i] = {
                                index: i,
                                success: false,
                                message: "import.results.processingFailed",
                                originalInvoiceNumber:
                                    invoice.invoice_number,
                            };
                        }
                    }

                    const affectedCustomerIds = Array.from(
                        new Set(
                            affectedInvoices
                                .map((invoice) => invoice.customer_id)
                                .filter(
                                    (id): id is number =>
                                        id !== null && id !== undefined
                                )
                        )
                    ) as number[];

                    return {
                        affectedInvoices,
                        affectedCustomerIds,
                        representativeInvoices: Array.from(
                            representativeInvoices.values()
                        ),
                        sweepInvoiceIds,
                        oldestOverduePayload,
                        createdNewInvoiceCount,
                    };
                },
                {
                    timeout: INVOICE_IMPORT_TRANSACTION_TIMEOUT_MS,
                    maxWait: 10_000,
                }
            );

            const {
                affectedInvoices,
                affectedCustomerIds,
                representativeInvoices,
                sweepInvoiceIds,
                oldestOverduePayload,
                createdNewInvoiceCount,
            } = txResult;

            const newInvoiceIdsByCustomer = new Map<number, number[]>();
            for (const inv of affectedInvoices) {
                if (
                    inv.customer_id == null ||
                    existingInvoiceIds.has(inv.id)
                ) {
                    continue;
                }
                const ids = newInvoiceIdsByCustomer.get(inv.customer_id) ?? [];
                ids.push(inv.id);
                newInvoiceIdsByCustomer.set(inv.customer_id, ids);
            }

            if (
                expectedNewInvoiceCount > 0 &&
                createdNewInvoiceCount < expectedNewInvoiceCount
            ) {
                await this.logService.logMessage(
                    LogLevel.WARNING,
                    `Invoice import created ${createdNewInvoiceCount}/${expectedNewInvoiceCount} new rows (skipDuplicates or DB conflict)`,
                    "InvoiceService.createMany",
                    {
                        expectedNewInvoiceCount,
                        createdNewInvoiceCount,
                        accountId: invoices[0].account_id,
                    },
                    invoices[0].account_id
                );
            }

            for (const representativeInvoice of representativeInvoices) {
                try {
                    await this.handleInvoiceChange(representativeInvoice, {
                        runPostCommitEffects: false,
                        skipInsuranceRecompute: true,
                    });
                } catch (error) {
                    console.error(
                        `[InvoiceService.createMany] Post-commit handleInvoiceChange failed for invoice ${representativeInvoice.id}:`,
                        error
                    );
                }
            }

            if (affectedCustomerIds.length > 0) {
                try {
                    await CustomerService.recalculateAllAmountsForCustomers(
                        affectedCustomerIds,
                        undefined,
                        { runPostCommitEffects: false }
                    );
                } catch (error) {
                    console.error(
                        "[InvoiceService.createMany] Post-commit customer amount recalculation failed:",
                        error
                    );
                }
            }

            try {
                await sweepReportingBreachForOverdueInvoiceIds(sweepInvoiceIds);
            } catch (error) {
                console.error(
                    "[InvoiceService.createMany] Post-commit reporting breach sweep failed:",
                    error
                );
            }

            try {
                await this.syncOldestOverdueDateOnImportedInvoices(
                    oldestOverduePayload
                );
            } catch (error) {
                console.error(
                    "[InvoiceService.createMany] Post-commit oldest overdue sync failed:",
                    error
                );
            }

            const successCount = results.filter((r) => r.success).length;
            const failureCount = results.filter((r) => !r.success).length;

            // Single comprehensive log for the entire process
            const endTime = new Date();
            const duration = endTime.getTime() - logData.startTime.getTime();

            await this.logService.logMessage(
                LogLevel.INFO,
                `Invoice import process completed: ${successCount}/${invoices.length} successful, ${logData.paidInvoices.length} marked as paid, ${logData.createdPayments.length} payments created`,
                "InvoiceService.createMany",
                {
                    // Process summary
                    totalProcessed: invoices.length,
                    successfulCount: successCount,
                    failedCount: failureCount,
                    durationMs: duration,

                    // Batch operation summaries
                    paidInvoiceCount: logData.paidInvoices.length,
                    paymentCount: logData.createdPayments.length,
                    affectedCustomerCount: logData.affectedCustomerIds.length,

                    // Detailed data (for audit trail)
                    paidInvoices: logData.paidInvoices.map((inv) => ({
                        invoiceId: inv.invoiceId,
                        invoiceNumber: inv.invoiceNumber,
                        customerId: inv.customerId,
                        outstandingDebt: inv.outstandingDebt,
                    })),
                    createdPayments: logData.createdPayments.map((payment) => ({
                        invoiceId: payment.invoiceId,
                        invoiceNumber: payment.invoiceNumber,
                        paymentAmount: payment.paymentAmount,
                        paymentMethod: payment.paymentMethod,
                    })),
                    affectedCustomerIds: logData.affectedCustomerIds,

                    // Error summary
                    errorCount: logData.errors.length,
                    errors: logData.errors,

                    step: "IMPORT_COMPLETE",
                },
                invoices[0].account_id
            );

            // Invalidate dashboard cache when invoices are created/updated
            try {
                const { invalidateDashboardCacheForAccount } = await import(
                    "@/server/utils/cacheInvalidationHelper"
                );
                await invalidateDashboardCacheForAccount(
                    invoices[0].account_id
                );
            } catch (error) {
                // Cache invalidation failure should not break the invoice creation
                console.error("Failed to invalidate dashboard cache:", error);
            }

            // Recompute insurance fields for all affected customers post-commit.
            // New open invoices are limit-stamped inline during import (waterfall).
            // Re-stamp when new rows were created so limit_assessed_amount matches
            // final base-currency outstanding (dual-currency imports).
            // Gap sync is scoped to imported/changed invoice IDs so other open invoices
            // keep sticky per-invoice capacity gaps.
            for (const customerId of affectedCustomerIds) {
                try {
                    const paymentSyncIds =
                        insuranceSyncInvoiceIdsByCustomer.get(customerId) ??
                        [];
                    const newSyncIds =
                        newInvoiceIdsByCustomer.get(customerId) ?? [];
                    if (newSyncIds.length > 0) {
                        await restampCustomerOpenInvoiceLimitAssessment(
                            customerId,
                            { accountCurrency }
                        );
                    }
                    const syncInvoiceIds = Array.from(
                        new Set([...paymentSyncIds, ...newSyncIds])
                    );
                    await syncCustomerInsuranceFields(customerId, {
                        invoiceIds: syncInvoiceIds.length
                            ? syncInvoiceIds
                            : undefined,
                    });
                } catch (error) {
                    // Insurance sync failure should not break the invoice creation
                    console.error(`Failed to sync insurance fields for customer ${customerId}:`, error);
                }
            }

            return {
                results,
                affectedCustomerIds,
                hasOrphanCreditInvoices: false, // No longer tracking orphan credit invoices during import
            };
        } catch (error: any) {
            // Log process error
            const rawErrorMessage =
                error instanceof Error ? error.message : String(error);

            // Clean up error message: remove ANSI codes and extract relevant error
            let cleanErrorMessage = rawErrorMessage;

            // Remove ANSI escape codes
            const ansiEscapeRegex = new RegExp(
                `${String.fromCharCode(27)}\\[[0-9;]*[mGKH]`,
                "g"
            );
            cleanErrorMessage = cleanErrorMessage.replace(ansiEscapeRegex, "");

            // For Prisma errors, extract the actual error reason
            // Prisma errors often have format: "Invalid `prisma.model.action()` invocation:\n\n{ data: [...] }"
            // We want to extract what's wrong, not the full data dump

            // Try to find the actual error reason (usually after the invocation line and before the data dump)
            const prismaErrorMatch = cleanErrorMessage.match(
                /Invalid[^:]*:\s*([\s\S]+?)(?:\n\s*\{|\n\s*data:)/
            );
            if (prismaErrorMatch) {
                cleanErrorMessage = prismaErrorMatch[1].trim();
            } else {
                // Fallback: extract the main error message (usually after "Invalid" or before the data dump)
                const invalidMatch = cleanErrorMessage.match(
                    /Invalid[^:]*:\s*([\s\S]+?)(?:\n\s*\{|$)/
                );
                if (invalidMatch) {
                    cleanErrorMessage = invalidMatch[1].trim();
                }
            }

            // If error contains type mismatch info, extract it
            const typeMismatchMatch = cleanErrorMessage.match(
                /(\w+):\s*"([^"]+)"\s*is\s*not\s*valid/i
            );
            if (typeMismatchMatch) {
                cleanErrorMessage = `${typeMismatchMatch[1]} must be a number, received: "${typeMismatchMatch[2]}"`;
            }

            // If error still contains data dump markers, try to extract a simpler message
            if (
                cleanErrorMessage.includes("data:") ||
                cleanErrorMessage.includes("{")
            ) {
                // Try to find a more specific error message
                const specificErrorMatch = cleanErrorMessage.match(
                    /(\w+):\s*"([^"]+)"\s*(?:is|must|should)/i
                );
                if (specificErrorMatch) {
                    cleanErrorMessage = `${specificErrorMatch[1]} ${specificErrorMatch[2]}`;
                } else {
                    // If we can't extract a specific error, use a generic message
                    cleanErrorMessage = "Database error occurred during import";
                }
            }

            // Truncate if too long (keep first 200 chars)
            if (cleanErrorMessage.length > 200) {
                cleanErrorMessage = `${cleanErrorMessage.substring(0, 200)}...`;
            }

            await this.logService.logMessage(
                LogLevel.ERROR,
                `Invoice import process failed`,
                "InvoiceService.createMany",
                {
                    error: cleanErrorMessage,
                    rawError: rawErrorMessage.substring(0, 500), // Keep first 500 chars of raw error for debugging
                    stack: error instanceof Error ? error.stack : undefined,
                    invoiceCount: invoices.length,
                    accountId: invoices[0]?.account_id,
                    step: "IMPORT_ERROR",
                },
                invoices[0]?.account_id
            );

            // Mark any records that are still pending as failed with cleaned error message
            let _pendingCount = 0;
            for (let i = 0; i < invoices.length; i++) {
                if (results[i] && results[i].message === "Processing...") {
                    results[i] = {
                        index: i,
                        success: false,
                        message: `import.results.processingFailed: ${cleanErrorMessage}`,
                        originalInvoiceNumber: invoices[i].invoice_number,
                    };
                    _pendingCount++;
                }
            }

            // Return results without affected customer IDs in case of error
            return {
                results,
                affectedCustomerIds: [],
            };
        }
    }

    /**
     * Run post-insert logic in transaction
     */
    async afterInsert(invoice: Invoice) {
        if (invoice.status != null) {
            // Use centralized method to handle all invoice changes
            await this.handleInvoiceChange(invoice);
        }
    }

    /**
     * Run post-update logic in transaction
     */
    async afterUpdate(oldInvoice: Invoice, updatedInvoice: Invoice) {
        const dueChanged =
            oldInvoice.due_date?.getTime() !==
            updatedInvoice.due_date?.getTime();
        const invoiceDateChanged =
            oldInvoice.invoice_date?.getTime() !==
            updatedInvoice.invoice_date?.getTime();
        if (dueChanged || invoiceDateChanged) {
            await this._handleDueDateChange(updatedInvoice);
        }
        if (
            oldInvoice.actual_reporting_date !==
                updatedInvoice.actual_reporting_date &&
            updatedInvoice.actual_reporting_date
        ) {
            await syncInvoiceReportingBreach(updatedInvoice.id);
        }
        if (
            updatedInvoice.status !== null &&
            oldInvoice.status !== updatedInvoice.status
        ) {
            await this.handleInvoiceChange(updatedInvoice);
        }
    }

    async updateTotalPaid(
        id: number,
        amount: number,
        customerApplyAmount: number
    ) {
        const updated_invoice = await prisma.$transaction(async (tx) => {
            const nextInvoice = await tx.invoice.update({
                where: {
                    id: id,
                },
                data: {
                    total_paid: { increment: amount },
                    outstanding_debt: { decrement: amount },
                    customer_total_paid: { increment: customerApplyAmount },
                    customer_outstanding_debt: { decrement: customerApplyAmount },
                },
            });

            if (
                nextInvoice.customer_outstanding_debt === 0 &&
                !this.isCreditInvoice(nextInvoice) &&
                (nextInvoice.status === INVOICE_STATUS.OVERDUE ||
                    nextInvoice.status === INVOICE_STATUS.DUE)
            ) {
                const paidInvoice = await tx.invoice.update({
                    where: { id: nextInvoice.id },
                    data: { status: INVOICE_STATUS.PAID },
                });
                await this.handleInvoiceChange(paidInvoice, {
                    dbClient: tx as DbClient,
                    runPostCommitEffects: false,
                });
                return paidInvoice;
            }

            await this.handleInvoiceChange(nextInvoice, {
                dbClient: tx as DbClient,
                runPostCommitEffects: false,
            });
            return nextInvoice;
        });

        await this.runInvoiceChangePostCommitEffects(updated_invoice);
    }

    async updateStatus(
        tx: Prisma.TransactionClient,
        invoice_id: number,
        status: invoice_status
    ) {
        const updated_status_INV = await tx.invoice.update({
            where: {
                id: invoice_id,
            },
            data: {
                status: status,
            },
        });

        // Use centralized method to handle all invoice changes
        await this.handleInvoiceChange(updated_status_INV, {
            dbClient: tx as DbClient,
            runPostCommitEffects: false,
        });
    }

    /**
     * Calculate outstanding debt - use net_amount for system currency
     * Updated to properly handle credit invoices (negative amounts)
     */
    calculateOutstandingDebt(invoice: Partial<Invoice>): number {
        // For system currency outstanding debt, always use net_amount
        const netAmount = invoice.net_amount || 0;
        const totalPaid = invoice.total_paid || 0;
        // For credit invoices, allow negative outstanding debt
        // Don't use Math.max(0, ...) as it prevents negative outstanding debt for credit invoices
        const result = netAmount - totalPaid;

        return result;
    }

    /**
     * Calculate customer outstanding debt - always use customer_net_amount
     * Updated to properly handle credit invoices (negative amounts)
     */
    calculateCustomerOutstandingDebt(invoice: Partial<Invoice>): number {
        const customerNetAmount = invoice.customer_net_amount || 0;
        const customerTotalPaid = invoice.customer_total_paid || 0;
        // For credit invoices, allow negative outstanding debt
        // Don't use Math.max(0, ...) as it prevents negative outstanding debt for credit invoices
        const result = customerNetAmount - customerTotalPaid;

        return result;
    }

    /**
     * Validate that outstanding_debt is consistent with net_amount and total_paid
     * Returns true if consistent, false if inconsistent
     */
    validateOutstandingDebtConsistency(invoice: Partial<Invoice>): boolean {
        const expectedOutstandingDebt = this.calculateOutstandingDebt(invoice);
        const actualOutstandingDebt = invoice.outstanding_debt || 0;
        const tolerance = 0.01; // Allow for small floating point differences

        return (
            Math.abs(expectedOutstandingDebt - actualOutstandingDebt) <=
            tolerance
        );
    }

    /**
     * Validate that customer_outstanding_debt is consistent with customer_amount and customer_total_paid
     * Returns true if consistent, false if inconsistent
     */
    validateCustomerOutstandingDebtConsistency(
        invoice: Partial<Invoice>
    ): boolean {
        const expectedCustomerOutstandingDebt =
            this.calculateCustomerOutstandingDebt(invoice);
        const actualCustomerOutstandingDebt =
            invoice.customer_outstanding_debt || 0;
        const tolerance = 0.01; // Allow for small floating point differences

        return (
            Math.abs(
                expectedCustomerOutstandingDebt - actualCustomerOutstandingDebt
            ) <= tolerance
        );
    }

    /**
     * Fix outstanding_debt inconsistencies for a specific invoice
     * Returns true if fixed, false if no fix was needed
     */
    async fixOutstandingDebtConsistency(invoiceId: number): Promise<boolean> {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                id: true,
                net_amount: true,
                total_paid: true,
                outstanding_debt: true,
                customer_amount: true,
                customer_total_paid: true,
                customer_outstanding_debt: true,
            },
        });

        if (!invoice) {
            throw new Error(`Invoice ${invoiceId} not found`);
        }

        const correctOutstandingDebt = this.calculateOutstandingDebt(invoice);
        const correctCustomerOutstandingDebt =
            this.calculateCustomerOutstandingDebt(invoice);

        const needsFix =
            !this.validateOutstandingDebtConsistency(invoice) ||
            !this.validateCustomerOutstandingDebtConsistency(invoice);

        if (needsFix) {
            await this.prisma.invoice.update({
                where: { id: invoiceId },
                data: {
                    outstanding_debt: correctOutstandingDebt,
                    customer_outstanding_debt: correctCustomerOutstandingDebt,
                },
            });
            return true;
        }

        return false;
    }

    // 🔒 PRIVATE HELPERS

    async handleStatusChange(
        invoice: Invoice,
        options: {
            dbClient?: DbClient;
            runPostCommitEffects?: boolean;
        } = {}
    ) {
        if (!invoice.customer_id) return;

        await CustomerService.recalculateAllAmountsForCustomers(
            [invoice.customer_id],
            undefined,
            {
                dbClient: options.dbClient,
                runPostCommitEffects: options.runPostCommitEffects,
            }
        );
    }

    async _handleDueDateChange(invoice: Invoice) {
        await this.refreshInsuranceFieldsForInvoiceId(invoice.id);
    }

    /**
     * Recompute credit-insurance invoice fields from customer + dates; sync breach + customer metrics.
     */
    public async refreshInsuranceFieldsForInvoiceId(
        invoiceId: number,
        options?: RefreshInsuranceFieldsOptions
    ): Promise<void> {
        const dbClient = options?.dbClient ?? this.prisma;
        const runFollowUpEffects =
            options?.runFollowUpEffects ?? options?.dbClient == null;

        if (options?.dbClient && runFollowUpEffects) {
            throw new Error(
                "refreshInsuranceFieldsForInvoiceId follow-up effects require a committed client"
            );
        }

        const inv = await (dbClient.invoice.findUnique as any)({
            where: { id: invoiceId },
            select: {
                id: true,
                account_id: true,
                status: true,
                invoice_date: true,
                due_date: true,
                payment_term: true,
                customer_id: true,
                policy_id: true,
                outstanding_debt: true,
                customer_outstanding_debt: true,
                customer_currency: true,
                amount: true,
                limit_assessed_amount: true,
                Customer: { select: { id: true, overdue_block: true } },
            },
        }) as {
            id: number;
            account_id: number;
            status: invoice_status;
            invoice_date: Date;
            due_date: Date | null;
            payment_term: number | null;
            customer_id: number | null;
            policy_id: number | null;
            outstanding_debt: number | null;
            customer_outstanding_debt: number | null;
            customer_currency: string | null;
            amount: number | null;
            limit_assessed_amount: number | null;
            Customer: { id: number; overdue_block: boolean | null } | null;
        } | null;
        if (!inv?.Customer || inv.customer_id == null) {
            return;
        }
        const { loadEffectiveInsuranceForCustomers } = await import(
            "./creditInsurance/loadEffectiveInsuranceForCustomers"
        );
        const insuranceCtx = (
            await loadEffectiveInsuranceForCustomers([inv.customer_id])
        ).get(inv.customer_id);
        if (!insuranceCtx) {
            return;
        }
        const insRow = computeInvoiceInsuranceRowData({
            status: inv.status,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            customer: insuranceCtx,
            explicitPaymentTerm:
                inv.payment_term !== null && inv.payment_term !== undefined
                    ? inv.payment_term
                    : undefined,
        });

        const updateData: Record<string, unknown> = {
            payment_term: insRow.payment_term,
            target_reporting_date: insRow.target_reporting_date,
            target_mep_date: insRow.target_mep_date,
            ctv_payment_term: insRow.ctv_payment_term,
        };
        if (
            inv.policy_id != null &&
            this.isOpenInvoiceStatus(inv.status) &&
            inv.limit_assessed_amount == null
        ) {
            const account = await dbClient.account.findUnique({
                where: { id: inv.account_id },
                select: { currency: true },
            });
            const accountCurrency = account?.currency ?? null;
            const currentOpenRows = await dbClient.invoice.findMany({
                where: {
                    account_id: inv.account_id,
                    customer_id: inv.customer_id,
                    policy_id: inv.policy_id,
                    status: { in: [invoice_status.Due, invoice_status.Overdue] },
                    id: { not: inv.id },
                },
                select: {
                    customer_id: true,
                    policy_id: true,
                    outstanding_debt: true,
                    customer_outstanding_debt: true,
                    customer_currency: true,
                    amount: true,
                },
            });
            const openArBefore = sumOpenArByCustomerPolicyInLimitCurrency(
                currentOpenRows.filter(
                    (
                        r
                    ): r is typeof r & {
                        customer_id: number;
                        policy_id: number;
                    } => r.customer_id != null && r.policy_id != null
                ),
                new Map([
                    [
                        inv.policy_id,
                        insuranceCtx.approved_limit_currency ?? null,
                    ],
                ]),
                accountCurrency
            ).get(`${inv.customer_id}:${inv.policy_id}`) ?? 0;
            const approvedLimit =
                insuranceCtx.approved_limit == null
                    ? null
                    : Number(insuranceCtx.approved_limit);
            let topUpTotal = 0;
            const stampAsOfDate = inv.invoice_date ?? new Date();
            if (inv.policy_id != null) {
                const { resolveEffectiveApprovedLimit } = await import(
                    "./creditInsurance/resolveEffectiveApprovedLimit"
                );
                const resolved = await resolveEffectiveApprovedLimit(
                    inv.customer_id,
                    {
                        baseApprovedLimit: insuranceCtx.approved_limit,
                        baseApprovedLimitCurrency:
                            insuranceCtx.approved_limit_currency,
                        parentPrimaryPolicyId: inv.policy_id,
                        asOfDate: stampAsOfDate,
                        dbClient: options?.dbClient,
                    }
                );
                topUpTotal = resolved.topUpTotalInLimitCurrency;
            }
            const newOutstanding = Math.max(
                0,
                invoiceOutstandingInLimitCurrency({
                    ...inv,
                    limit_assessed_currency:
                        insuranceCtx.approved_limit_currency ?? null,
                    accountCurrency,
                })
            );
            const limitAssessedAmount =
                computeLimitAssessedAmountForNewOpenInvoice({
                    approvedLimit,
                    topUpTotal,
                    openArOnPolicyBeforeInvoice: openArBefore,
                    newInvoiceOutstanding: newOutstanding,
                });
            updateData.limit_assessed_amount = limitAssessedAmount;
            updateData.limit_assessed_at = new Date();
            updateData.limit_assessed_currency =
                insuranceCtx.approved_limit_currency ?? null;
        }

        await dbClient.invoice.update({
            where: { id: invoiceId },
            data: updateData as any,
        });
        await syncInvoiceReportingBreach(invoiceId, dbClient as any);
        if (inv.customer_id) {
            if (!options?.skipCustomerInsuranceSync) {
                await syncCustomerInsuranceFields(inv.customer_id, {
                    dbClient: options?.dbClient,
                    runFollowUpEffects,
                    invoiceIds: [invoiceId],
                });
            } else {
                await syncCreditInsuranceGapPipelineForCustomer(inv.customer_id, {
                    invoiceIds: [invoiceId],
                    dbClient: options?.dbClient,
                });
            }
        }
    }

    /* Automated Processes */
    async getAllPastDueInvoices(customerId?: number) {
        const now = new Date();

        // First, let's check what invoices exist with past due dates
        const allPastDueInvoices = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
            },
            select: {
                id: true,
                customer_id: true,
                due_date: true,
                status: true,
                customer_outstanding_debt: true,
                amount: true,
            },
            take: 10, // Limit for logging
        });

        if (allPastDueInvoices.length > 0) {
            // Sample past due invoices available for debugging
            allPastDueInvoices.forEach((_invoice, _index) => { });
        }

        // Now check invoices with status = DUE
        const dueStatusInvoices = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                status: INVOICE_STATUS.DUE,
            },
            select: {
                id: true,
                customer_id: true,
                due_date: true,
                status: true,
                customer_outstanding_debt: true,
                amount: true,
            },
            take: 10, // Limit for logging
        });

        if (dueStatusInvoices.length > 0) {
            // Sample due status invoices available for debugging
            dueStatusInvoices.forEach((_invoice, _index) => { });
        }

        // Now check invoices with non-zero outstanding debt
        const nonZeroOutstandingInvoices = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                status: INVOICE_STATUS.DUE,
                NOT: {
                    customer_outstanding_debt: 0,
                },
            },
            select: {
                id: true,
                customer_id: true,
                due_date: true,
                status: true,
                customer_outstanding_debt: true,
                amount: true,
            },
            take: 10, // Limit for logging
        });

        if (nonZeroOutstandingInvoices.length > 0) {
            // Sample non-zero outstanding invoices available for debugging
            nonZeroOutstandingInvoices.forEach((_invoice, _index) => { });
        }

        // Now run the actual query - modified to include negative invoices
        // First, let's test each condition separately to see what's happening
        const _invoicesWithNonZeroOutstanding = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                status: INVOICE_STATUS.DUE,
                customer_outstanding_debt: { not: 0 },
            },
            select: { id: true, amount: true, customer_outstanding_debt: true },
            take: 5,
        });

        const _invoicesWithNegativeAmount = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                status: INVOICE_STATUS.DUE,
                amount: { lt: 0 },
            },
            select: { id: true, amount: true, customer_outstanding_debt: true },
            take: 5,
        });

        // Now run the actual query with simplified logic
        const pastDueInvoices = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                status: INVOICE_STATUS.DUE,
                ...(customerId && { customer_id: customerId }),
                // Simplified condition - just check if either condition is met
                OR: [
                    { customer_outstanding_debt: { not: 0 } },
                    { amount: { lt: 0 } },
                ],
            },
            select: {
                id: true,
                customer_id: true,
                account_id: true,
                due_date: true,
                amount: true, // Added amount for debugging
                customer_outstanding_debt: true, // Added for debugging
                Customer: {
                    select: {
                        collection_status: true,
                        // Note: Account removed from Customer select since Customer doesn't have Account relation
                        // Fetch Account separately using customer.account_id if needed
                    },
                },
            },
            take: 1000,
            orderBy: {
                due_date: "asc",
            },
        });

        // Log details of found invoices for debugging
        if (pastDueInvoices.length > 0) {
            // Found invoices details available for debugging
            pastDueInvoices.forEach((_invoice, _index) => { });
        } else {
            // No invoices found with final query
        }

        // Additional check: specifically look for negative invoices
        const negativeInvoices = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
                amount: { lt: 0 },
            },
            select: {
                id: true,
                customer_id: true,
                due_date: true,
                status: true,
                amount: true,
                customer_outstanding_debt: true,
            },
            take: 10,
        });

        if (negativeInvoices.length > 0) {
            // Negative invoice details available for debugging
            negativeInvoices.forEach((_invoice, _index) => { });
        }

        // Additional comprehensive check: all invoices with past due dates regardless of status
        const allPastDueAnyStatus = await prisma.invoice.findMany({
            where: {
                due_date: { lt: now },
            },
            select: {
                id: true,
                customer_id: true,
                due_date: true,
                status: true,
                amount: true,
                customer_outstanding_debt: true,
            },
            take: 20,
        });

        if (allPastDueAnyStatus.length > 0) {
            // All past due invoices (any status) available for debugging
            allPastDueAnyStatus.forEach((_invoice, _index) => { });
        }

        // Check what status values exist for past due invoices
        const _statusCounts = allPastDueAnyStatus.reduce(
            (acc, invoice) => {
                acc[invoice.status] = (acc[invoice.status] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        return pastDueInvoices;
    }

    async closeZeroOutstandingDebtInvoices() {
        // find all invoices where customer_outstanding_debt is zero and status is due or overdue
        const invoices = await prisma.invoice.findMany({
            where: { customer_outstanding_debt: 0, status: { in: [INVOICE_STATUS.DUE, INVOICE_STATUS.OVERDUE] } },
            select: {
                id: true,
                customer_id: true,
            },
        });

        // update the status to paid in
        await prisma.invoice.updateMany({
            where: { id: { in: invoices.map((invoice) => invoice.id) } },
            data: {
                status: INVOICE_STATUS.PAID,
                zero_limit_alert: false,
            },
        });

        // calculate the outstanding debt for each unique customer
        const customerIds = Array.from(
            new Set(
                invoices
                    .map((invoice) => invoice.customer_id)
                    .filter(
                        (id): id is number => id !== null && id !== undefined
                    )
            )
        ) as number[];
        // Recalculate both due and overdue amounts for affected customers
        await CustomerService.recalculateAllAmountsForCustomers(customerIds);
        for (const customerId of customerIds) {
            await syncCustomerInsuranceFields(customerId);
        }
    }

    async updateInvoicesStatusToOverdue(invoiceIds: number[]) {
        if (invoiceIds.length === 0) {
            return { affectedCustomerIds: [], affectedInvoiceIds: [] };
        }

        // First check current status of these invoices
        const currentInvoices = await prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: {
                id: true,
                status: true,
                due_date: true,
                amount: true,
                customer_id: true,
            },
        });

        // Current status of invoices before update available for debugging
        currentInvoices.forEach((_invoice) => { });

        // Update the status
        const updateResult = await prisma.invoice.updateMany({
            where: { id: { in: invoiceIds } },
            data: { status: INVOICE_STATUS.OVERDUE }, // overdue
        });

        await sweepReportingBreachForOverdueInvoiceIds(invoiceIds);

        // Verify the update
        const updatedInvoices = await prisma.invoice.findMany({
            where: { id: { in: invoiceIds } },
            select: {
                id: true,
                status: true,
                due_date: true,
                amount: true,
                customer_id: true,
            },
        });

        // Status of invoices after update available for debugging
        updatedInvoices.forEach((_invoice) => { });

        // Return affected IDs for cache invalidation
        const affectedCustomerIds = Array.from(
            new Set(
                currentInvoices.map((inv) => inv.customer_id).filter(Boolean)
            )
        );
        const affectedInvoiceIds = currentInvoices.map((inv) => inv.id);

        return {
            affectedCustomerIds,
            affectedInvoiceIds,
            updatedCount: updateResult.count,
        };
    }

    public async markInvoicesProcessed(
        invoiceIds: number[],
        newStatus: invoice_status = INVOICE_STATUS.OVERDUE as invoice_status
    ): Promise<void> {
        try {
            await prisma.invoice.updateMany({
                where: { id: { in: invoiceIds } },
                data: { status: newStatus },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error in markInvoicesProcessed`,
                "InvoiceService.markInvoicesProcessed",
                {
                    error: error.message,
                    stack: error.stack,
                    invoiceIds: invoiceIds,
                    step: "MARK_INVOICES_PROCESSED_ERROR",
                }
            );
            throw error;
        }
    }

    public async getInvoicesByCustomerId(
        customerId: number
    ): Promise<Invoice[]> {
        try {
            return await prisma.invoice.findMany({
                where: { customer_id: customerId },
                orderBy: { due_date: "desc" },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error in getInvoicesByCustomerId`,
                "InvoiceService.getInvoicesByCustomerId",
                {
                    error: error.message,
                    stack: error.stack,
                    customerId: customerId,
                    step: "GET_INVOICES_BY_CUSTOMER_ERROR",
                }
            );
            throw error;
        }
    }

    public async getOverdueInvoices(): Promise<Invoice[]> {
        try {
            return await prisma.invoice.findMany({
                where: {
                    status: { in: [INVOICE_STATUS.DUE, INVOICE_STATUS.OVERDUE] },
                    due_date: { lt: new Date() },
                },
                include: {
                    Customer: true,
                },
            });
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error in getOverdueInvoices`,
                "InvoiceService.getOverdueInvoices",
                {
                    error: error.message,
                    stack: error.stack,
                    step: "GET_OVERDUE_INVOICES_ERROR",
                }
            );
            throw error;
        }
    }

    /**
     * Invalidate control center stats cache when orphan credit invoices change
     */
    private async invalidateControlCenterStats() {
        try {
            // This will be called from the client side to invalidate the cache
            // The actual invalidation happens in the client using React Query
        } catch {
            // Handle cache invalidation error silently
        }
    }

    // ===== CREDIT INVOICE METHODS =====

    /**
     * Check if an invoice is an orphan credit invoice
     * Handles null/undefined amounts by checking both amount and customer_amount
     */
    public isOrphanCreditInvoice(invoice: Partial<Invoice>): boolean {
        const effectiveAmount = invoice.amount ?? invoice.customer_amount ?? 0;
        const customerTotalPaid = invoice.customer_total_paid ?? 0;
        return (
            effectiveAmount < 0 &&
            customerTotalPaid === 0 &&
            !invoice.credit_for_invoice_id
        );
    }

    /**
     * Check if an invoice is a credit invoice (negative amount with no customer_total_paid)
     * Handles null/undefined amounts by checking both amount and customer_amount
     */
    public isCreditInvoice(invoice: Partial<Invoice>): boolean {
        const effectiveAmount = invoice.amount ?? invoice.customer_amount ?? 0;
        const customerTotalPaid = invoice.customer_total_paid ?? 0;
        return effectiveAmount < 0 && customerTotalPaid === 0;
    }

    /**
     * Check if an invoice is a negative invoice (negative amount with customer_total_paid)
     * Handles null/undefined amounts by checking both amount and customer_amount
     */
    public isNegativeInvoice(invoice: Partial<Invoice>): boolean {
        const effectiveAmount = invoice.amount ?? invoice.customer_amount ?? 0;
        const customerTotalPaid = invoice.customer_total_paid ?? 0;
        return effectiveAmount < 0 && customerTotalPaid !== 0;
    }

    /**
     * Check if an invoice should generate payment records
     * Credit invoices should not generate payments, but negative invoices should
     */
    public shouldGeneratePayment(invoice: Partial<Invoice>): boolean {
        return !this.isCreditInvoice(invoice);
    }

    /**
     * Check if an invoice has a negative amount (either credit or negative invoice)
     */
    public isNegativeAmountInvoice(invoice: Partial<Invoice>): boolean {
        const effectiveAmount = invoice.amount ?? invoice.customer_amount ?? 0;
        return effectiveAmount < 0;
    }

    /**
     * Assign a credit invoice to a target invoice
     * This updates the credit_for_invoice_id and only the net_amount of the target invoice
     * total_paid remains unchanged when connecting orphan credit invoices
     */
    public async assignCreditInvoice(
        assignment: CreditInvoiceAssignment
    ): Promise<{
        creditInvoice: Invoice;
        targetInvoice: Invoice;
    }> {
        const { creditInvoiceId, targetInvoiceId, creditAmount } = assignment;

        // First, get the current target invoice to check current values
        const currentTargetInvoice = await this.prisma.invoice.findUnique({
            where: { id: targetInvoiceId },
            select: {
                amount: true,
                total_paid: true,
                customer_total_paid: true,
                net_amount: true,
                customer_net_amount: true,
                outstanding_debt: true,
                customer_amount: true,
                customer_outstanding_debt: true,
                invoice_number: true,
            },
        });

        // Calculate new customer_net_amount only, total_paid remains unchanged
        const currentCustomerNetAmount =
            currentTargetInvoice?.customer_net_amount || 0;
        const currentTotalPaid = currentTargetInvoice?.total_paid || 0;
        const newCustomerNetAmount = Math.max(
            0,
            currentCustomerNetAmount - creditAmount
        ); // Ensure customer_net_amount doesn't go negative

        // Calculate new net_amount - prioritize customer_amount over amount
        const originalAmount = currentTargetInvoice?.amount || 0;
        const originalCustomerAmount =
            currentTargetInvoice?.customer_amount || 0;
        let newNetAmount = 0;

        if (originalCustomerAmount > 0) {
            // Use customer_amount as the primary calculation basis
            newNetAmount = newCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
        } else {
            // Fallback: if customer_amount is 0, use the ratio from amount
            if (originalAmount > 0 && currentCustomerNetAmount > 0) {
                const ratio =
                    originalAmount /
                    (currentTargetInvoice?.net_amount || originalAmount);
                newNetAmount = newCustomerNetAmount * ratio;
            } else {
                // Final fallback: reduce net_amount by the same proportion as customer_net_amount
                const reductionRatio =
                    newCustomerNetAmount / currentCustomerNetAmount;
                newNetAmount =
                    (currentTargetInvoice?.net_amount || 0) * reductionRatio;
            }
        }

        // Calculate new outstanding_debt based on updated net_amount
        const newOutstandingDebt = newNetAmount - currentTotalPaid;

        // Calculate new customer_amount by deducting the credit amount directly
        // If customer_net_amount is reduced by credit, customer_amount should be reduced by the same credit amount
        const currentCustomerAmount =
            currentTargetInvoice?.customer_amount || 0;
        const currentCustomerTotalPaid =
            currentTargetInvoice?.customer_total_paid || 0;

        const _newCustomerAmount = Math.max(
            0,
            currentCustomerAmount - creditAmount
        );

        // Calculate new customer_outstanding_debt based on updated customer_net_amount
        const newCustomerOutstandingDebt = Math.max(
            0,
            newCustomerNetAmount - currentCustomerTotalPaid
        );

        // Update both invoices in a transaction to ensure consistency
        const { creditInvoice, targetInvoice, updatedTargetInvoice } =
            await this.prisma.$transaction(async (tx) => {
                const nextCreditInvoice = await tx.invoice.update({
                    where: { id: creditInvoiceId },
                    data: {
                        credit_for_invoice_id: targetInvoiceId,
                        credit_for_invoice_number:
                            currentTargetInvoice?.invoice_number || null,
                    },
                });
                const nextTargetInvoice = await tx.invoice.update({
                    where: { id: targetInvoiceId },
                    data: {
                        net_amount: newNetAmount,
                        customer_net_amount: newCustomerNetAmount,
                        outstanding_debt: newOutstandingDebt,
                        customer_outstanding_debt:
                            newCustomerOutstandingDebt,
                        // amount and customer_amount are NOT included - they should NEVER change
                    },
                });
                const latestTargetInvoice = await tx.invoice.findUnique({
                    where: { id: targetInvoiceId },
                });

                if (latestTargetInvoice) {
                    await this.handleInvoiceChange(latestTargetInvoice, {
                        dbClient: tx as DbClient,
                        runPostCommitEffects: false,
                    });
                }

                return {
                    creditInvoice: nextCreditInvoice,
                    targetInvoice: nextTargetInvoice,
                    updatedTargetInvoice: latestTargetInvoice,
                };
            });

        if (updatedTargetInvoice) {
            await this.runInvoiceChangePostCommitEffects(updatedTargetInvoice);
        }

        // Log credit invoice assignment
        await this.logService.logMessage(
            LogLevel.INFO,
            `Credit invoice assigned to target invoice`,
            "InvoiceService.assignCreditInvoice",
            {
                creditInvoiceId: creditInvoiceId,
                targetInvoiceId: targetInvoiceId,
                creditAmount: creditAmount,
                step: "CREDIT_ASSIGNMENT",
            },
            creditInvoice.account_id
        );

        return { creditInvoice, targetInvoice };
    }

    /**
     * Update credit invoice assignment (when credit_for_invoice_id changes)
     * This handles all scenarios: new assignment, reassignment, and removal
     * Only net_amount is updated, total_paid remains unchanged
     */
    public async updateCreditInvoiceAssignment(
        update: CreditInvoiceUpdate
    ): Promise<void> {
        const {
            creditInvoiceId,
            oldTargetInvoiceId,
            newTargetInvoiceId,
            creditAmount,
        } = update;

        // If removing assignment (setting to null)
        if (oldTargetInvoiceId && !newTargetInvoiceId) {
            // Get the current values for the old target invoice
            const currentOldInvoice = await this.prisma.invoice.findUnique({
                where: { id: oldTargetInvoiceId },
                select: {
                    amount: true,
                    invoice_number: true,
                    total_paid: true,
                    customer_total_paid: true,
                    net_amount: true,
                    customer_net_amount: true,
                    outstanding_debt: true,
                    customer_amount: true,
                    customer_outstanding_debt: true,
                },
            });

            // Calculate new values for old invoice (revert credit - increase customer_net_amount only)
            const oldCurrentCustomerNetAmount =
                currentOldInvoice?.customer_net_amount || 0;
            const oldCurrentTotalPaid = currentOldInvoice?.total_paid || 0;
            const oldNewCustomerNetAmount =
                oldCurrentCustomerNetAmount + creditAmount;

            // Calculate new net_amount for old invoice - prioritize customer_amount over amount
            const oldOriginalAmount = currentOldInvoice?.amount || 0;
            const oldOriginalCustomerAmount =
                currentOldInvoice?.customer_amount || 0;
            let oldNewNetAmount = 0;

            if (oldOriginalCustomerAmount > 0) {
                // Use customer_amount as the primary calculation basis
                oldNewNetAmount = oldNewCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
            } else {
                // Fallback: if customer_amount is 0, use the ratio from amount
                if (oldOriginalAmount > 0 && oldCurrentCustomerNetAmount > 0) {
                    const ratio =
                        oldOriginalAmount /
                        (currentOldInvoice?.net_amount || oldOriginalAmount);
                    oldNewNetAmount = oldNewCustomerNetAmount * ratio;
                } else {
                    // Final fallback: increase net_amount by the same proportion as customer_net_amount
                    const increaseRatio =
                        oldNewCustomerNetAmount / oldCurrentCustomerNetAmount;
                    oldNewNetAmount =
                        (currentOldInvoice?.net_amount || 0) * increaseRatio;
                }
            }

            const oldNewOutstandingDebt = oldNewNetAmount - oldCurrentTotalPaid;

            // Calculate new customer_amount for old invoice (revert credit - add back the credit amount)
            const oldCurrentCustomerAmount =
                currentOldInvoice?.customer_amount || 0;
            const oldCurrentCustomerTotalPaid =
                currentOldInvoice?.customer_total_paid || 0;
            const _oldNewCustomerAmount =
                oldCurrentCustomerAmount + creditAmount;
            const oldNewCustomerOutstandingDebt = Math.max(
                0,
                oldNewCustomerNetAmount - oldCurrentCustomerTotalPaid
            );

            const updatedOldTargetInvoice = await this.prisma.$transaction(
                async (tx) => {
                    await tx.invoice.update({
                        where: { id: oldTargetInvoiceId },
                        data: {
                            net_amount: oldNewNetAmount,
                            customer_net_amount: oldNewCustomerNetAmount,
                            outstanding_debt: oldNewOutstandingDebt,
                            customer_outstanding_debt:
                                oldNewCustomerOutstandingDebt,
                        },
                    });
                    await tx.invoice.update({
                        where: { id: creditInvoiceId },
                        data: {
                            credit_for_invoice_id: null,
                            credit_for_invoice_number: null,
                        },
                    });

                    const latestOldTargetInvoice = await tx.invoice.findUnique({
                        where: { id: oldTargetInvoiceId },
                    });

                    if (latestOldTargetInvoice) {
                        await this.handleInvoiceChange(latestOldTargetInvoice, {
                            dbClient: tx as DbClient,
                            runPostCommitEffects: false,
                        });
                    }

                    return latestOldTargetInvoice;
                }
            );

            if (updatedOldTargetInvoice) {
                await this.runInvoiceChangePostCommitEffects(
                    updatedOldTargetInvoice
                );
            }

            return;
        }

        // If adding new assignment
        if (!oldTargetInvoiceId && newTargetInvoiceId) {
            // Get the current values for the new target invoice
            const currentNewInvoice = await this.prisma.invoice.findUnique({
                where: { id: newTargetInvoiceId },
                select: {
                    amount: true,
                    invoice_number: true,
                    total_paid: true,
                    customer_total_paid: true,
                    net_amount: true,
                    customer_net_amount: true,
                    outstanding_debt: true,
                    customer_amount: true,
                    customer_outstanding_debt: true,
                },
            });

            // Calculate new values for new invoice (apply credit - decrease customer_net_amount only)
            const newCurrentCustomerNetAmount =
                currentNewInvoice?.customer_net_amount || 0;
            const newCurrentTotalPaid = currentNewInvoice?.total_paid || 0;
            const newNewCustomerNetAmount = Math.max(
                0,
                newCurrentCustomerNetAmount - creditAmount
            ); // Ensure customer_net_amount doesn't go negative

            // Calculate new net_amount for new invoice - prioritize customer_amount over amount
            const newOriginalAmount = currentNewInvoice?.amount || 0;
            const newOriginalCustomerAmount =
                currentNewInvoice?.customer_amount || 0;
            let newNewNetAmount = 0;

            if (newOriginalCustomerAmount > 0) {
                // Use customer_amount as the primary calculation basis
                newNewNetAmount = newNewCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
            } else {
                // Fallback: if customer_amount is 0, use the ratio from amount
                if (newOriginalAmount > 0 && newCurrentCustomerNetAmount > 0) {
                    const ratio =
                        newOriginalAmount /
                        (currentNewInvoice?.net_amount || newOriginalAmount);
                    newNewNetAmount = newNewCustomerNetAmount * ratio;
                } else {
                    // Final fallback: reduce net_amount by the same proportion as customer_net_amount
                    const reductionRatio =
                        newNewCustomerNetAmount / newCurrentCustomerNetAmount;
                    newNewNetAmount =
                        (currentNewInvoice?.net_amount || 0) * reductionRatio;
                }
            }

            const newNewOutstandingDebt = newNewNetAmount - newCurrentTotalPaid;

            // Calculate new customer_amount for new invoice (apply credit - deduct the credit amount)
            const newCurrentCustomerAmount =
                currentNewInvoice?.customer_amount || 0;
            const newCurrentCustomerTotalPaid =
                currentNewInvoice?.customer_total_paid || 0;
            const _newNewCustomerAmount = Math.max(
                0,
                newCurrentCustomerAmount - creditAmount
            );
            const newNewCustomerOutstandingDebt = Math.max(
                0,
                newNewCustomerNetAmount - newCurrentCustomerTotalPaid
            );

            const updatedNewTargetInvoice = await this.prisma.$transaction(
                async (tx) => {
                    await tx.invoice.update({
                        where: { id: newTargetInvoiceId },
                        data: {
                            net_amount: newNewNetAmount,
                            customer_net_amount: newNewCustomerNetAmount,
                            outstanding_debt: newNewOutstandingDebt,
                            customer_outstanding_debt:
                                newNewCustomerOutstandingDebt,
                        },
                    });
                    await tx.invoice.update({
                        where: { id: creditInvoiceId },
                        data: {
                            credit_for_invoice_id: newTargetInvoiceId,
                            credit_for_invoice_number:
                                currentNewInvoice?.invoice_number || null,
                        },
                    });

                    const latestNewTargetInvoice = await tx.invoice.findUnique({
                        where: { id: newTargetInvoiceId },
                    });

                    if (latestNewTargetInvoice) {
                        await this.handleInvoiceChange(latestNewTargetInvoice, {
                            dbClient: tx as DbClient,
                            runPostCommitEffects: false,
                        });
                    }

                    return latestNewTargetInvoice;
                }
            );

            if (updatedNewTargetInvoice) {
                await this.runInvoiceChangePostCommitEffects(
                    updatedNewTargetInvoice
                );
            }

            return;
        }

        // If reassigning from one invoice to another
        if (
            oldTargetInvoiceId &&
            newTargetInvoiceId &&
            oldTargetInvoiceId !== newTargetInvoiceId
        ) {
            // First, get the current values for both invoices
            const [currentOldInvoice, currentNewInvoice] = await Promise.all([
                this.prisma.invoice.findUnique({
                    where: { id: oldTargetInvoiceId },
                    select: {
                        amount: true,
                        invoice_number: true,
                        total_paid: true,
                        customer_total_paid: true,
                        net_amount: true,
                        customer_net_amount: true,
                        outstanding_debt: true,
                        customer_amount: true,
                        customer_outstanding_debt: true,
                    },
                }),
                this.prisma.invoice.findUnique({
                    where: { id: newTargetInvoiceId },
                    select: {
                        amount: true,
                        invoice_number: true,
                        total_paid: true,
                        customer_total_paid: true,
                        net_amount: true,
                        customer_net_amount: true,
                        outstanding_debt: true,
                        customer_amount: true,
                        customer_outstanding_debt: true,
                    },
                }),
            ]);

            // Calculate new values for old invoice (revert credit - increase customer_net_amount only)
            const oldCurrentCustomerNetAmount =
                currentOldInvoice?.customer_net_amount || 0;
            const oldCurrentTotalPaid = currentOldInvoice?.total_paid || 0;
            const oldNewCustomerNetAmount =
                oldCurrentCustomerNetAmount + creditAmount;

            // Calculate new net_amount for old invoice - prioritize customer_amount over amount
            const oldOriginalAmount = currentOldInvoice?.amount || 0;
            const oldOriginalCustomerAmount =
                currentOldInvoice?.customer_amount || 0;
            let oldNewNetAmount = 0;

            if (oldOriginalCustomerAmount > 0) {
                // Use customer_amount as the primary calculation basis
                oldNewNetAmount = oldNewCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
            } else {
                // Fallback: if customer_amount is 0, use the ratio from amount
                if (oldOriginalAmount > 0 && oldCurrentCustomerNetAmount > 0) {
                    const ratio =
                        oldOriginalAmount /
                        (currentOldInvoice?.net_amount || oldOriginalAmount);
                    oldNewNetAmount = oldNewCustomerNetAmount * ratio;
                } else {
                    // Final fallback: increase net_amount by the same proportion as customer_net_amount
                    const increaseRatio =
                        oldNewCustomerNetAmount / oldCurrentCustomerNetAmount;
                    oldNewNetAmount =
                        (currentOldInvoice?.net_amount || 0) * increaseRatio;
                }
            }

            const oldNewOutstandingDebt = oldNewNetAmount - oldCurrentTotalPaid;

            // Calculate new customer_amount for old invoice (revert credit - add back the credit amount)
            const oldCurrentCustomerAmount =
                currentOldInvoice?.customer_amount || 0;
            const oldCurrentCustomerTotalPaid =
                currentOldInvoice?.customer_total_paid || 0;
            const _oldNewCustomerAmount =
                oldCurrentCustomerAmount + creditAmount;
            const oldNewCustomerOutstandingDebt = Math.max(
                0,
                oldNewCustomerNetAmount - oldCurrentCustomerTotalPaid
            );

            // Calculate new values for new invoice (apply credit - decrease customer_net_amount only)
            const newCurrentCustomerNetAmount =
                currentNewInvoice?.customer_net_amount || 0;
            const newCurrentTotalPaid = currentNewInvoice?.total_paid || 0;
            const newNewCustomerNetAmount = Math.max(
                0,
                newCurrentCustomerNetAmount - creditAmount
            ); // Ensure customer_net_amount doesn't go negative

            // Calculate new net_amount for new invoice - prioritize customer_amount over amount
            const newOriginalAmount = currentNewInvoice?.amount || 0;
            const newOriginalCustomerAmount =
                currentNewInvoice?.customer_amount || 0;
            let newNewNetAmount = 0;

            if (newOriginalCustomerAmount > 0) {
                // Use customer_amount as the primary calculation basis
                newNewNetAmount = newNewCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
            } else {
                // Fallback: if customer_amount is 0, use the ratio from amount
                if (newOriginalAmount > 0 && newCurrentCustomerNetAmount > 0) {
                    const ratio =
                        newOriginalAmount /
                        (currentNewInvoice?.net_amount || newOriginalAmount);
                    newNewNetAmount = newNewCustomerNetAmount * ratio;
                } else {
                    // Final fallback: reduce net_amount by the same proportion as customer_net_amount
                    const reductionRatio =
                        newNewCustomerNetAmount / newCurrentCustomerNetAmount;
                    newNewNetAmount =
                        (currentNewInvoice?.net_amount || 0) * reductionRatio;
                }
            }

            const newNewOutstandingDebt = newNewNetAmount - newCurrentTotalPaid;

            // Calculate new customer_amount for new invoice (apply credit - deduct the credit amount)
            const newCurrentCustomerAmount =
                currentNewInvoice?.customer_amount || 0;
            const newCurrentCustomerTotalPaid =
                currentNewInvoice?.customer_total_paid || 0;
            const _newNewCustomerAmount = Math.max(
                0,
                newCurrentCustomerAmount - creditAmount
            );
            const newNewCustomerOutstandingDebt = Math.max(
                0,
                newNewCustomerNetAmount - newCurrentCustomerTotalPaid
            );

            const { updatedOldTargetInvoice, updatedNewTargetInvoice } =
                await this.prisma.$transaction(async (tx) => {
                    await tx.invoice.update({
                        where: { id: oldTargetInvoiceId },
                        data: {
                            net_amount: oldNewNetAmount,
                            customer_net_amount: oldNewCustomerNetAmount,
                            outstanding_debt: oldNewOutstandingDebt,
                            customer_outstanding_debt:
                                oldNewCustomerOutstandingDebt,
                        },
                    });
                    await tx.invoice.update({
                        where: { id: newTargetInvoiceId },
                        data: {
                            net_amount: newNewNetAmount,
                            customer_net_amount: newNewCustomerNetAmount,
                            outstanding_debt: newNewOutstandingDebt,
                            customer_outstanding_debt:
                                newNewCustomerOutstandingDebt,
                        },
                    });
                    await tx.invoice.update({
                        where: { id: creditInvoiceId },
                        data: {
                            credit_for_invoice_id: newTargetInvoiceId,
                            credit_for_invoice_number:
                                currentNewInvoice?.invoice_number || null,
                        },
                    });

                    const [latestOldTargetInvoice, latestNewTargetInvoice] =
                        await Promise.all([
                            tx.invoice.findUnique({
                                where: { id: oldTargetInvoiceId },
                            }),
                            tx.invoice.findUnique({
                                where: { id: newTargetInvoiceId },
                            }),
                        ]);

                    if (latestOldTargetInvoice) {
                        await this.handleInvoiceChange(latestOldTargetInvoice, {
                            dbClient: tx as DbClient,
                            runPostCommitEffects: false,
                        });
                    }
                    if (latestNewTargetInvoice) {
                        await this.handleInvoiceChange(latestNewTargetInvoice, {
                            dbClient: tx as DbClient,
                            runPostCommitEffects: false,
                        });
                    }

                    return {
                        updatedOldTargetInvoice: latestOldTargetInvoice,
                        updatedNewTargetInvoice: latestNewTargetInvoice,
                    };
                });

            if (updatedOldTargetInvoice) {
                await this.runInvoiceChangePostCommitEffects(
                    updatedOldTargetInvoice
                );
            }
            if (updatedNewTargetInvoice) {
                await this.runInvoiceChangePostCommitEffects(
                    updatedNewTargetInvoice
                );
            }
        }
    }

    /**
     * Apply credit amount to an invoice (decrease customer_net_amount only, leave total_paid unchanged)
     */
    private async applyCreditToInvoice(
        invoiceId: number,
        creditAmount: number
    ): Promise<void> {
        // First, get the current invoice to check current values
        const currentInvoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                amount: true,
                total_paid: true,
                customer_total_paid: true,
                net_amount: true,
                customer_net_amount: true,
                outstanding_debt: true,
                customer_amount: true,
                customer_outstanding_debt: true,
            },
        });

        // Calculate new customer_net_amount only, total_paid remains unchanged
        const currentCustomerNetAmount =
            currentInvoice?.customer_net_amount || 0;
        const currentTotalPaid = currentInvoice?.total_paid || 0;
        const newCustomerNetAmount = Math.max(
            0,
            currentCustomerNetAmount - creditAmount
        ); // Ensure customer_net_amount doesn't go negative

        // Calculate new net_amount - prioritize customer_amount over amount
        const originalAmount = currentInvoice?.amount || 0;
        const originalCustomerAmount = currentInvoice?.customer_amount || 0;
        let newNetAmount = 0;

        if (originalCustomerAmount > 0) {
            // Use customer_amount as the primary calculation basis
            newNetAmount = newCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
        } else {
            // Fallback: if customer_amount is 0, use the ratio from amount
            if (originalAmount > 0 && currentCustomerNetAmount > 0) {
                const ratio =
                    originalAmount /
                    (currentInvoice?.net_amount || originalAmount);
                newNetAmount = newCustomerNetAmount * ratio;
            } else {
                // Final fallback: reduce net_amount by the same proportion as customer_net_amount
                const reductionRatio =
                    newCustomerNetAmount / currentCustomerNetAmount;
                newNetAmount =
                    (currentInvoice?.net_amount || 0) * reductionRatio;
            }
        }

        // Calculate new outstanding_debt based on updated net_amount
        const newOutstandingDebt = newNetAmount - currentTotalPaid;

        // DO NOT modify customer_amount - preserve the original amount
        // customer_amount should remain unchanged

        // Calculate new customer_outstanding_debt based on updated customer_net_amount
        const currentCustomerTotalPaid =
            currentInvoice?.customer_total_paid || 0;
        const newCustomerOutstandingDebt = Math.max(
            0,
            newCustomerNetAmount - currentCustomerTotalPaid
        );

        const updatedInvoice = await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                net_amount: newNetAmount,
                customer_net_amount: newCustomerNetAmount,
                outstanding_debt: newOutstandingDebt,
                customer_outstanding_debt: newCustomerOutstandingDebt,
                // amount and customer_amount are NOT included - they should NEVER change
            },
        });

        // Check if invoice should be marked as paid after credit application
        if (updatedInvoice) {
            // Use centralized method to handle all invoice changes
            await this.handleInvoiceChange(updatedInvoice);
        }
    }

    /**
     * Centralized method to handle all invoice changes
     * This method should be called whenever an invoice is updated to ensure all related calculations are performed
     */
    private async runInvoiceChangePostCommitEffects(
        invoice: Pick<Invoice, "account_id" | "customer_id" | "id">
    ): Promise<void> {
        // Cache invalidation and insurance follow-up effects run after commit so
        // invoice/collection-period updates never partially persist with them.
        try {
            const { invalidateDashboardCacheForAccount } = await import(
                "@/server/utils/cacheInvalidationHelper"
            );
            await invalidateDashboardCacheForAccount(invoice.account_id);
        } catch (error) {
            // Cache invalidation failure should not break invoice change handling
            console.error("Failed to invalidate dashboard cache:", error);
        }

        if (invoice.customer_id) {
            await syncCustomerInsuranceFields(invoice.customer_id, {
                invoiceIds: [invoice.id],
            });
        }
    }

    public async handleInvoiceChange(
        invoice: Invoice,
        options: {
            dbClient?: DbClient;
            runPostCommitEffects?: boolean;
            /** Batch import recomputes insurance once post-commit (restamp + sync). */
            skipInsuranceRecompute?: boolean;
        } = {}
    ): Promise<void> {
        try {
            const runPostCommitEffects =
                options.runPostCommitEffects ?? options.dbClient == null;
            const skipInsuranceRecompute = options.skipInsuranceRecompute === true;

            const runCore = async (dbClient: DbClient) => {
                // Step 1: Check and update invoice status if needed
                await this.checkAndUpdateInvoiceStatus(invoice, dbClient);

                // Step 1b: When invoice is PAID, cancel due notifications and clear due_notification_state
                const currentInvoice = await dbClient.invoice.findUnique({
                    where: { id: invoice.id },
                    select: { status: true },
                });
                if (currentInvoice?.status === INVOICE_STATUS.PAID) {
                    const dueNotificationService = new DueNotificationService();
                    await dueNotificationService.cancelDueNotificationsForInvoices(
                        [invoice.id],
                        undefined,
                        dbClient
                    );
                    await dbClient.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            due_notification_state: {},
                            zero_limit_alert: false,
                        },
                    });
                }

                // Step 2: Handle status change (updates customer + collection period)
                await this.handleStatusChange(invoice, {
                    dbClient,
                    runPostCommitEffects: false,
                });

                if (!skipInsuranceRecompute) {
                    await this.refreshInsuranceFieldsForInvoiceId(invoice.id, {
                        dbClient,
                        runFollowUpEffects: false,
                        skipCustomerInsuranceSync: true,
                    });

                    if (invoice.customer_id) {
                        await syncCustomerInsuranceFields(invoice.customer_id, {
                            dbClient,
                            runFollowUpEffects: false,
                            invoiceIds: [invoice.id],
                        });
                    }
                }
            };

            if (options.dbClient) {
                await runCore(options.dbClient);
            } else {
                await prisma.$transaction(async (tx) => {
                    await runCore(tx as DbClient);
                });
            }

            if (runPostCommitEffects) {
                await this.runInvoiceChangePostCommitEffects(invoice);
            }
        } catch (error: any) {
            await this.logService.logMessage(
                LogLevel.ERROR,
                `Error in handleInvoiceChange`,
                "InvoiceService.handleInvoiceChange",
                {
                    error: error.message,
                    stack: error.stack,
                    invoiceId: invoice.id,
                    invoiceNumber: invoice.invoice_number,
                    customerId: invoice.customer_id,
                    step: "HANDLE_INVOICE_CHANGE_ERROR",
                },
                invoice.account_id
            );
            throw error;
        }
    }

    /**
     * Check if invoice should be marked as paid and update status accordingly
     */
    private async checkAndUpdateInvoiceStatus(
        invoice: Invoice,
        dbClient: DbClient = prisma
    ): Promise<void> {
        // Don't automatically mark credit invoices as paid based on payment status
        // Credit invoices should only be marked as paid when they are assigned to a target invoice
        // Negative invoices should be marked as paid when fully paid
        if (this.isCreditInvoice(invoice)) {
            return;
        }

        // If customer_total_paid equals or exceeds customer_net_amount, mark as paid (for regular and negative invoices)
        // Prioritize customer currency since that's what the customer actually owes
        const isPaid =
            (invoice.customer_total_paid || 0) >=
            (invoice.customer_net_amount || 0);
        if (isPaid && invoice.status !== INVOICE_STATUS.PAID) {
            const outstandingDebt = this.calculateOutstandingDebt(invoice);
            const customerOutstandingDebt =
                this.calculateCustomerOutstandingDebt(invoice);
            await dbClient.invoice.update({
                where: { id: invoice.id },
                data: {
                    status: INVOICE_STATUS.PAID,
                    outstanding_debt: outstandingDebt,
                    customer_outstanding_debt: customerOutstandingDebt,
                    zero_limit_alert: false,
                },
            });
        }
    }

    /**
     * Revert credit amount from an invoice (increase customer_net_amount only, leave total_paid unchanged)
     */
    private async revertCreditFromInvoice(
        invoiceId: number,
        creditAmount: number
    ): Promise<void> {
        // First, get the current invoice to check current values
        const currentInvoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: {
                amount: true,
                total_paid: true,
                customer_total_paid: true,
                net_amount: true,
                customer_net_amount: true,
                outstanding_debt: true,
                customer_amount: true,
                customer_outstanding_debt: true,
            },
        });

        // Calculate new customer_net_amount only, total_paid remains unchanged
        const currentCustomerNetAmount =
            currentInvoice?.customer_net_amount || 0;
        const currentTotalPaid = currentInvoice?.total_paid || 0;
        const newCustomerNetAmount = currentCustomerNetAmount + creditAmount;

        // Calculate new net_amount - prioritize customer_amount over amount
        const originalAmount = currentInvoice?.amount || 0;
        const originalCustomerAmount = currentInvoice?.customer_amount || 0;
        let newNetAmount = 0;

        if (originalCustomerAmount > 0) {
            // Use customer_amount as the primary calculation basis
            newNetAmount = newCustomerNetAmount; // net_amount should match customer_net_amount when customer_amount is available
        } else {
            // Fallback: if customer_amount is 0, use the ratio from amount
            if (originalAmount > 0 && currentCustomerNetAmount > 0) {
                const ratio =
                    originalAmount /
                    (currentInvoice?.net_amount || originalAmount);
                newNetAmount = newCustomerNetAmount * ratio;
            } else {
                // Final fallback: increase net_amount by the same proportion as customer_net_amount
                const increaseRatio =
                    newCustomerNetAmount / currentCustomerNetAmount;
                newNetAmount =
                    (currentInvoice?.net_amount || 0) * increaseRatio;
            }
        }

        // Calculate new outstanding_debt based on updated net_amount
        const newOutstandingDebt = newNetAmount - currentTotalPaid;

        // DO NOT modify customer_amount - preserve the original amount
        // customer_amount should remain unchanged

        // Calculate new customer_outstanding_debt based on updated customer_net_amount
        const currentCustomerTotalPaid =
            currentInvoice?.customer_total_paid || 0;
        const newCustomerOutstandingDebt = Math.max(
            0,
            newCustomerNetAmount - currentCustomerTotalPaid
        );

        const updatedInvoice = await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: {
                net_amount: newNetAmount,
                customer_net_amount: newCustomerNetAmount,
                outstanding_debt: newOutstandingDebt,
                customer_outstanding_debt: newCustomerOutstandingDebt,
                // amount and customer_amount are NOT included - they should NEVER change
            },
        });

        // Use centralized method to handle all invoice changes
        await this.handleInvoiceChange(updatedInvoice);
    }

    /**
     * Validate credit invoice assignment
     */
    public async validateCreditInvoiceAssignment(
        creditInvoiceId: number,
        targetInvoiceId: number,
        accountId: number
    ): Promise<{
        isValid: boolean;
        error?: string;
        creditInvoice?: Invoice;
        targetInvoice?: Invoice;
    }> {
        // Verify that both invoices belong to the customer
        const creditInvoice = await this.prisma.invoice.findFirst({
            where: {
                id: creditInvoiceId,
                account_id: accountId,
                credit_for_invoice_id: null,
                amount: { lt: 0 }, // Negative amount
                customer_total_paid: 0, // Only credit invoices (no customer_total_paid)
            },
        });

        const targetInvoice = await this.prisma.invoice.findFirst({
            where: {
                id: targetInvoiceId,
                account_id: accountId,
                amount: { gt: 0 }, // Positive amount
            },
        });

        if (!creditInvoice) {
            return { isValid: false, error: "Credit invoice not found" };
        }

        if (!targetInvoice) {
            return { isValid: false, error: "Target invoice not found" };
        }

        // Verify that the target invoice amount is same or higher than the credit invoice amount
        const creditAmount = Math.abs(creditInvoice.amount || 0);
        if ((targetInvoice.amount || 0) < creditAmount) {
            return {
                isValid: false,
                error: "Target invoice amount must be same or higher than the credit amount",
            };
        }

        return {
            isValid: true,
            creditInvoice,
            targetInvoice,
        };
    }

    /**
     * Get orphan credit invoices for a customer
     */
    public async getOrphanCreditInvoices(
        accountId: number,
        page: number = 1,
        limit: number = 10,
        sortField: string = "invoice_number",
        sortDirection: "asc" | "desc" = "asc",
        ownerFilter: any = {}
    ): Promise<{
        invoices: Invoice[];
        totalRecords: number;
        page: number;
        limit: number;
    }> {
        const skip = (page - 1) * limit;

        const invoices = await this.prisma.invoice.findMany({
            where: {
                account_id: accountId,
                credit_for_invoice_id: null,
                amount: { lt: 0 }, // Negative amount
                customer_total_paid: 0, // Only credit invoices (no customer_total_paid)
                // Credit invoices can have any status - they don't need to be PAID to be considered orphan
                Customer: {
                    collection_status: "Active",
                    ...ownerFilter,
                },
            },
            include: {
                Customer: {
                    select: {
                        customer_number: true,
                        collection_status: true,
                    },
                    include: {
                        Country: {
                            select: {
                                currency: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                [sortField]: sortDirection,
            },
            skip,
            take: limit,
        });

        const totalRecords = await this.prisma.invoice.count({
            where: {
                account_id: accountId,
                credit_for_invoice_id: null,
                amount: { lt: 0 }, // Negative amount
                customer_total_paid: 0, // Only credit invoices (no customer_total_paid)
                // Credit invoices can have any status - they don't need to be PAID to be considered orphan
                Customer: {
                    collection_status: "Active",
                    ...ownerFilter,
                },
            },
        });

        return {
            invoices,
            totalRecords,
            page,
            limit,
        };
    }

    /**
     * Get available invoices for credit assignment
     */
    public async getAvailableInvoicesForCredit(
        customerId: number,
        accountId: number
    ): Promise<any[]> {
        return await this.prisma.invoice.findMany({
            where: {
                account_id: accountId,
                customer_id: customerId,
                amount: { gt: 0 }, // Positive amount (not credit invoices)
                status: { in: ["Due", "Overdue"] }, // Due and overdue statuses
            },
            select: {
                id: true,
                invoice_number: true,
                amount: true,
                customer_net_amount: true,
                due_date: true,
                status: true,
                customer_currency: true,
                Customer: {
                    select: {
                        Country: {
                            select: {
                                currency: true,
                            },
                        },
                    },
                },
            },
            orderBy: {
                due_date: "asc",
            },
        });
    }
}
