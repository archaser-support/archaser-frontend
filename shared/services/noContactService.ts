import { Prisma, contact_status } from "@prisma/client";

/**
 * Shared service for customers without contact queries
 * This ensures consistent logic across all parts of the application
 */

export interface NoContactQueryParams {
    accountId: number;
    ownerFilter: any;
    collectionStatus?: "Active" | "Inactive";
}

/**
 * Get the standardized where clause for customers without contacts
 * This query identifies customers that have NO valid contacts for communication
 */
export function getCustomersWithoutContactWhereClause(
    params: NoContactQueryParams
): Prisma.CustomerWhereInput {
    const { accountId, ownerFilter, collectionStatus = "Active" } = params;

    return {
        account_id: accountId,
        ...ownerFilter,
        collection_status: collectionStatus,
        OR: [
            // Case 1: Person customers (no company)
            {
                type: "Person",
                company_id: null,
            },
            // Case 2: Company customers with company but no valid contacts
            {
                type: "Company",
                company_id: { not: null },
                Company: {
                    Contact: {
                        none: {
                            // Looking for companies with NO valid contacts
                            AND: [
                                { status: contact_status.Active }, // Contact must be active
                                {
                                    OR: [
                                        { phone: { not: null } },
                                        { mobile: { not: null } },
                                        { email: { not: null } },
                                    ],
                                },
                                { receives_standard_reminder: true }, // Must receive standard reminders
                            ],
                        },
                    },
                },
            },
        ],
    };
}

/**
 * What makes a contact "valid" for communication:
 * 1. Contact must be active (status: Active)
 * 2. Contact must have at least one contact method: phone, mobile, OR email
 * 3. Contact must receive standard reminders (receives_standard_reminder: true)
 *
 * A customer is considered "without contact" if:
 * - It's a Person customer with no company (company_id is null)
 * - It's a Company customer with a company that has NO contacts meeting all the above criteria
 */
export const VALID_CONTACT_CRITERIA = {
    ACTIVE_STATUS: "Contact must be active (status: Active)",
    HAS_CONTACT_METHOD:
        "Contact must have at least one contact method (phone, mobile, or email)",
    RECEIVES_REMINDERS:
        "Contact must receive standard reminders (receives_standard_reminder: true)",
} as const;
