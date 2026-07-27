import {
    Customer,
    Contact,
    CustomerCollectionPeriod,
    CustomerDispute,
    Activity,
    category,
    contact_status,
    invoice_status,
} from "@prisma/client";
import moment from "moment-timezone";

import { prisma } from "@/lib/prisma";
import { LogLevel } from "@/types/enums";

import { ActivityService } from "./ActivityService";
import { ContactService } from "./ContactService";
import { CustomerService } from "./CustomerService";
import { DisputeService } from "./DisputeService";
import { InvoiceService } from "./InvoiceService";
import { LogService } from "./LogService";
import { PaymentService } from "./PaymentService";

/**
 * Consolidated business service containing invoice, payment,
 * customer, contact, and activity logic.
 */
export class BusinessService {
    private customerService: CustomerService;
    private contactService: ContactService;
    private invoiceService: InvoiceService;
    private paymentService: PaymentService;
    private activityService: ActivityService;
    private disputeService: DisputeService;
    private logService: LogService;

    constructor() {
        this.customerService = new CustomerService();
        this.contactService = new ContactService();
        this.invoiceService = new InvoiceService();
        this.paymentService = new PaymentService();
        this.activityService = new ActivityService();
        this.disputeService = new DisputeService();
        this.logService = LogService.getInstance();
    }

    // =================== Invoice Logic ===================
    public async calculateOutstandingAmounts(
        customerIds: number[]
    ): Promise<Map<number, Partial<CustomerCollectionPeriod>>> {
        return CustomerService.calculateOutstandingAmountsForCustomers(customerIds);
    }

    public async markInvoicesProcessed(
        invoiceIds: number[],
        newStatus: invoice_status = "Overdue" as invoice_status
    ): Promise<void> {
        return this.invoiceService.markInvoicesProcessed(
            invoiceIds,
            newStatus
        );
    }

    // =================== Payment Logic ===================
    public async createInvoicePayment(data: {
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
    }) {
        return this.paymentService.createInvoicePayment({
            ...data,
            customer_number: data.customer_number,
        });
    }

    public async processPayment(
        paymentId: number,
        allocations: Array<{ invoiceId: number; amount: number }>
    ): Promise<void> {
        return this.paymentService.processPayment(paymentId, allocations);
    }

    public async schedulePaymentFollowUp(
        paymentId: number,
        followUpDate: Date
    ): Promise<void> {
        return this.paymentService.schedulePaymentFollowUp(
            paymentId,
            followUpDate
        );
    }

    public async getPaymentById(paymentId: number): Promise<any> {
        return this.paymentService.getPaymentById(paymentId);
    }

    // =================== Customer Logic ===================
    public async upsertCustomer(customerData: Partial<Customer>): Promise<Customer> {
        return this.customerService.upsertCustomer(customerData);
    }

    public async getCustomerById(
        customerId: number
    ): Promise<Customer & { contacts: Contact[] }> {
        return this.customerService.getCustomerById(customerId);
    }

    // =================== Contact Logic ===================
    public async getPrimaryContact(customerId: number): Promise<Contact | null> {
        return this.contactService.getPrimaryContact(customerId);
    }

    public async getContactById(id: number): Promise<any> {
        return this.contactService.getContactById(id);
    }

    public async getContacts(params: {
        page?: number;
        limit?: number;
        search?: string;
        companyId?: number;
        status?: string;
    }): Promise<{ contacts: any[]; totalRecords: number }> {
        return this.contactService.getContacts(params);
    }

    public async upsertContact(data: {
        id?: number;
        first_name: string;
        last_name?: string;
        email?: string;
        phone?: string;
        mobile?: string;
        date_of_birth?: string;
        company_id: number;
        status?: contact_status;
        role?: string;

        company_wide_address?: boolean;
    }): Promise<any> {
        return this.contactService.upsertContact(data);
    }

    // =================== Activity Logic ===================
    public async runScheduledTasks(): Promise<void> {
        const startTime = new Date();

        // Initialize tracking
        const taskStats = {
            generateNextActivitiesCompleted: false,
            handleOverdueInvoicesCompleted: false,
            errors: [] as string[],
        };

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                "Starting runScheduledTasks",
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "START",
                    stepNumber: 1,
                }
            );

            // Step 1: Generate next activities
            const generateStart = Date.now();
            await this.generateNextActivities();
            const generateDuration = Date.now() - generateStart;
            taskStats.generateNextActivitiesCompleted = true;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Completed generateNextActivities",
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "GENERATE_NEXT_ACTIVITIES",
                    stepNumber: 2,
                    performanceMetrics: { generateDuration },
                }
            );

            // Step 2: Handle overdue invoices
            const overdueStart = Date.now();
            await this.handleOverdueInvoices();
            const overdueDuration = Date.now() - overdueStart;
            taskStats.handleOverdueInvoicesCompleted = true;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Completed handleOverdueInvoices",
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "HANDLE_OVERDUE_INVOICES",
                    stepNumber: 3,
                    performanceMetrics: { overdueDuration },
                }
            );

            const totalDuration = Date.now() - startTime.getTime();

            await this.logService.logMessage(
                LogLevel.INFO,
                "runScheduledTasks completed successfully",
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "COMPLETE",
                    stepNumber: 4,
                    duration: totalDuration,
                    performanceMetrics: {
                        generateDuration,
                        overdueDuration,
                        totalExecution: totalDuration,
                    },
                    summary: {
                        generateNextActivitiesCompleted:
                            taskStats.generateNextActivitiesCompleted,
                        handleOverdueInvoicesCompleted:
                            taskStats.handleOverdueInvoicesCompleted,
                        errors: taskStats.errors.length,
                    },
                }
            );
        } catch (error: any) {
            const totalDuration = Date.now() - startTime.getTime();
            const errorMsg = `runScheduledTasks failed: ${error.message}`;
            taskStats.errors.push(errorMsg);

            await this.logService.logMessage(
                LogLevel.ERROR,
                errorMsg,
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "ERROR",
                    stepNumber: -1,
                    duration: totalDuration,
                    error: error.message,
                    stack: error.stack,
                    performanceMetrics: { totalExecution: totalDuration },
                }
            );
        } finally {
            // Connection cleanup removed - Prisma manages its own connections
            // Manual disconnection was causing "Engine is not yet connected" errors in serverless

            await this.logService.logMessage(
                LogLevel.INFO,
                "Scheduled tasks completed",
                "BusinessService.runScheduledTasks",
                {
                    processName: "runScheduledTasks",
                    startTime: startTime.toISOString(),
                    taskStats,
                    step: "COMPLETE",
                    stepNumber: 5,
                }
            );
        }
    }

    private async generateNextActivities(): Promise<void> {
        const { activityWorkflowManager } = await import(
            "@/server/cron-jobs/activityWorkflowManager"
        );
        await activityWorkflowManager();
    }

    private async handleOverdueInvoices(): Promise<void> {
        const { handleOverdueInvoices } = await import(
            "@/server/cron-jobs/handleOverdueInvoices"
        );
        await handleOverdueInvoices();
    }

    // =================== Promise to Pay Logic ===================
    private resolveContact(params: {
        contact?: { id: number; name: string } | string;
        customer: any;
    }): { id?: number; name: string } {
        const { contact, customer } = params;

        // Match syncInvoiceLastPaymentPromiseActivities: company-linked contacts first,
        // then customer-level Contact rows (was missing here and caused missing contact id).
        const companyContacts = customer.Company?.Contact ?? [];
        const directContacts = customer.Contact ?? [];
        const preferredContacts =
            companyContacts.length > 0 ? companyContacts : directContacts;
        const primary = preferredContacts[0];

        const getContactName = (): string => {
            if (typeof contact === "object" && contact?.name) {
                return contact.name;
            }

            if (primary) {
                return (
                    `${primary.first_name || ""}${primary.last_name ? ` ${primary.last_name}` : ""}`.trim() ||
                    "Unknown"
                );
            }

            if (customer.Person) {
                const person = customer.Person;
                return (
                    `${person.first_name || ""}${person.last_name ? ` ${person.last_name}` : ""}`.trim() ||
                    "Unknown"
                );
            }

            // Customer.Account is not always included on Prisma payloads — optional chain.
            return customer.Account?.name ?? "Unknown";
        };

        const rawId =
            typeof contact === "object" && contact != null
                ? contact.id
                : primary?.id;
        const resolvedId =
            typeof rawId === "number" &&
            Number.isFinite(rawId) &&
            rawId > 0
                ? rawId
                : undefined;

        return {
            id: resolvedId,
            name: getContactName(),
        };
    }

    /** Prefer loaded relations; then any Contact row for this customer or company (Person.id is not a Contact FK). */
    private async resolveContactWithDbFallback(params: {
        customerId: number;
        explicitContact?: Parameters<
            BusinessService["resolveContact"]
        >[0]["contact"];
        customer: any;
    }): Promise<{ id?: number; name: string }> {
        let resolved = this.resolveContact({
            contact: params.explicitContact,
            customer: params.customer,
        });
        if (
            typeof resolved.id === "number" &&
            Number.isFinite(resolved.id) &&
            resolved.id > 0
        ) {
            return resolved;
        }
        const c = params.customer;
        const fallback = await prisma.contact.findFirst({
            where: {
                OR: [
                    { customer_id: params.customerId },
                    ...(c?.company_id != null
                        ? [{ company_id: c.company_id as number }]
                        : []),
                ],
            },
            orderBy: { id: "asc" },
            select: {
                id: true,
                first_name: true,
                last_name: true,
            },
        });
        if (fallback) {
            const name =
                `${fallback.first_name || ""}${fallback.last_name ? ` ${fallback.last_name}` : ""}`.trim() ||
                resolved.name;
            return { id: fallback.id, name };
        }
        return resolved;
    }

    public async updatePromiseToPay(params: {
        customerId: number;
        promiseDate: Date | string;
        callType?: "incoming" | "outgoing";
        duration?: number;
        contact?:
        | {
            id: number;
            name: string;
            account_id: number;
        }
        | string;
        comment?: string;
        userName: string;
        userId?: string; // Add userId parameter
        timezone?: string;
        isPortal?: boolean;
    }): Promise<any> {
        const startTime = new Date();

        // Initialize tracking
        const promiseStats = {
            customerId: params.customerId,
            originalPromiseDate: params.promiseDate,
            callType: params.callType || "outgoing",
            duration: params.duration || 0,
            userName: params.userName,
            timezone: params.timezone || "UTC",
            isPortal: params.isPortal ?? false,
            dateConversionSteps: [] as string[],
            databaseUpdates: [] as string[],
            activitiesCreated: [] as string[],
            errors: [] as string[],
        };

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                "Starting updatePromiseToPay",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "START",
                    stepNumber: 1,
                    inputData: {
                        customerId: params.customerId,
                        promiseDate: params.promiseDate,
                        callType: params.callType,
                        duration: params.duration,
                        userName: params.userName,
                        timezone: params.timezone,
                        isPortal: params.isPortal,
                    },
                }
            );

            // Step 1: Date conversion
            const dateConversionStart = Date.now();
            let dueDate: Date;

            // if (typeof params.promiseDate === 'string') {
            //     const [year, month, day] = params.promiseDate.split('-').map(Number);
            //     dueDate = new Date(year, month - 1, day);
            //     promiseStats.dateConversionSteps.push(`Parsed string date: ${params.promiseDate} -> ${dueDate.toISOString()}`);
            // } else {
            //     dueDate = new Date(params.promiseDate);
            //     promiseStats.dateConversionSteps.push(`Used Date object: ${dueDate.toISOString()}`);
            // }

            // const dateOnlyString = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
            // promiseStats.dateConversionSteps.push(`Created date-only string: ${dateOnlyString}`);

            const dateConversionDuration = Date.now() - dateConversionStart;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Completed date conversion",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "DATE_CONVERSION",
                    stepNumber: 2,
                    performanceMetrics: { dateConversionDuration },
                    dateConversionDetails: {
                        originalPromiseDate: params.promiseDate,
                        // convertedDueDate: dueDate.toISOString(),
                        // dateOnlyString,
                        conversionSteps: promiseStats.dateConversionSteps,
                    },
                }
            );

            // Step 2: Find collection period
            const findCollectionStart = Date.now();

            const collectionPeriod =
                await prisma.customerCollectionPeriod.findFirst({
                    where: {
                        customer_id: params.customerId,
                        period_end_date: null,
                    },
                    select: {
                        id: true,
                        total_outstanding_amount: true,
                        promise_to_pay_count: true,
                        current_category: true,
                        promise_to_pay_date: true,
                    },
                });

            if (!collectionPeriod) {
                const errorMsg = "Collection period not found";

                promiseStats.errors.push(errorMsg);

                await this.logService.logMessage(
                    LogLevel.ERROR,
                    errorMsg,
                    "BusinessService.updatePromiseToPay",
                    {
                        processName: "updatePromiseToPay",
                        startTime: startTime.toISOString(),
                        promiseStats,
                        step: "COLLECTION_PERIOD_NOT_FOUND",
                        stepNumber: -1,
                    }
                );
                throw new Error(errorMsg);
            }

            const findCollectionDuration = Date.now() - findCollectionStart;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Found collection period",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "FIND_COLLECTION_PERIOD",
                    stepNumber: 3,
                    performanceMetrics: { findCollectionDuration },
                    collectionPeriodDetails: {
                        collectionPeriodId: collectionPeriod.id,
                        currentCategory: collectionPeriod.current_category,
                        currentPromiseToPayDate:
                            collectionPeriod.promise_to_pay_date,
                        promiseToPayCount:
                            collectionPeriod.promise_to_pay_count,
                        totalOutstandingAmount:
                            collectionPeriod.total_outstanding_amount,
                    },
                }
            );

            // Step 3: Update collection period
            const updateStart = Date.now();

            const updatedCollectionPeriod =
                await prisma.customerCollectionPeriod.update({
                    where: { id: collectionPeriod?.id },
                    data: {
                        promise_to_pay_amount:
                            collectionPeriod?.total_outstanding_amount,
                        promise_to_pay_date: new Date(params.promiseDate),
                        promise_to_pay_count:
                            collectionPeriod.promise_to_pay_count + 1,
                    },
                    include: {
                        Customer: {
                            include: {
                                Person: true,
                                Account: {
                                    select: { id: true, name: true },
                                },
                                Contact: {
                                    orderBy: [
                                        {
                                            receives_standard_reminder: "desc",
                                        },
                                        {
                                            receives_escalated_reminder:
                                                "desc",
                                        },
                                    ],
                                    take: 1,
                                },
                                Company: {
                                    include: {
                                        Contact: {
                                            orderBy: [
                                                {
                                                    receives_standard_reminder:
                                                        "desc",
                                                },
                                                {
                                                    receives_escalated_reminder:
                                                        "desc",
                                                },
                                            ],
                                            take: 1,
                                        },
                                    },
                                },
                            },
                        },
                    },
                });

            const updateDuration = Date.now() - updateStart;
            promiseStats.databaseUpdates.push(
                `Updated collection period ${collectionPeriod.id}`
            );
            // promiseStats.databaseUpdates.push(`Set promise_to_pay_date to ${dateOnlyString}`);
            promiseStats.databaseUpdates.push(
                `Incremented promise_to_pay_count to ${updatedCollectionPeriod.promise_to_pay_count}`
            );

            await this.logService.logMessage(
                LogLevel.INFO,
                "Updated collection period",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "UPDATE_COLLECTION_PERIOD",
                    stepNumber: 4,
                    performanceMetrics: { updateDuration },
                    updateDetails: {
                        collectionPeriodId: updatedCollectionPeriod.id,
                        newPromiseToPayDate:
                            updatedCollectionPeriod.promise_to_pay_date,
                        newPromiseToPayCount:
                            updatedCollectionPeriod.promise_to_pay_count,
                        newPromiseToPayAmount:
                            updatedCollectionPeriod.promise_to_pay_amount,
                        databaseUpdates: promiseStats.databaseUpdates,
                    },
                }
            );

            // Step 4: Resolve contact (DB fallback when relations yield no Contact row)
            const contactResolutionStart = Date.now();
            const contact = await this.resolveContactWithDbFallback({
                customerId: params.customerId,
                explicitContact: params.contact,
                customer: updatedCollectionPeriod.Customer,
            });
            const contactResolutionDuration =
                Date.now() - contactResolutionStart;

            await this.logService.logMessage(
                LogLevel.INFO,
                "Resolved contact",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "RESOLVE_CONTACT",
                    stepNumber: 5,
                    performanceMetrics: { contactResolutionDuration },
                    contactDetails: {
                        contactId: contact.id,
                        contactName: contact.name,
                        customerType: updatedCollectionPeriod.Customer.type,
                    },
                }
            );

            // Step 5: Create promise to pay activity
            const activityStart = Date.now();



            await this.activityService.createPromiseToPayLoggedActivity({
                customerId: params.customerId,
                periodId: updatedCollectionPeriod.id,
                promiseDate: params.promiseDate,
                callType: params.callType || "outgoing",
                durationSec: params.duration || 0,
                comment: params.comment || "",
                userName: params.userName,
                userId: params.userId, // Pass userId parameter
                timezone: params.timezone || "UTC",
                contact,
                isPortal: params.isPortal ?? false,
                accountId: updatedCollectionPeriod.Customer?.account_id,
            });
            const activityDuration = Date.now() - activityStart;
            promiseStats.activitiesCreated.push(
                "Created promise to pay logged activity"
            );

            await this.logService.logMessage(
                LogLevel.INFO,
                "Created promise to pay activity",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "CREATE_ACTIVITY",
                    stepNumber: 6,
                    performanceMetrics: { activityDuration },
                    activityDetails: {
                        activityType: "Promise to pay logged",
                        contactId: contact.id,
                        contactName: contact.name,
                        activitiesCreated: promiseStats.activitiesCreated,
                    },
                }
            );

            // Step 6: Update collection period category
            const categoryStart = Date.now();

            // Check if category is already Promise_to_pay
            const isAlreadyPromiseToPay =
                updatedCollectionPeriod.current_category === "Promise_to_pay";

            await this.customerService.updateCollectionPeriodCategory(
                updatedCollectionPeriod.id,
                "Promise_to_pay",
                updatedCollectionPeriod.current_category as category,
                updatedCollectionPeriod.Customer?.account_id,
                updatedCollectionPeriod.customer_id,
                {
                    userId: params.userId,
                    isManualCategoryChange: true,
                    translate: (key: string) => key, // Simple fallback - translation should be handled at display time
                }
            );
            const categoryDuration = Date.now() - categoryStart;
            promiseStats.databaseUpdates.push(
                "Updated category to Promise_to_pay"
            );

            // If category was already Promise_to_pay, we need to manually create scheduled activities
            if (isAlreadyPromiseToPay) {
                try {
                    await this.activityService.createPromiseToPayScheduledActivity(
                        updatedCollectionPeriod.id,
                        params.userId
                    );
                } catch (error) {
                    // Error handled by logging service
                }
            }

            await this.logService.logMessage(
                LogLevel.INFO,
                "Updated collection period category",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "UPDATE_CATEGORY",
                    stepNumber: 7,
                    performanceMetrics: { categoryDuration },
                    categoryDetails: {
                        oldCategory: updatedCollectionPeriod.current_category,
                        newCategory: "Promise_to_pay",
                        databaseUpdates: promiseStats.databaseUpdates,
                    },
                }
            );

            const totalDuration = Date.now() - startTime.getTime();

            await this.logService.logMessage(
                LogLevel.INFO,
                "updatePromiseToPay completed successfully",
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "COMPLETE",
                    stepNumber: 8,
                    duration: totalDuration,
                    performanceMetrics: {
                        dateConversionDuration,
                        findCollectionDuration,
                        updateDuration,
                        contactResolutionDuration,
                        activityDuration,
                        categoryDuration,
                        totalExecution: totalDuration,
                    },
                    summary: {
                        customerId: params.customerId,
                        collectionPeriodId: updatedCollectionPeriod.id,
                        promiseDate: params.promiseDate,
                        contactName: contact.name,
                        dateConversionSteps:
                            promiseStats.dateConversionSteps.length,
                        databaseUpdates: promiseStats.databaseUpdates.length,
                        activitiesCreated:
                            promiseStats.activitiesCreated.length,
                        errors: promiseStats.errors.length,
                    },
                }
            );

            return updatedCollectionPeriod;
        } catch (error) {
            const totalDuration = Date.now() - startTime.getTime();
            const errorMsg = `updatePromiseToPay failed: ${(error as Error).message}`;
            promiseStats.errors.push(errorMsg);

            await this.logService.logMessage(
                LogLevel.ERROR,
                errorMsg,
                "BusinessService.updatePromiseToPay",
                {
                    processName: "updatePromiseToPay",
                    startTime: startTime.toISOString(),
                    promiseStats,
                    step: "ERROR",
                    stepNumber: -1,
                    duration: totalDuration,
                    error: (error as Error).message,
                    stack: (error as Error).stack,
                    performanceMetrics: { totalExecution: totalDuration },
                }
            );

            throw error;
        }
    }

    public async allowNextAutomatedActivity(
        collectionId: number
    ): Promise<void> {
        const startTime = new Date();

        // Initialize tracking
        const allowStats = {
            collectionId,
            updateCompleted: false,
            errors: [] as string[],
        };

        try {
            await this.logService.logMessage(
                LogLevel.INFO,
                "Starting allowNextAutomatedActivity",
                "BusinessService.allowNextAutomatedActivity",
                {
                    processName: "allowNextAutomatedActivity",
                    startTime: startTime.toISOString(),
                    allowStats,
                    step: "START",
                    stepNumber: 1,
                    inputData: {
                        collectionId,
                    },
                }
            );

            const updateStart = Date.now();
            await this.customerService.setCreateNextActivityFlag(
                collectionId,
                true,
                "Automated activity delivery completed"
            );
            const updateDuration = Date.now() - updateStart;
            allowStats.updateCompleted = true;

            const totalDuration = Date.now() - startTime.getTime();

            await this.logService.logMessage(
                LogLevel.INFO,
                "allowNextAutomatedActivity completed successfully",
                "BusinessService.allowNextAutomatedActivity",
                {
                    processName: "allowNextAutomatedActivity",
                    startTime: startTime.toISOString(),
                    allowStats,
                    step: "COMPLETE",
                    stepNumber: 2,
                    duration: totalDuration,
                    performanceMetrics: {
                        updateDuration,
                        totalExecution: totalDuration,
                    },
                    summary: {
                        collectionId,
                        updateCompleted: allowStats.updateCompleted,
                        errors: allowStats.errors.length,
                    },
                }
            );
        } catch (error) {
            const totalDuration = Date.now() - startTime.getTime();
            const errorMsg = `allowNextAutomatedActivity failed: ${(error as Error).message}`;
            allowStats.errors.push(errorMsg);

            await this.logService.logMessage(
                LogLevel.ERROR,
                errorMsg,
                "BusinessService.allowNextAutomatedActivity",
                {
                    processName: "allowNextAutomatedActivity",
                    startTime: startTime.toISOString(),
                    allowStats,
                    step: "ERROR",
                    stepNumber: -1,
                    duration: totalDuration,
                    error: (error as Error).message,
                    stack: (error as Error).stack,
                    performanceMetrics: { totalExecution: totalDuration },
                }
            );

            throw error;
        }
    }
}
