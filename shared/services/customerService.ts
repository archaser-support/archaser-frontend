import { ActivityContact } from "@/types/db";
import { QueryFunction } from "@tanstack/react-query";

import api from "@/app/api";
import { applyEffectivePolicyFieldsToCustomer } from "@/shared/customerPolicyAdapter";
import { ContactResponse, InvalidContactResponse } from "@/types/contact";
import { Customer, CustomerResponse, CustomerStats } from "@/types/Customer";
import { OpenDisputeResponse } from "@/types/CustomerDispute";
import { DisputeReasonResponse } from "@/types/DisputeReason";
import { InvoiceResponse } from "@/types/Invoice";
import { TimelineResponse } from "@/types/timeline";
import { UserResponse } from "@/types/User";

// Types
interface QueryParams {
    query?: string;
    type?: string;
    status?: string;
    invoice_status?: string | string[];
    page: number;
    limit: number;
    sortField?: string;
    sortDirection?: string;
    accountId?: number;
    customer_id?: number;
    company_id?: number;
    lastId?: number | null;
}

interface ApiError extends Error {
    response?: {
        data?: {
            error?: string;
            message?: string;
        };
        status?: number;
    };
}

// Constants
const API_BASE_URL = "/entities/customers";
const DEFAULT_ERROR_MESSAGE = "Failed to fetch data";

// Helper Functions
const handleApiError = (error: unknown, context: string): never => {
    const apiError = error as ApiError;
    const errorMessage =
        apiError.response?.data?.message ||
        apiError.response?.data?.error ||
        apiError.message ||
        DEFAULT_ERROR_MESSAGE;
    throw new Error(`${context}: ${errorMessage}`);
};

const buildQueryParams = (params: QueryParams): Record<string, string> => {
    const queryParams: Record<string, string> = {
        page: params.page.toString(),
        limit: params.limit.toString(),
    };

    if (params.query) queryParams.search = params.query;
    if (params.type) queryParams.filter = params.type;
    if (params.status) queryParams.status = params.status;
    if (params.invoice_status !== undefined) {
        if (Array.isArray(params.invoice_status)) {
            queryParams.status = params.invoice_status.join(",");
        } else {
            queryParams.status = params.invoice_status;
        }
    }
    if (params.sortField) queryParams.sortField = params.sortField;
    if (params.sortDirection) queryParams.sortDirection = params.sortDirection;
    if (params.accountId) queryParams.account_id = params.accountId.toString();
    if (params.customer_id)
        queryParams.customer_id = params.customer_id.toString();
    if (params.company_id)
        queryParams.company_id = params.company_id.toString();
    if (params.lastId !== undefined && params.lastId !== null)
        queryParams.lastId = params.lastId.toString();

    return queryParams;
};

// Query Functions
export const fetchCustomers: QueryFunction<CustomerResponse> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, QueryParams];

    try {
        const queryParams = buildQueryParams(params);

        const response = await api.get(API_BASE_URL, {
            params: queryParams,
        });

        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch customers");
    }
};

export const fetchCustomersWithoutContact: QueryFunction<
    CustomerResponse
> = async ({ queryKey }) => {
    const [, params] = queryKey as [
        string,
        QueryParams & { selectedUserId?: string | null },
    ];
    try {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page.toString());
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.sortField) queryParams.append("sortField", params.sortField);
        if (params.sortDirection)
            queryParams.append("sortDirection", params.sortDirection);
        if (params.type && params.type !== "All")
            queryParams.append("filterType", params.type);
        if (params.status) queryParams.append("status", params.status);
        if (params.query) queryParams.append("query", params.query);
        if (params.selectedUserId)
            queryParams.append("selectedUserId", params.selectedUserId);

        const response = await api.get(
            `/system/control-center?operation=customers-without-contact&${queryParams.toString()}`
        );
        return response.data;
    } catch (error) {
        throw handleApiError(
            error,
            "Failed to fetch customers without contact"
        );
    }
};

export const fetchCustomersWithInvalidContact: QueryFunction<
    InvalidContactResponse
> = async ({ queryKey }) => {
    const [, params] = queryKey as [string, QueryParams];
    try {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.append("page", params.page.toString());
        if (params.limit) queryParams.append("limit", params.limit.toString());
        if (params.sortField) queryParams.append("sortField", params.sortField);
        if (params.sortDirection)
            queryParams.append("sortDirection", params.sortDirection);
        if (params.type && params.type !== "All")
            queryParams.append("filterType", params.type);
        if (params.status) queryParams.append("status", params.status);
        if (params.query) queryParams.append("query", params.query);

        const response = await api.get(
            `/system/control-center?operation=customers-with-invalid-contact&${queryParams.toString()}`
        );
        return response.data;
    } catch (error) {
        throw handleApiError(
            error,
            "Failed to fetch customers with invalid contact"
        );
    }
};

export const fetchCustomerById: QueryFunction<Customer> = async ({
    queryKey,
}) => {
    const [, customerId] = queryKey as [string, number];
    if (!customerId) {
        throw new Error("Customer ID is required");
    }
    try {
        const requestParams = {
            include: "Customer",
            _t: Date.now(), // Cache busting
        };

        const response = await api.get(`${API_BASE_URL}/${customerId}`, {
            params: requestParams,
        });

        return applyEffectivePolicyFieldsToCustomer(
            response.data as Record<string, unknown>
        ) as Customer;
    } catch (error) {
        throw handleApiError(error, `Account not found`);
    }
};

export const fetchContacts: QueryFunction<ContactResponse> = async ({
    queryKey,
}) => {
    const [, { companyId, page, limit }] = queryKey as [
        string,
        { companyId: number; page: number; limit: number },
    ];
    try {
        const response = await api.get("/entities/contacts", {
            params: {
                company_id: companyId,
                page,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch contacts");
    }
};

export const fetchInvoices: QueryFunction<InvoiceResponse> = async ({
    queryKey,
}) => {
    const [, params] = queryKey as [string, QueryParams];
    try {
        const response = await api.get("/entities/invoices", {
            params: buildQueryParams(params),
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch invoices");
    }
};

// Service function to get all invoices for a customer (including disputed ones)
export const getAllInvoicesForCustomer = async (customerId: number) => {
    try {
        const response = await api.get("/entities/invoices", {
            params: {
                status: "Overdue",
                customer_id: customerId,
                page: 1,
                limit: 50,
                sortField: "due_date",
                sortOrder: "asc",
            },
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch all invoices for customer");
    }
};

// Guest-friendly invoice fetching function for portal components
export const fetchPortalInvoices: QueryFunction<InvoiceResponse> = async ({
    queryKey,
}) => {
    const [, { temp_CustomerUUID }] = queryKey as [
        string,
        { temp_CustomerUUID: string },
    ];
    if (!temp_CustomerUUID) {
        throw new Error("Customer UUID is required");
    }
    try {
        const response = await api.get(
            `/customers/${temp_CustomerUUID}/invoices`
        );
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch portal invoices");
    }
};

export const fetchCustomerTimeLineData = async (params: {
    customer_id: number;
    lastId?: number | null;
    filterType?: string;
}): Promise<TimelineResponse> => {
    const { customer_id, lastId, filterType } = params;

    if (!customer_id || typeof customer_id !== "number") {
        throw new Error("Valid Customer ID is required");
    }

    try {
        const params: Record<string, string> = {
            limit: "10",
            _t: Date.now().toString(), // Cache-busting parameter
        };

        if (lastId) {
            params.last_id = lastId.toString();
        }

        if (filterType && filterType !== "All") {
            params.filter_type = filterType;
        }

        const url = `${API_BASE_URL}/${customer_id}/activity`;
        const response = await api.get(url, { params });

        // Transform the activities into the expected format
        const timeline = (response.data.activities || []).map(
            (activity: any) => {
                // Convert ISO date strings back to Date objects for formatDateForDisplay
                const scheduleTime = new Date(
                    activity.schedule_time || activity.created_at || new Date()
                );
                const actualDeliveryTime = new Date(
                    activity.actual_delivery_time ||
                    activity.schedule_time ||
                    activity.created_at
                );

                // Detect if this is a promise to pay activity (calls, sequence, or system-logged PTP)
                const isPromiseToPay =
                    activity.type === "Promise_to_pay" ||
                    (activity.type === "Call" &&
                        ((activity.title &&
                            activity.title
                                .toLowerCase()
                                .includes("promise to pay")) ||
                            (activity.content &&
                                activity.content
                                    .toLowerCase()
                                    .includes("promise to pay")) ||
                            (activity.ActivitiesSequence &&
                                activity.ActivitiesSequence.category ===
                                "Promise_to_pay")));

                // Detect if this is a dispute-related activity
                const isDisputeRelated =
                    activity.type === "Dispute" ||
                    (activity.type === "Internal" &&
                        ((activity.title &&
                            activity.title.toLowerCase().includes("dispute")) ||
                            (activity.content &&
                                activity.content
                                    .toLowerCase()
                                    .includes("dispute")) ||
                            (activity.title &&
                                activity.title
                                    .toLowerCase()
                                    .includes("dispute resolved")) ||
                            (activity.title &&
                                activity.title
                                    .toLowerCase()
                                    .includes("updated the dispute status"))));

                let badgeText = activity.type;
                if (isPromiseToPay) {
                    badgeText = "Promise_to_pay";
                } else if (isDisputeRelated && activity.type !== "Internal") {
                    // Only change badgeText to "Dispute" if it's not already "Internal"
                    // This ensures Internal activities always show the Article icon
                    badgeText = "Dispute";
                }

                // Extract email subject from template for email activities
                let emailSubject = "";
                if (activity.type === "Email" && activity.ActivitiesTemplate) {
                    // Try to get language-specific subject first
                    // Default to "en" if customer language not available in response
                    const customerLanguage =
                        (activity as any).Customer?.language ||
                        (activity as any).customer?.language ||
                        "en";
                    const languageTemplate =
                        activity.ActivitiesTemplate.ActivityTemplateLanguage?.find(
                            (lang: any) => lang.language === customerLanguage
                        );

                    if (languageTemplate?.email_subject) {
                        emailSubject = languageTemplate.email_subject;
                    } else if (activity.ActivitiesTemplate.email_subject) {
                        // Fallback to default template subject
                        emailSubject =
                            activity.ActivitiesTemplate.email_subject;
                    }
                }

                return {
                    id: activity.id.toString(),
                    schedule_time: scheduleTime,
                    actual_delivery_time: actualDeliveryTime,
                    type: activity.type,
                    title: activity.title || "",
                    title_params: activity.title_params || null,
                    details: [
                        {
                            id: activity.id.toString(),
                            title: activity.title || "",
                            title_params: activity.title_params || null,
                            description: activity.content || "",
                            time: scheduleTime,
                            badgeType: badgeText,
                            badgeText: badgeText,
                            subject: emailSubject || activity.title || "",
                            schedule_calculation: activity.schedule_calculation, // Add schedule calculation field
                            status: activity.status || null, // Add activity status for schedule icon visibility
                            isPortal: activity.isPortal || false,
                            systemGenerated: activity.system_generated || false,
                            attachments: activity.attachments || [],
                            ActivityContacts:
                                activity.ActivityContacts?.map(
                                    (
                                        ac: ActivityContact & {
                                            Contact?: {
                                                first_name: string;
                                                last_name: string | null;
                                                email: string | null;
                                                mobile: string | null;
                                                status: string;
                                            };
                                        }
                                    ) => ({
                                        ...ac,
                                        channel_selection_reason:
                                            ac.channel_selection_reason,
                                        Contact: ac.Contact
                                            ? {
                                                name:
                                                    `${ac.Contact.first_name} ${ac.Contact.last_name || ""}`.trim() ||
                                                    "Unknown Contact",
                                                email: ac.Contact.email,
                                                mobile: ac.Contact.mobile,
                                                status: ac.Contact.status,
                                            }
                                            : null,
                                    })
                                ) || [],
                        },
                    ],
                    isPortal: activity.isPortal || false,
                    systemGenerated: activity.system_generated || false,
                    ActivityContacts:
                        activity.ActivityContacts?.map(
                            (
                                ac: ActivityContact & {
                                    Contact?: {
                                        first_name: string;
                                        last_name: string | null;
                                        email: string | null;
                                        mobile: string | null;
                                        status: string;
                                    };
                                }
                            ) => ({
                                ...ac,
                                channel_selection_reason:
                                    ac.channel_selection_reason,
                                Contact: ac.Contact
                                    ? {
                                        name:
                                            `${ac.Contact.first_name} ${ac.Contact.last_name || ""}`.trim() ||
                                            "Unknown Contact",
                                        email: ac.Contact.email,
                                        mobile: ac.Contact.mobile,
                                        status: ac.Contact.status,
                                    }
                                    : null,
                            })
                        ) || [],
                    status: activity.status || null, // Add activity status for schedule icon visibility
                };
            }
        );

        return {
            timeline: timeline as any,
            totalRecords: response.data.totalRecords || 0,
            nextCursor: response.data.nextCursor || null,
        };
    } catch (error) {
        throw handleApiError(error, "Failed to fetch timeline data");
    }
};

export const fetchOpenDispute: QueryFunction<
    OpenDisputeResponse | null
> = async ({ queryKey }) => {
    const [, customerId] = queryKey as [string, number];
    if (!customerId) {
        throw new Error("Customer ID is required");
    }
    try {
        const response = await api.get(
            `${API_BASE_URL}/${customerId}/disputes/get-open`
        );
        return response.data;
    } catch (error) {
        const apiError = error as ApiError;
        if (apiError.response?.status === 404) {
            return null;
        }
        handleApiError(error, "Failed to fetch dispute");
    }
};

export const fetchUsers: QueryFunction<UserResponse> = async ({
    queryKey,
}): Promise<UserResponse> => {
    const [, customerID, status, page, limit, customerBusinessUnitId] =
        queryKey as [
            string,
            number,
            string,
            number,
            number,
            number | null | undefined,
        ];

    try {
        const response = await api.get("/entities/users", {
            params: {
                account_id: customerID,
                status,
                page,
                limit,
                ...(customerBusinessUnitId != null && {
                    customer_business_unit_id: customerBusinessUnitId,
                }),
            },
        });
        return response.data;
    } catch (error) {
        throw handleApiError(error, "Failed to fetch users");
    }
};

export const fetchDisputeReasons: QueryFunction<
    DisputeReasonResponse
> = async ({ queryKey }) => {
    const [, params] = queryKey as [string, QueryParams];
    try {
        const response = await api.get("/operations/dispute-reasons", {
            params: {
                ...buildQueryParams(params),
                editable: "true",
            },
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch dispute reasons");
    }
};

// Company Management Functions
export const fetchCompanies = async () => {
    try {
        const response = await api.get("/system/company");
        const payload = response.data;
        return Array.isArray(payload) ? payload : payload?.items || [];
    } catch (error) {
        handleApiError(error, "Failed to fetch companies");
    }
};

export const updateCompany = async (companyId: number, name: string) => {
    if (!companyId || !name) {
        throw new Error("Company ID and name are required");
    }
    try {
        const response = await api.put(`/system/company/${companyId}`, {
            name,
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to update company");
    }
};

// Customer Management Functions
export const updateCustomer = async (customer: Partial<Customer>) => {
    if (!customer?.id) {
        throw new Error("Customer ID is required for update");
    }
    try {
        const response = await api.put(
            `${API_BASE_URL}/${customer.id}`,
            customer
        );
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to update customer");
    }
};

// Parent Customer Functions
export const updateCustomerParent = async (
    customerId: number,
    parentCustomerId: number | null
): Promise<Customer> => {
    try {
        const response = await api.put(`${API_BASE_URL}/${customerId}`, {
            parent_customer_id: parentCustomerId,
        });
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to update parent customer");
        throw error;
    }
};

export const getCustomerAggregatedData = async (
    customerId: number
): Promise<{
    aggregatedData: any;
    childCustomers: any[];
    totalDueAmount?: number;
    accountCurrency?: string;
    customerTotalDueAmount1?: number | null;
    customerTotalDueCurrency1?: string | null;
    customerTotalDueAmount2?: number | null;
    customerTotalDueCurrency2?: string | null;
}> => {
    try {
        const response = await api.get(
            `/customers/aggregated-data/${customerId}`
        );
        return response.data;
    } catch (error) {
        handleApiError(error, "Failed to fetch aggregated data");
        throw error;
    }
};

export const searchCustomers = async (
    searchTerm: string,
    options?: { excludeId?: number }
): Promise<Array<Customer & { name?: string }>> => {
    try {
        const response = await api.get("/customers/search", {
            params: {
                q: searchTerm,
                ...(options?.excludeId != null
                    ? { excludeId: options.excludeId }
                    : {}),
            },
        });
        const payload = response.data;
        return payload?.items || payload?.customers || [];
    } catch (error) {
        handleApiError(error, "Failed to search customers");
        throw error;
    }
};

export const searchCustomersForParent = async (
    searchTerm: string,
    excludeId: number
): Promise<Array<Customer & { name?: string }>> =>
    searchCustomers(searchTerm, { excludeId });

// Customer Statistics
export const fetchCustomerStats: QueryFunction<{
    stats: CustomerStats;
}> = async () => {
    try {
        const response = await api.get(`${API_BASE_URL}?stats=true`);
        return { stats: response.data };
    } catch (error) {
        throw handleApiError(error, "Failed to fetch customer statistics");
    }
};

// Stuck Activities Types
export interface StuckActivity {
    id: number;
    type: string;
    title: string;
    schedule_time: string;
    step?: number;
}

export interface StuckActivitiesResponse {
    hasStuckActivities: boolean;
    stuckActivitiesCount: number;
    stuckActivities: StuckActivity[];
}

// Fetch stuck activities for a customer
export const fetchStuckActivities: QueryFunction<
    StuckActivitiesResponse,
    [string, number]
> = async ({ queryKey }) => {
    const [, customerId] = queryKey;

    try {
        const response = await api.get(
            `${API_BASE_URL}/${customerId}/stuck-activities`
        );
        return response.data;
    } catch (error) {
        throw handleApiError(error, "Failed to fetch stuck activities");
    }
};
