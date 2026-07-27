// Comprehensive email validation function
export const validateEmail = (
    email: string,
    t: any
): { isValid: boolean; message?: string } => {
    if (!email.trim()) {
        return { isValid: false, message: t("validation.email_required", { ns: "users" }) };
    }

    // Check for spaces first
    if (email.includes(" ")) {
        return {
            isValid: false,
            message: t("validation.email_cannot_contain_spaces", { ns: "users" }),
        };
    }

    // Check for emails without @ symbol first
    if (!email.includes("@")) {
        return {
            isValid: false,
            message: t("validation.invalid_email_format", { ns: "users" }),
        };
    }

    // Check for emails starting with @
    if (email.startsWith("@")) {
        return {
            isValid: false,
            message: t("validation.email_cannot_start_with_at", { ns: "users" }),
        };
    }

    // Check for emails ending with @
    if (email.endsWith("@")) {
        return {
            isValid: false,
            message: t("validation.email_must_include_domain", { ns: "users" }),
        };
    }

    // Split email into local and domain parts
    const [localPart, domain] = email.split("@");

    if (!localPart || !domain) {
        return {
            isValid: false,
            message: t("validation.invalid_email_format", { ns: "users" }),
        };
    }

    // Check local part length
    if (localPart.length > 64) {
        return { isValid: false, message: t("validation.email_too_long", { ns: "users" }) };
    }

    // Check domain length
    if (domain.length > 253) {
        return {
            isValid: false,
            message: t("validation.domain_too_long", { ns: "users" }),
        };
    }

    // Check for consecutive dots in local part
    if (localPart.includes("..")) {
        return {
            isValid: false,
            message: t("validation.email_cannot_contain_consecutive_dots", { ns: "users" }),
        };
    }

    // Check for consecutive dots in domain
    if (domain.includes("..")) {
        return {
            isValid: false,
            message: t("validation.invalid_domain_format", { ns: "users" }),
        };
    }

    // Check domain format - be more lenient
    const domainRegex =
        /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
    if (!domainRegex.test(domain)) {
        return {
            isValid: false,
            message: t("validation.invalid_domain_format", { ns: "users" }),
        };
    }

    // Check for domains starting or ending with hyphen
    if (domain.startsWith("-") || domain.endsWith("-")) {
        return {
            isValid: false,
            message: t("validation.invalid_domain_format", { ns: "users" }),
        };
    }

    // Check top-level domain - be more lenient
    const parts = domain.split(".");
    const tld = parts[parts.length - 1];

    if (!tld || tld.length < 2) {
        return {
            isValid: false,
            message: t("validation.invalid_top_level_domain", { ns: "users" }),
        };
    }

    // Check for valid characters in local part - be more lenient
    const localPartRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/;
    if (!localPartRegex.test(localPart)) {
        return {
            isValid: false,
            message: t("validation.invalid_local_part", { ns: "users" }),
        };
    }

    // Check for valid characters in domain - be more lenient
    const domainCharRegex = /^[a-zA-Z0-9.-]+$/;
    if (!domainCharRegex.test(domain)) {
        return {
            isValid: false,
            message: t("validation.invalid_domain_format", { ns: "users" }),
        };
    }

    return { isValid: true };
};
