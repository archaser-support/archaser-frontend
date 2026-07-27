import { dispute_status } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { DisputeInvoiceService } from "@/shared/services/customerService";
import { CustomerForPromiseToPay } from "@/shared/services/promiseToPayService";
import { PortalInvoice } from "@/types/PortalInvoice";

export interface CustomerData extends CustomerForPromiseToPay {
    id: number;
    Account?: {
        name: string | null;
        logo: string | null;
        promise_to_pay: number | null;
        sub_domain: string | null;
        primary_color: string | null;
        secondary_color: string | null;
        chart_palette_color: string | null;
    } | null;
    CustomerCollectionPeriod?: {
        promise_to_pay_count: number;
        promise_to_pay_date: Date | null;
    } | null;
}

export interface DisputeData {
    id: number;
    status: dispute_status;
    reason: string | null;
    comment: string | null;
    created_at: Date;
    modified_at: Date;
    assignedUser: {
        initials: string;
        name: string;
    } | null;
    contact: {
        name: string;
        email: string;
        mobile: string;
    } | null;
    resolutionComment: string | null;
    invoices: PortalInvoice[];
}

export interface DisputeDetails {
    customerName: string | null;
    logo: string | null;
    country: string | null;
    state: string | null;
    customerCurrency: string | null;
    disputes: DisputeData[];
}

export interface CreateDisputeData {
    customer_id: number;
    invoices: PortalInvoice[];
    reasons: {
        id: number;
        name: string;
        editable: boolean | null;
    }[];
    customerName: string | null;
    logo: string | null;
    sub_domain: string | null;
    hasDisputedInvoices: boolean;
    language: string;
}

export interface AgentPortalData {
    customer_id: number;
    invoices: PortalInvoice[];
    reasons: {
        id: number;
        name: string;
        editable: boolean | null;
    }[];
    isOpenDispute: boolean;
}

export class PortalService {
    /**
     * Get all overdue invoices for a customer (includes invoices in disputes)
     * Used for invoice list page
     */
    static async getAllOverdueInvoices(
        customerId: number,
        accountId: number
    ): Promise<PortalInvoice[]> {
        // Build the invoice where clause - only filter by status, no dispute exclusions
        const invoiceWhereClause: any = {
            account_id: accountId,
            customer_id: customerId, // Add customer_id filter to only show invoices for this specific customer
            status: { in: ["Overdue", "Due"] }, // Both overdue (Overdue) and due (Due) invoices
            OR: [
                { outstanding_debt: { gt: 0 } },
                { customer_outstanding_debt: { gt: 0 } }
            ],
        };

        // Get customer with all overdue invoices
        const customer = await prisma.customer.findFirst({
            where: { id: customerId },
            include: {
                Invoice: {
                    where: invoiceWhereClause,
                    include: {},
                },
                CustomerCollectionPeriod: {
                    where: { period_end_date: null },
                    select: { currency: true },
                },
            },
        });

        if (!customer) {
            return [];
        }

        // Fetch Account separately to get currency
        const account = customer.account_id ? await prisma.account.findUnique({
            where: { id: customer.account_id },
            select: { currency: true },
        }) : null;

        // Transform invoice data to match PortalInvoice type
        return (customer as any).Invoice.map((invoice: any) => ({
            id: invoice.id,
            invoiceNumber: invoice.invoice_number || "N/A",
            amount: invoice.amount || 0,
            customerAmount: invoice?.customer_amount || 0,
            dueDate: invoice.due_date?.toISOString() || "N/A",
            totalPaid: invoice.total_paid || 0,
            customerTotalPaid: invoice?.customer_total_paid || 0,
            outstandingDebt: invoice.outstanding_debt || 0,
            customerOutstandingDebt: invoice.customer_outstanding_debt || 0,
            status: invoice.status || "Unknown",
            customerCurrency: invoice?.customer_currency || "",
            currency:
                (customer as any).CustomerCollectionPeriod?.[0]?.currency || account?.currency || "Undefined",
        }));
    }


    /**
     * Get customer data for portal (no authentication required)
     */
    static async getCustomerData(temp_CustomerUUID: string): Promise<CustomerData | null> {
        try {
            const customer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                select: {
                    id: true,
                    account_id: true,
                    CustomerCollectionPeriod: {
                        where: { period_end_date: null },
                        select: {
                            promise_to_pay_count: true,
                            promise_to_pay_date: true,
                        },
                        take: 1,
                    },
                },
            });

            if (!customer) {
                return null;
            }

            // Fetch Account separately using account_id
            const account = customer.account_id ? await prisma.account.findUnique({
                where: { id: customer.account_id },
                select: {
                    name: true,
                    logo: true,
                    promise_to_pay: true,
                    sub_domain: true,
                    primary_color: true,
                    secondary_color: true,
                    chart_palette_color: true,
                },
            }) : null;

            // Process logo data
            let logo = null;
            // Handle logo properly - don't process string paths on server side
            logo = account?.logo || null;

            return {
                id: customer.id,
                Account: account ? {
                    name: account.name,
                    logo: logo,
                    promise_to_pay: account.promise_to_pay,
                    sub_domain: account.sub_domain,
                    primary_color: account.primary_color,
                    secondary_color: account.secondary_color,
                    chart_palette_color: account.chart_palette_color,
                } : null,
                CustomerCollectionPeriod: customer.CustomerCollectionPeriod?.[0] || null,
            };
        } catch (error) {
            console.error("Error in getCustomerData:", error);
            return null;
        }
    }

    /**
     * Get customer invoices for portal (no authentication required)
     */
    static async getCustomerInvoices(temp_CustomerUUID: string) {
        try {

            const customer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                select: {
                    id: true,
                    customer_uuid: true,
                    account_id: true,
                    language: true,
                },
            });

            if (!customer) {
                return null;
            }

            // Fetch Account separately using account_id
            const account = await prisma.account.findUnique({
                where: { id: customer.account_id },
                select: {
                    logo: true,
                    name: true,
                    primary_color: true,
                    secondary_color: true,
                    chart_palette_color: true,
                },
            });

            if (!account) {
                return null;
            }

            // Get ALL invoices for the customer (including those in disputes) using the unified service
            // This shows all due and overdue invoices regardless of dispute status
            const { DisputeInvoiceService } = await import("@/shared/services/customerService");

            const rawInvoices = await DisputeInvoiceService.getAllInvoicesForCustomer(
                customer.customer_uuid
            );

            // Transform Prisma Invoice objects to PortalInvoice format
            const invoices = rawInvoices.map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoice_number || "N/A",
                amount: invoice.amount || 0,
                customerAmount: invoice?.customer_amount || 0,
                dueDate: invoice.due_date?.toISOString() || "N/A",
                totalPaid: invoice.total_paid || 0,
                customerTotalPaid: invoice?.customer_total_paid || 0,
                outstandingDebt: invoice.outstanding_debt || 0,
                customerOutstandingDebt: invoice.customer_outstanding_debt || 0,
                status: invoice.status || "Unknown",
                customerCurrency: invoice?.customer_currency || "",
                currency: "USD", // Default currency, can be enhanced later
            }));

            // Handle logo properly - don't process string paths on server side
            const logo = account.logo || null;

            const result = {
                invoices,
                logo,
                customerName: account.name || "N/A",
                language: customer.language || "English",
                primary_color: account.primary_color,
            };

            return result;
        } catch (error: any) {
            console.error("Error in getCustomerInvoices:", error.message);
            throw error;
        }
    }

    /**
     * Get dispute details for portal (no authentication required)
     * @param temp_CustomerUUID - The UUID of the customer
     * @param portalLanguage - The language for the portal (e.g., "Hebrew", "English")
     */
    static async getDisputeDetails(
        temp_CustomerUUID: string,
        portalLanguage?: string
    ): Promise<DisputeDetails | null> {
        try {
            // First get the customer to find account_id
            const customerWithCustomer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                select: { account_id: true },
            });

            if (!customerWithCustomer) {
                return null;
            }

            const accountId = customerWithCustomer.account_id;

            if (!accountId) {
                return null;
            }

            const customer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                include: {
                    Country: { select: { iso2: true, name: true } },
                    State: { select: { iso2: true, name: true } },
                    CustomerDispute: {
                        where: {
                            dispute_status: {
                                notIn: [
                                    "Resolved",
                                    "Cancelled",
                                ] as dispute_status[],
                            },
                        },
                        include: {
                            DisputeInvoice: {
                                include: {
                                    Invoice: {
                                        select: {
                                            id: true,
                                            invoice_number: true,
                                            amount: true,
                                            customer_currency: true,
                                            customer_amount: true,
                                            due_date: true,
                                            total_paid: true,
                                            outstanding_debt: true,
                                        },
                                    },
                                },
                            },
                            DisputeReason: {
                                include: {
                                    DisputeReasonLanguage: true,
                                },
                            },
                            User_CustomerDispute_owner_idToUser: {
                                select: {
                                    first_name: true,
                                    last_name: true,
                                    email: true,
                                },
                            },
                        },
                        orderBy: { created_at: "desc" },
                    },
                },
            });

            if (!customer) {
                return null;
            }

            // Fetch Account separately using account_id
            const account = customer.account_id ? await prisma.account.findUnique({
                where: { id: customer.account_id },
                select: {
                    name: true,
                    logo: true,
                    currency: true,
                    primary_color: true,
                    secondary_color: true,
                    chart_palette_color: true,
                },
            }) : null;

            // Handle logo properly - don't process string paths on server side
            const logo = account?.logo || null;

            // Determine target language - use portalLanguage or fallback to customer language
            const targetLanguage = portalLanguage || customer.language;

            return {
                customerName: account?.name ?? null,
                logo,
                customerCurrency: account?.currency ?? null,
                country: (customer as any).Country?.name ?? null,
                state: (customer as any).State?.name ?? null,
                disputes: (customer as any).CustomerDispute.map((dispute: any) => {
                    const user = dispute.User_CustomerDispute_owner_idToUser;
                    const initials = user
                        ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase()
                        : "";

                    // Get language-specific dispute reason name
                    let disputeReasonName = dispute.DisputeReason?.name ?? null;

                    if (dispute.DisputeReason && targetLanguage && dispute.DisputeReason.DisputeReasonLanguage) {
                        // Filter by language first (case-insensitive)
                        const languageTemplates = dispute.DisputeReason.DisputeReasonLanguage.filter(
                            (lt: any) => lt.language?.toLowerCase() === targetLanguage?.toLowerCase()
                        );

                        if (languageTemplates.length > 0) {
                            // Use the first matching language record
                            // (account_id and master_template no longer exist on DisputeReasonLanguage;
                            //  language records are already account-scoped via the parent DisputeReason)
                            const languageTemplate = languageTemplates[0];

                            if (languageTemplate?.name) {
                                disputeReasonName = languageTemplate.name;
                            }
                        }
                    }

                    // Check if this is a contact-related dispute (using base name for comparison)
                    const baseReasonName = dispute.DisputeReason?.name ?? "";
                    const isContactDispute =
                        baseReasonName === "Not the right contact person in the company" ||
                        baseReasonName === "I am not working there anymore";

                    return {
                        id: dispute.id,
                        status: dispute.dispute_status ?? "New",
                        reason: disputeReasonName,
                        comment: dispute.customer_comment ?? null,
                        created_at: dispute.created_at,
                        modified_at: dispute.modified_at,
                        assignedUser: user
                            ? {
                                initials,
                                name: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
                            }
                            : null,
                        contact:
                            dispute.contact_first_name ||
                                dispute.contact_last_name ||
                                dispute.contact_email ||
                                dispute.contact_mobile
                                ? {
                                    name: `${dispute.contact_first_name ?? ""} ${dispute.contact_last_name ?? ""}`.trim(),
                                    email: dispute.contact_email ?? "",
                                    mobile: dispute.contact_mobile ?? "",
                                }
                                : null,
                        resolutionComment: dispute.resolution_comment ?? null,
                        // Only include invoices for non-contact disputes
                        invoices: isContactDispute ? [] : dispute.DisputeInvoice.map((di: any) => ({
                            id: di.Invoice.id,
                            invoiceNumber: di.Invoice.invoice_number ?? "",
                            amount: di.Invoice.amount ?? 0,
                            customerAmount: di.Invoice.customer_amount ?? 0,
                            dueDate: di.Invoice.due_date
                                ? di.Invoice.due_date.toISOString()
                                : new Date().toISOString(),
                            totalPaid: di.Invoice.total_paid ?? 0,
                            customerTotalPaid: di.Invoice.total_paid ?? 0,
                            outstandingDebt: di.Invoice.outstanding_debt ?? 0,
                            customerOutstandingDebt:
                                di.Invoice.outstanding_debt ?? 0,
                            status: di.Invoice.status ?? "Open",
                            customerCurrency: di.Invoice.customer_currency ?? "USD",
                            currency: di.Invoice.customer_currency ?? "USD",
                        })),
                    };
                }),
            };
        } catch (error) {
            console.error("Error fetching dispute details:", error);
            return null;
        }
    }

    /**
     * Get create dispute data for portal (no authentication required)
     * @param temp_CustomerUUID - The UUID of the customer
     * @param portalLanguage - Optional language to use for dispute reasons (e.g., "Hebrew", "English")
     *                         If not provided, defaults to customer's language
     */
    static async getCreateDisputeData(
        temp_CustomerUUID: string,
        portalLanguage?: string
    ): Promise<CreateDisputeData | null> {
        try {

            // Get customer with basic info
            const customer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                select: {
                    id: true,
                    account_id: true,
                    language: true,
                    customer_uuid: true,
                },
            });

            if (!customer) {
                return null;
            }

            // Fetch Account separately using account_id
            const account = customer.account_id ? await prisma.account.findUnique({
                where: { id: customer.account_id },
                select: {
                    name: true,
                    logo: true,
                    sub_domain: true,
                    primary_color: true,
                    secondary_color: true,
                    chart_palette_color: true,
                },
            }) : null;

            // Get available invoices for dispute creation (excludes invoices in active disputes)
            const invoices = await DisputeInvoiceService.getAvailableInvoicesForDispute(
                customer.customer_uuid
            );

            // Get dispute reasons for this customer with language templates
            const disputeReasons = await prisma.disputeReason.findMany({
                where: {
                    account_id: customer.account_id,
                    editable: true,
                },
                include: {
                    DisputeReasonLanguage: true,
                },
            });

            // Map to include language-specific name based on portal language or customer's language preference
            const targetLanguage = portalLanguage || customer.language;
            const reasons = disputeReasons.map(reason => {
                let languageTemplate;

                if (targetLanguage && reason.DisputeReasonLanguage) {
                    // Try exact match first
                    languageTemplate = reason.DisputeReasonLanguage.find(
                        lt => lt.language === targetLanguage
                    );

                    // If no exact match, try case-insensitive match
                    if (!languageTemplate) {
                        languageTemplate = reason.DisputeReasonLanguage.find(
                            lt => lt.language?.toLowerCase() === targetLanguage?.toLowerCase()
                        );
                    }
                }

                return {
                    id: reason.id,
                    name: languageTemplate?.name || reason.name, // Fallback to default
                    editable: reason.editable
                };
            });

            // Handle logo properly - don't process string paths on server side
            const logo = account?.logo || null;

            // Check if there are any invoices in disputes for this customer
            const hasDisputedInvoices = await DisputeInvoiceService.hasDisputedInvoices(customer.id);

            // Transform invoices to match PortalInvoice type
            const portalInvoices: PortalInvoice[] = invoices.map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoice_number || "N/A",
                amount: invoice.amount || 0,
                customerAmount: invoice?.customer_amount || 0,
                dueDate: invoice.due_date?.toISOString() || "N/A",
                totalPaid: invoice.total_paid || 0,
                customerTotalPaid: invoice?.customer_total_paid || 0,
                outstandingDebt: invoice.outstanding_debt || 0,
                customerOutstandingDebt: invoice.customer_outstanding_debt || 0,
                status: invoice.status || "Unknown",
                customerCurrency: invoice?.customer_currency || "",
                currency: "USD", // Default currency, can be enhanced later
            }));

            return {
                customer_id: customer.id,
                invoices: portalInvoices,
                reasons: reasons.map((reason) => ({
                    id: reason.id,
                    name: reason.name,
                    editable: reason.editable,
                })),
                customerName: account?.name ?? null,
                logo,
                sub_domain: account?.sub_domain ?? null,
                hasDisputedInvoices,
                language: customer.language || "English",
            };
        } catch (error) {
            console.error("Error fetching create-dispute data:", error);
            return null;
        }
    }

    /**
     * Get agent portal data for portal (no authentication required)
     */
    static async getAgentPortalData(
        temp_CustomerUUID: string
    ): Promise<AgentPortalData | null> {
        try {
            // Get customer with basic info
            const customer = await prisma.customer.findFirst({
                where: { customer_uuid: temp_CustomerUUID },
                select: {
                    id: true,
                    account_id: true,
                    customer_uuid: true,
                },
            });

            if (!customer) {
                return null;
            }

            // Get available invoices for dispute creation (excludes invoices in active disputes)
            const invoices = await DisputeInvoiceService.getAvailableInvoicesForDispute(
                customer.customer_uuid
            );

            const reasons = await prisma.disputeReason.findMany({
                where: {
                    account_id: customer.account_id,
                    editable: true,
                },
                select: {
                    id: true,
                    name: true,
                    editable: true,
                },
            });

            const unresolvedDisputes = await prisma.customerDispute.findMany({
                where: {
                    customer_id: customer.id,
                    dispute_status: {
                        in: ["New", "Under_Review", "Awaiting_Update"],
                    },
                },
                select: {
                    id: true,
                },
            });

            // Transform invoices to match PortalInvoice type
            const portalInvoices: PortalInvoice[] = invoices.map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoice_number || "N/A",
                amount: invoice.amount || 0,
                customerAmount: invoice?.customer_amount || 0,
                dueDate: invoice.due_date?.toISOString() || "N/A",
                totalPaid: invoice.total_paid || 0,
                customerTotalPaid: invoice?.customer_total_paid || 0,
                outstandingDebt: invoice.outstanding_debt || 0,
                customerOutstandingDebt: invoice.customer_outstanding_debt || 0,
                status: invoice.status || "Unknown",
                customerCurrency: invoice?.customer_currency || "",
                currency: "USD", // Default currency, can be enhanced later
            }));

            return {
                customer_id: customer.id,
                invoices: portalInvoices,
                reasons: reasons.map((reason) => ({
                    id: reason.id,
                    name: reason.name,
                    editable: reason.editable,
                })),
                isOpenDispute: unresolvedDisputes.length > 0,
            };
        } catch (error) {
            console.error("Error fetching agent portal data:", error);
            return null;
        }
    }

    /**
     * Create dispute using internal DisputeService (for portal use)
     */
    static async createDispute(params: {
        customerId: number;
        comment: string;
        reasonId: number;
        invoiceNumbers?: string[];
    }) {
        const { DisputeService } = await import(
            "@/server/services/DisputeService"
        );
        const disputeService = new DisputeService();

        // Get invoice IDs from invoice numbers
        let invoiceIds: number[] = [];
        if (params.invoiceNumbers && params.invoiceNumbers.length > 0) {
            const invoices = await prisma.invoice.findMany({
                where: {
                    invoice_number: { in: params.invoiceNumbers },
                    customer_id: params.customerId,
                },
                select: { id: true },
            });
            invoiceIds = invoices.map((inv) => inv.id);
        }

        return await disputeService.createDispute({
            customerId: params.customerId,
            userName: "Portal User", // Portal users don't have user accounts
            comment: params.comment,
            invoiceIds: invoiceIds.length > 0 ? invoiceIds : undefined,
            reasonId: params.reasonId,
        });
    }
}
