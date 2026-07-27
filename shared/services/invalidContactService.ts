import { Prisma, contact_status } from "@prisma/client";

/**
 * Shared service for invalid contact queries
 * This ensures consistent logic across all parts of the application
 */

export interface InvalidContactQueryParams {
    accountId: number;
    ownerFilter: any;
    collectionStatus?: "Active" | "Inactive";
}

/**
 * Get the standardized where clause for invalid contacts
 * This query identifies contacts that are considered invalid for communication
 */
export function getInvalidContactWhereClause(
    params: InvalidContactQueryParams
): Prisma.ContactWhereInput {
    const { accountId, ownerFilter, collectionStatus = "Active" } = params;

    return {
        Company: {
            Customer: {
                some: {
                    account_id: accountId,
                    ...ownerFilter,
                    collection_status: collectionStatus,
                },
            },
        },
        AND: [
            { status: contact_status.Active }, // Contact must be active
            {
                OR: [
                    {
                        AND: [
                            { phone: null },
                            { mobile: null },
                            { email: null },
                        ],
                    },
                    { email_status: { in: ["Bounced", "Failure"] } },
                    { mobile_status: "Failure" },
                ],
            },
        ],
    };
}

/**
 * Get the standardized where clause for counting customers with invalid contacts
 * This query counts customers (not contacts) that have at least one invalid contact
 */
export function getCustomersWithInvalidContactsWhereClause(
    params: InvalidContactQueryParams
): Prisma.CustomerWhereInput {
    const { accountId, ownerFilter, collectionStatus = "Active" } = params;

    return {
        account_id: accountId,
        ...ownerFilter,
        collection_status: collectionStatus,
        Company: {
            Contact: {
                some: {
                    AND: [
                        { status: contact_status.Active },
                        {
                            OR: [
                                {
                                    AND: [
                                        { phone: null },
                                        { mobile: null },
                                        { email: null },
                                    ],
                                },
                                {
                                    email_status: {
                                        in: ["Bounced", "Failure"],
                                    },
                                },
                                { mobile_status: "Failure" },
                            ],
                        },
                    ],
                },
            },
        },
    };
}

/**
 * What makes a contact "invalid":
 * 1. Missing all contact methods: No phone, no mobile, AND no email
 * 2. Invalid email status: email_status is "Bounced" or "Failure"
 * 3. Invalid mobile status: mobile_status is "Failure"
 */
export const INVALID_CONTACT_CRITERIA = {
    MISSING_ALL_CONTACTS: "Missing all contact methods (phone, mobile, email)",
    EMAIL_BOUNCED: "Email status is Bounced",
    EMAIL_FAILURE: "Email status is Failure",
    MOBILE_FAILURE: "Mobile status is Failure",
} as const;
