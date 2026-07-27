/**
 * Data Anonymization Utilities
 * GDPR-compliant data anonymization functions for account deletion
 */

/**
 * Anonymize email address
 * @param email - Original email address
 * @param id - Account/User/Contact ID
 * @returns Anonymized email in format: deleted_{type}_{id}@anonymized.local
 */
export function anonymizeEmail(
    email: string | null,
    id: number,
    type: "account" | "user" | "contact" = "user"
): string {
    if (!email) {
        return `deleted_${type}_${id}@anonymized.local`;
    }
    return `deleted_${type}_${id}@anonymized.local`;
}

/**
 * Anonymize name
 * @param name - Original name
 * @param id - Account/User/Contact ID
 * @param type - Type of entity
 * @returns Anonymized name in format: "Deleted {Type} {id}"
 */
export function anonymizeName(
    name: string | null,
    id: number,
    type: "account" | "user" | "contact"
): string {
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
    return `Deleted ${typeLabel} ${id}`;
}

/**
 * Anonymize phone number
 * @param phone - Original phone number
 * @returns Redacted phone number
 */
export function anonymizePhone(phone: string | null): string {
    return "***REDACTED***";
}

/**
 * Anonymize activity content by removing email addresses and phone numbers
 * @param content - Original activity content
 * @returns Content with emails and phones replaced with [REDACTED]
 */
export function anonymizeActivityContent(content: string | null): string {
    if (!content) {
        return "";
    }

    let anonymized = content;

    // Email pattern: matches most email formats
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    anonymized = anonymized.replace(emailPattern, "[EMAIL REDACTED]");

    // Phone patterns: matches various international formats
    // Matches: +1-234-567-8900, (123) 456-7890, 123-456-7890, 123.456.7890, +44 20 7123 4567, etc.
    const phonePatterns = [
        /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International format
        /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, // (123) 456-7890
        /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g, // 123-456-7890
        /\d{10,}/g, // 10+ consecutive digits
    ];

    phonePatterns.forEach((pattern) => {
        anonymized = anonymized.replace(pattern, "[PHONE REDACTED]");
    });

    return anonymized;
}

/**
 * Anonymize address object
 * @returns Empty/null address fields
 */
export function anonymizeAddress(): {
    address_line1: null;
    address_line2: null;
    city: null;
    postal_code: null;
    state_id: null;
    country_id: null;
} {
    return {
        address_line1: null,
        address_line2: null,
        city: null,
        postal_code: null,
        state_id: null,
        country_id: null,
    };
}

/**
 * Anonymize account-specific fields
 * @param accountId - Account ID
 * @returns Object with anonymized account fields
 */
export function anonymizeAccountFields(accountId: number): {
    name: string;
    address_line1: null;
    address_line2: null;
    city: null;
    postal_code: null;
    company_number: null;
    sms_from_name: null;
    email_from_name: null;
    email_server_host: null;
    email_from: null;
    email_server_user: null;
    email_server_password: null;
    beneficiary_name: null;
    bank_name: null;
    branch_number: null;
    branch_name: null;
    swift: null;
    iban: null;
    account_number: null;
    bank_comments: null;
} {
    return {
        name: anonymizeName(null, accountId, "account"),
        address_line1: null,
        address_line2: null,
        city: null,
        postal_code: null,
        company_number: null,
        sms_from_name: null,
        email_from_name: null,
        email_server_host: null,
        email_from: null,
        email_server_user: null,
        email_server_password: null,
        beneficiary_name: null,
        bank_name: null,
        branch_number: null,
        branch_name: null,
        swift: null,
        iban: null,
        account_number: null,
        bank_comments: null,
    };
}

/**
 * Anonymize user-specific fields
 * @param userId - User ID (as string)
 * @param numericId - Numeric ID for anonymization
 * @returns Object with anonymized user fields
 */
export function anonymizeUserFields(
    userId: string,
    numericId: number
): {
    email: string;
    name: string;
    first_name: string;
    last_name: string;
    mobile: string;
    image: null;
    password: null;
    resetToken: null;
    resetTokenExpiry: null;
} {
    const anonymizedName = anonymizeName(null, numericId, "user");
    return {
        email: anonymizeEmail(null, numericId, "user"),
        name: anonymizedName,
        first_name: "Deleted",
        last_name: `User ${numericId}`,
        mobile: anonymizePhone(null),
        image: null,
        password: null,
        resetToken: null,
        resetTokenExpiry: null,
    };
}

/**
 * Anonymize contact-specific fields
 * @param contactId - Contact ID
 * @returns Object with anonymized contact fields
 */
export function anonymizeContactFields(contactId: number): {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    mobile: string;
    title: null;
} {
    return {
        first_name: "Deleted",
        last_name: `Contact ${contactId}`,
        email: anonymizeEmail(null, contactId, "contact"),
        phone: anonymizePhone(null),
        mobile: anonymizePhone(null),
        title: null,
    };
}

/**
 * Check if content contains PII (email or phone)
 * @param content - Content to check
 * @returns True if PII detected
 */
export function containsPII(content: string | null): boolean {
    if (!content) {
        return false;
    }

    // Check for email
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
    if (emailPattern.test(content)) {
        return true;
    }

    // Check for phone (10+ consecutive digits or formatted phone)
    const phonePattern =
        /\+?\d{1,4}[-.\s]?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}|\d{10,}/;
    if (phonePattern.test(content)) {
        return true;
    }

    return false;
}
