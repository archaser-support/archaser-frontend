/**
 * File Validation Utility
 *
 * Provides file content validation using magic numbers (file signatures)
 * to prevent file type spoofing
 */

import * as fs from "fs";

/**
 * File signature (magic number) mappings
 * Maps file signatures to MIME types
 */
const FILE_SIGNATURES: Record<string, string[]> = {
    // Images
    ffd8ff: ["image/jpeg", "image/jpg"],
    "89504e47": ["image/png"],
    "47494638": ["image/gif"],
    "52494646": ["image/webp", "audio/wav", "audio/ogg"], // RIFF header (used by multiple formats)
    "3c737667": ["image/svg+xml"], // SVG starts with <svg
    "3c3f786d6c": ["image/svg+xml"], // SVG as XML

    // PDF
    "255044462d": ["application/pdf"],

    // Microsoft Office
    "504b0304": [
        // ZIP-based formats (Office 2007+)
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
    ],
    d0cf11e0a1b11ae1: [
        // Legacy Office formats
        "application/msword",
        "application/vnd.ms-excel",
    ],

    // Text files
    efbbbf: [
        "text/plain",
        "text/csv",
        "text/html",
        "text/css",
        "text/javascript",
    ], // UTF-8 BOM
    feff: ["text/plain", "text/csv"], // UTF-16 BE BOM
    fffe: ["text/plain", "text/csv"], // UTF-16 LE BOM

    // Audio
    "494433": ["audio/mpeg", "audio/mp3"], // ID3 tag
    fff3: ["audio/mpeg", "audio/mp3"],
    fffb: ["audio/mpeg", "audio/mp3"],
    "4f676753": ["audio/ogg"], // Ogg
    "664c6143": ["audio/aac"], // FLAC
};

/**
 * Get file signature (magic number) from file buffer
 */
function getFileSignature(buffer: Buffer, length: number = 16): string {
    const hex = buffer.slice(0, length).toString("hex").toLowerCase();
    return hex;
}

/**
 * Check if file signature matches expected MIME type
 */
function validateFileSignature(
    buffer: Buffer,
    expectedMimeType: string
): boolean {
    const signature = getFileSignature(buffer, 16);

    // Check direct signature matches
    for (const [sig, mimeTypes] of Object.entries(FILE_SIGNATURES)) {
        if (
            signature.startsWith(sig.toLowerCase()) &&
            mimeTypes.includes(expectedMimeType)
        ) {
            return true;
        }
    }

    // Special handling for text files (they don't have consistent signatures)
    if (expectedMimeType.startsWith("text/")) {
        // Check if content is valid text (printable ASCII or valid UTF-8)
        try {
            const text = buffer.toString("utf-8");
            // Check if it's mostly printable characters
            const printableRatio =
                text.split("").filter((c) => {
                    const code = c.charCodeAt(0);
                    return (
                        (code >= 32 && code <= 126) || // Printable ASCII
                        code === 9 || // Tab
                        code === 10 || // Newline
                        code === 13 // Carriage return
                    );
                }).length / text.length;

            // If more than 80% is printable, consider it valid text
            if (printableRatio > 0.8) {
                return true;
            }
        } catch {
            // Not valid UTF-8, but might still be text in another encoding
            // For security, we'll be conservative and require valid UTF-8
            return false;
        }
    }

    // Special handling for SVG (can start with various XML declarations)
    if (expectedMimeType === "image/svg+xml") {
        const text = buffer.toString("utf-8", 0, Math.min(100, buffer.length));
        if (text.trim().startsWith("<svg") || text.trim().startsWith("<?xml")) {
            return true;
        }
    }

    // For files we can't validate, be conservative
    // Only allow if it's a known safe type
    const safeWithoutSignature = [
        "text/plain",
        "text/csv",
        "text/html",
        "text/css",
        "text/javascript",
    ];
    if (safeWithoutSignature.includes(expectedMimeType)) {
        // Additional check: ensure it's not a binary file
        const hasNullBytes = buffer.includes(0);
        return !hasNullBytes; // Text files shouldn't have null bytes
    }

    return false;
}

/**
 * Validate file content matches declared MIME type
 */
export async function validateFileContent(
    filePath: string,
    declaredMimeType: string
): Promise<{ valid: boolean; reason?: string }> {
    try {
        // Read first 16 bytes to check magic number
        const buffer = Buffer.alloc(16);
        const fd = fs.openSync(filePath, "r");
        fs.readSync(fd, buffer, 0, 16, 0);
        fs.closeSync(fd);

        const isValid = validateFileSignature(buffer, declaredMimeType);

        if (!isValid) {
            return {
                valid: false,
                reason: `File content does not match declared MIME type: ${declaredMimeType}`,
            };
        }

        return { valid: true };
    } catch (error: any) {
        return {
            valid: false,
            reason: `Failed to validate file: ${error.message}`,
        };
    }
}

/**
 * Sanitize filename to prevent path traversal
 */
export function sanitizeFileName(fileName: string): string {
    // Remove path traversal attempts
    let sanitized = fileName
        .replace(/\.\./g, "") // Remove ..
        .replace(/\//g, "_") // Replace / with _
        .replace(/\\/g, "_") // Replace \ with _
        .trim();

    // Remove leading/trailing dots and spaces (Windows issue)
    sanitized = sanitized.replace(/^[.\s]+|[.\s]+$/g, "");

    // Limit length
    if (sanitized.length > 255) {
        const ext = sanitized.substring(sanitized.lastIndexOf("."));
        sanitized = sanitized.substring(0, 255 - ext.length) + ext;
    }

    // Ensure it's not empty
    if (!sanitized || sanitized.length === 0) {
        sanitized = "file";
    }

    return sanitized;
}

/**
 * Validate file size
 */
export function validateFileSize(
    size: number,
    maxSize: number = 5 * 1024 * 1024
): { valid: boolean; reason?: string } {
    if (size === 0) {
        return { valid: false, reason: "File is empty" };
    }

    if (size > maxSize) {
        return {
            valid: false,
            reason: `File size (${(size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size (${(maxSize / 1024 / 1024).toFixed(2)}MB)`,
        };
    }

    return { valid: true };
}
