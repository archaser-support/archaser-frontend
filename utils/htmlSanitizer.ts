/**
 * HTML Sanitization Utility
 *
 * Provides safe HTML sanitization using DOMPurify to prevent XSS attacks
 */

import DOMPurify from "isomorphic-dompurify";

export type SanitizationLevel = "strict" | "moderate" | "permissive";

/**
 * Configuration for different sanitization levels
 */
const sanitizationConfigs: Record<SanitizationLevel, DOMPurify.Config> = {
    strict: {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
    },
    moderate: {
        ALLOWED_TAGS: ["b", "strong", "i", "em", "u", "br", "p", "span"],
        ALLOWED_ATTR: ["class", "style"],
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: true,
    },
    permissive: {
        ALLOWED_TAGS: [
            "b",
            "strong",
            "i",
            "em",
            "u",
            "br",
            "p",
            "span",
            "div",
            "a",
            "ul",
            "ol",
            "li",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
        ],
        ALLOWED_ATTR: ["class", "style", "href", "target", "rel"],
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: true,
        // Allow safe URLs only
        ALLOWED_URI_REGEXP:
            /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    },
};

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * @param dirty - The potentially unsafe HTML string
 * @param level - The sanitization level (strict, moderate, permissive)
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHTML(
    dirty: string | null | undefined,
    level: SanitizationLevel = "moderate"
): string {
    if (!dirty) {
        return "";
    }

    const config = sanitizationConfigs[level];

    // Sanitize the HTML
    const clean = DOMPurify.sanitize(dirty, config as any);

    return String(clean);
}

/**
 * Sanitize HTML for activity titles (allows basic formatting)
 */
export function sanitizeActivityTitle(html: string | null | undefined): string {
    return sanitizeHTML(html, "moderate");
}

/**
 * Sanitize HTML for email content (allows more formatting)
 */
export function sanitizeEmailContent(html: string | null | undefined): string {
    return sanitizeHTML(html, "permissive");
}

/**
 * Sanitize HTML for theme/CSS injection (very strict)
 */
export function sanitizeThemeContent(html: string | null | undefined): string {
    return sanitizeHTML(html, "strict");
}

/**
 * Check if HTML contains potentially dangerous content
 */
export function isHTMLSafe(html: string | null | undefined): boolean {
    if (!html) {
        return true;
    }

    const sanitized = sanitizeHTML(html, "strict");
    // If sanitization removed content, it wasn't safe
    return sanitized === html || sanitized.trim() === html.trim();
}
