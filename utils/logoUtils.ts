/**
 * Logo Utilities
 *
 * Centralized utilities for handling logo data across the application.
 * Supports multiple image formats (PNG, JPEG, GIF, WebP) with automatic
 * format detection and validation.
 */

// Image format signatures for detection
const IMAGE_SIGNATURES = {
    PNG: [0x89, 0x50, 0x4e, 0x47], // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    JPEG: [0xff, 0xd8, 0xff], // JPEG signature: FF D8 FF
    GIF: [0x47, 0x49, 0x46, 0x38], // GIF signature: 47 49 46 38 (GIF8)
    WEBP: [
        0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ], // WebP signature
} as const;

/**
 * Detects image format from binary data by checking file signatures
 * @param buffer - The image binary data
 * @returns MIME type string (defaults to "image/png")
 */
function detectImageFormat(buffer: Uint8Array): string {
    if (!buffer || buffer.length < 2) {
        return "image/png";
    }

    // Check PNG signature
    if (
        buffer.length >= 4 &&
        buffer[0] === IMAGE_SIGNATURES.PNG[0] &&
        buffer[1] === IMAGE_SIGNATURES.PNG[1] &&
        buffer[2] === IMAGE_SIGNATURES.PNG[2] &&
        buffer[3] === IMAGE_SIGNATURES.PNG[3]
    ) {
        return "image/png";
    }

    // Check JPEG signature
    if (
        buffer.length >= 3 &&
        buffer[0] === IMAGE_SIGNATURES.JPEG[0] &&
        buffer[1] === IMAGE_SIGNATURES.JPEG[1] &&
        buffer[2] === IMAGE_SIGNATURES.JPEG[2]
    ) {
        return "image/jpeg";
    }

    // Check GIF signature
    if (
        buffer.length >= 4 &&
        buffer[0] === IMAGE_SIGNATURES.GIF[0] &&
        buffer[1] === IMAGE_SIGNATURES.GIF[1] &&
        buffer[2] === IMAGE_SIGNATURES.GIF[2] &&
        buffer[3] === IMAGE_SIGNATURES.GIF[3]
    ) {
        return "image/gif";
    }

    // Check WebP signature (simplified check)
    if (
        buffer.length >= 12 &&
        buffer[0] === IMAGE_SIGNATURES.WEBP[0] &&
        buffer[1] === IMAGE_SIGNATURES.WEBP[1] &&
        buffer[2] === IMAGE_SIGNATURES.WEBP[2] &&
        buffer[3] === IMAGE_SIGNATURES.WEBP[3] &&
        buffer[8] === IMAGE_SIGNATURES.WEBP[8] &&
        buffer[9] === IMAGE_SIGNATURES.WEBP[9] &&
        buffer[10] === IMAGE_SIGNATURES.WEBP[10] &&
        buffer[11] === IMAGE_SIGNATURES.WEBP[11]
    ) {
        return "image/webp";
    }

    // Default to PNG if format cannot be detected
    return "image/png";
}

/**
 * Validates if the provided data is a valid image
 * @param buffer - The image data to validate
 * @returns true if valid image, false otherwise
 */
export const isValidImage = (buffer: Uint8Array): boolean => {
    if (!buffer || buffer.length < 2) {
        return false;
    }

    // Check for common image format signatures
    if (
        buffer[0] === IMAGE_SIGNATURES.PNG[0] &&
        buffer[1] === IMAGE_SIGNATURES.PNG[1] &&
        buffer[2] === IMAGE_SIGNATURES.PNG[2] &&
        buffer[3] === IMAGE_SIGNATURES.PNG[3]
    ) {
        return true; // PNG
    }

    if (
        buffer[0] === IMAGE_SIGNATURES.JPEG[0] &&
        buffer[1] === IMAGE_SIGNATURES.JPEG[1] &&
        buffer[2] === IMAGE_SIGNATURES.JPEG[2]
    ) {
        return true; // JPEG
    }

    if (
        buffer[0] === IMAGE_SIGNATURES.GIF[0] &&
        buffer[1] === IMAGE_SIGNATURES.GIF[1] &&
        buffer[2] === IMAGE_SIGNATURES.GIF[2] &&
        buffer[3] === IMAGE_SIGNATURES.GIF[3]
    ) {
        return true; // GIF
    }

    if (
        buffer.length >= 12 &&
        buffer[0] === IMAGE_SIGNATURES.WEBP[0] &&
        buffer[1] === IMAGE_SIGNATURES.WEBP[1] &&
        buffer[2] === IMAGE_SIGNATURES.WEBP[2] &&
        buffer[3] === IMAGE_SIGNATURES.WEBP[3] &&
        buffer[8] === IMAGE_SIGNATURES.WEBP[8] &&
        buffer[9] === IMAGE_SIGNATURES.WEBP[9] &&
        buffer[10] === IMAGE_SIGNATURES.WEBP[10] &&
        buffer[11] === IMAGE_SIGNATURES.WEBP[11]
    ) {
        return true; // WebP
    }

    return false;
};

/**
 * Gets the MIME type for a logo buffer
 * @param buffer - The logo buffer
 * @returns The MIME type string
 */
export const getLogoMimeType = (buffer: Uint8Array): string => {
    return detectImageFormat(buffer);
};

/**
 * Decodes logo data into a data URL string
 * @param logoData - The logo data (string, Uint8Array, or object with data property)
 * @returns A data URL string ready for use in img src
 */
export const decodeLogo = (
    logoData?: string | Uint8Array | { data: Uint8Array }
): string => {
    if (!logoData) {
        return "";
    }

    // If already a string (data URL), return as is
    if (typeof logoData === "string") {
        return logoData;
    }

    // Handle Uint8Array
    if (logoData instanceof Uint8Array) {
        const mimeType = detectImageFormat(logoData);
        return `data:${mimeType};base64,${Buffer.from(logoData).toString("base64")}`;
    }

    // Handle object with data property
    if (logoData && typeof logoData === "object" && "data" in logoData) {
        const mimeType = detectImageFormat(logoData.data);
        return `data:${mimeType};base64,${Buffer.from(logoData.data).toString("base64")}`;
    }

    return "";
};

/**
 * Creates a logo data URL
 * @param logoData - The logo data
 * @returns A data URL string
 */
export const createLogoDataUrl = (
    logoData?: string | Uint8Array | { data: Uint8Array }
): string => {
    try {
        // If already a string (data URL), return as is
        if (typeof logoData === "string") {
            // Validate that it's actually a data URL
            if (logoData.startsWith("data:")) {
                return logoData;
            }
            // If it's not a data URL, treat it as invalid
            return "";
        }

        // Handle Uint8Array
        if (logoData instanceof Uint8Array) {
            if (logoData.length === 0) {
                return "";
            }
            const mimeType = detectImageFormat(logoData);
            return `data:${mimeType};base64,${Buffer.from(logoData).toString("base64")}`;
        }

        // Handle object with data property
        if (logoData && typeof logoData === "object" && "data" in logoData) {
            if (logoData.data instanceof Uint8Array) {
                if (logoData.data.length === 0) {
                    return "";
                }
                const mimeType = detectImageFormat(logoData.data);
                return `data:${mimeType};base64,${Buffer.from(logoData.data).toString("base64")}`;
            } else {
                return "";
            }
        }

        // Handle null/undefined
        if (!logoData) {
            return "";
        }

        // If we get here, the data type is not supported
        return "";
    } catch (error) {
        console.error("createLogoDataUrl: Error processing logo data:", error);
        return "";
    }
};

// Export the detectImageFormat function for use in API routes
export { detectImageFormat };
