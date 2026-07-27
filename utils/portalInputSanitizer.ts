/**
 * Portal Input Sanitizer
 *
 * Sanitizes user input from portal forms to prevent XSS and HTML injection attacks.
 * This utility strips HTML tags, script content, and other potentially malicious content.
 */

/**
 * Patterns that indicate potentially malicious content
 */
const DANGEROUS_HTML_PATTERNS = [
    /<script[\s\S]*?>[\s\S]*?<\/script>/gi, // Script tags with content
    /<script[\s>]/gi, // Opening script tags
    /<\/script>/gi, // Closing script tags
    /<iframe[\s\S]*?>/gi, // Iframe tags
    /<object[\s\S]*?>/gi, // Object tags
    /<embed[\s\S]*?>/gi, // Embed tags
    /<link[\s\S]*?>/gi, // Link tags
    /<style[\s\S]*?>[\s\S]*?<\/style>/gi, // Style tags with content
    /<style[\s>]/gi, // Style tags
    /javascript:/gi, // JavaScript protocol
    /vbscript:/gi, // VBScript protocol
    /data:text\/html/gi, // Data URI HTML
    /on\w+\s*=/gi, // Event handlers (onclick=, onerror=, etc.)
    /expression\s*\(/gi, // CSS expressions
    /url\s*\(\s*["']?javascript/gi, // JavaScript in CSS url()
];

/**
 * HTML entities that need to be escaped
 */
const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
    "`": "&#x60;",
    "=": "&#x3D;",
};

/**
 * Check if a string contains potentially dangerous HTML/script content
 */
export function containsDangerousContent(input: string): boolean {
    if (!input || typeof input !== "string") {
        return false;
    }

    return DANGEROUS_HTML_PATTERNS.some((pattern) => pattern.test(input));
}

/**
 * Strip all HTML tags from a string
 */
export function stripHtmlTags(input: string): string {
    if (!input || typeof input !== "string") {
        return "";
    }

    // Remove all HTML tags
    return input.replace(/<[^>]*>/g, "");
}

/**
 * Escape HTML entities in a string
 */
export function escapeHtml(input: string): string {
    if (!input || typeof input !== "string") {
        return "";
    }

    return input.replace(/[&<>"'`=\/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string for safe display - strips HTML and escapes special characters
 */
export function sanitizePortalInput(
    input: string,
    maxLength: number = 5000
): string {
    if (!input || typeof input !== "string") {
        return "";
    }

    // Step 1: Strip all HTML tags
    let sanitized = stripHtmlTags(input);

    // Step 2: Remove any remaining dangerous patterns
    for (const pattern of DANGEROUS_HTML_PATTERNS) {
        sanitized = sanitized.replace(pattern, "");
    }

    // Step 3: Remove null bytes
    sanitized = sanitized.replace(/\0/g, "");

    // Step 4: Trim whitespace
    sanitized = sanitized.trim();

    // Step 5: Limit length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

/**
 * Sanitize an email address
 */
export function sanitizeEmail(email: string): string {
    if (!email || typeof email !== "string") {
        return "";
    }

    // Remove any HTML/script content first
    let sanitized = stripHtmlTags(email);

    // Only allow valid email characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9@._+-]/g, "");

    // Limit length (max email is 254 chars per RFC)
    if (sanitized.length > 254) {
        sanitized = sanitized.substring(0, 254);
    }

    return sanitized.toLowerCase().trim();
}

/**
 * Sanitize a phone number
 */
export function sanitizePhone(phone: string): string {
    if (!phone || typeof phone !== "string") {
        return "";
    }

    // Only allow digits, plus sign, spaces, hyphens, and parentheses
    let sanitized = phone.replace(/[^0-9+\-\s()]/g, "");

    // Limit length (max reasonable phone number)
    if (sanitized.length > 20) {
        sanitized = sanitized.substring(0, 20);
    }

    return sanitized.trim();
}

/**
 * Sanitize a name field (first name, last name)
 */
export function sanitizeName(name: string): string {
    if (!name || typeof name !== "string") {
        return "";
    }

    // Strip HTML first
    let sanitized = stripHtmlTags(name);

    // Allow letters (including accented), spaces, hyphens, apostrophes
    // This pattern allows basic Latin, extended Latin, Hebrew, Arabic, and common characters
    // Note: Using character ranges instead of Unicode property escapes for ES5 compatibility
    sanitized = sanitized.replace(
        /[^a-zA-ZÀ-ÿĀ-žА-яא-תء-ي\s'-]/g,
        ""
    );

    // Limit length
    if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100);
    }

    return sanitized.trim();
}

/**
 * Validate and sanitize all portal form fields
 */
export interface PortalFormData {
    contact_first_name?: string;
    contact_last_name?: string;
    contact_email?: string;
    contact_mobile?: string;
    contact_comment?: string;
    dispute_comment?: string;
    comment?: string;
    [key: string]: any;
}

export interface SanitizedPortalFormData {
    isValid: boolean;
    errors: string[];
    data: PortalFormData;
}

/**
 * Sanitize all fields in a portal form submission
 */
export function sanitizePortalFormData(
    formData: PortalFormData
): SanitizedPortalFormData {
    const errors: string[] = [];
    const sanitizedData: PortalFormData = { ...formData };

    // Check for dangerous content in any field
    for (const [key, value] of Object.entries(formData)) {
        if (typeof value === "string" && containsDangerousContent(value)) {
            errors.push(
                `Field "${key}" contains potentially dangerous content (HTML/script detected)`
            );
        }
    }

    // Sanitize specific fields
    if (formData.contact_first_name) {
        sanitizedData.contact_first_name = sanitizeName(
            formData.contact_first_name
        );
    }

    if (formData.contact_last_name) {
        sanitizedData.contact_last_name = sanitizeName(
            formData.contact_last_name
        );
    }

    if (formData.contact_email) {
        sanitizedData.contact_email = sanitizeEmail(formData.contact_email);
    }

    if (formData.contact_mobile) {
        sanitizedData.contact_mobile = sanitizePhone(formData.contact_mobile);
    }

    if (formData.contact_comment) {
        sanitizedData.contact_comment = sanitizePortalInput(
            formData.contact_comment,
            5000
        );
    }

    if (formData.dispute_comment) {
        sanitizedData.dispute_comment = sanitizePortalInput(
            formData.dispute_comment,
            5000
        );
    }

    if (formData.comment) {
        sanitizedData.comment = sanitizePortalInput(formData.comment, 5000);
    }

    return {
        isValid: errors.length === 0,
        errors,
        data: sanitizedData,
    };
}
