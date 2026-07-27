/**
 * Email Tracking Utilities
 * 
 * This module provides utilities for adding tracking pixels and click tracking
 * to email templates for engagement tracking.
 */

/**
 * Add tracking pixel to email HTML content
 * @param htmlContent - The original HTML content
 * @param messageId - The message ID for tracking
 * @param baseUrl - The base URL of the application (optional, defaults to process.env.NEXT_PUBLIC_BASE_URL)
 * @returns HTML content with tracking pixel added
 */
export function addTrackingPixel(
    htmlContent: string,
    messageId: string,
    baseUrl?: string
): string {
    const trackingUrl = `${baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://archaser.com'}/api/email/track-open?messageId=${encodeURIComponent(messageId)}`;

    const trackingPixel = `
        <img src="${trackingUrl}" 
             width="1" height="1" 
             style="display:none; width:1px; height:1px; border:0;" 
             alt="" 
             border="0" />
    `;

    // Add tracking pixel before closing body tag, or at the end if no body tag
    if (htmlContent.includes('</body>')) {
        return htmlContent.replace('</body>', `${trackingPixel}\n</body>`);
    } else {
        return htmlContent + trackingPixel;
    }
}

/**
 * Add click tracking to links in email HTML content
 * @param htmlContent - The original HTML content
 * @param messageId - The message ID for tracking
 * @param baseUrl - The base URL of the application (optional, defaults to process.env.NEXT_PUBLIC_BASE_URL)
 * @returns HTML content with click tracking added to links
 */
export function addClickTracking(
    htmlContent: string,
    messageId: string,
    baseUrl?: string
): string {
    const baseUrlForTracking = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://archaser.com';

    // Regular expression to find all href attributes in anchor tags
    const linkRegex = /<a\s+([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi;

    return htmlContent.replace(linkRegex, (match, beforeHref, url, afterHref) => {
        // Skip if it's already a tracking link or a mailto/tel link
        if (url.includes('/api/email/track-click') ||
            url.startsWith('mailto:') ||
            url.startsWith('tel:') ||
            url.startsWith('#')) {
            return match;
        }

        // Encode the original URL
        const encodedUrl = encodeURIComponent(url);
        const trackingUrl = `${baseUrlForTracking}/api/email/track-click?messageId=${encodeURIComponent(messageId)}&url=${encodedUrl}`;

        // Replace the href with the tracking URL
        return `<a ${beforeHref}href="${trackingUrl}"${afterHref}>`;
    });
}

/**
 * Add both open and click tracking to email HTML content
 * @param htmlContent - The original HTML content
 * @param messageId - The message ID for tracking
 * @param baseUrl - The base URL of the application (optional, defaults to process.env.NEXT_PUBLIC_BASE_URL)
 * @returns HTML content with both open and click tracking added
 */
export function addEmailTracking(
    htmlContent: string,
    messageId: string,
    baseUrl?: string
): string {
    // First add click tracking to links
    let trackedContent = addClickTracking(htmlContent, messageId, baseUrl);

    // Then add the tracking pixel
    trackedContent = addTrackingPixel(trackedContent, messageId, baseUrl);

    return trackedContent;
}

/**
 * Generate a tracking URL for a specific link
 * @param originalUrl - The original URL to track
 * @param messageId - The message ID for tracking
 * @param baseUrl - The base URL of the application (optional, defaults to process.env.NEXT_PUBLIC_BASE_URL)
 * @returns The tracking URL
 */
export function generateTrackingUrl(
    originalUrl: string,
    messageId: string,
    baseUrl?: string
): string {
    const baseUrlForTracking = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://archaser.com';
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${baseUrlForTracking}/api/email/track-click?messageId=${encodeURIComponent(messageId)}&url=${encodedUrl}`;
}

/**
 * Generate an open tracking pixel URL
 * @param messageId - The message ID for tracking
 * @param baseUrl - The base URL of the application (optional, defaults to process.env.NEXT_PUBLIC_BASE_URL)
 * @returns The tracking pixel URL
 */
export function generateTrackingPixelUrl(
    messageId: string,
    baseUrl?: string
): string {
    const baseUrlForTracking = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'https://archaser.com';
    return `${baseUrlForTracking}/api/email/track-open?messageId=${encodeURIComponent(messageId)}`;
}
