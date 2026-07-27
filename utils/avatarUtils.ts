/**
 * Avatar Utilities
 *
 * Shared utilities for generating consistent avatar colors and handling avatar-related functionality
 */

// Pastel color palette for avatars
export const PASTEL_COLORS = [
    "#FFB3BA", // Light pink
    "#FFDFBA", // Light peach
    "#FFFFBA", // Light yellow
    "#BAFFC9", // Light mint
    "#BAE1FF", // Light blue
    "#E0BBE4", // Light lavender
    "#FFCCCB", // Light coral
    "#B4E4D9", // Light turquoise
    "#F0E68C", // Light khaki
    "#DDA0DD", // Light plum
    "#98D8C8", // Light seafoam
    "#F7DC6F", // Light gold
    "#AED6F1", // Light sky blue
    "#F8BBD0", // Light rose
    "#C5E1A5", // Light green
    "#FFCCBC", // Light apricot
];

/**
 * Generate a consistent pastel color for a user based on their ID
 *
 * @param userId - The user ID to generate a color for
 * @returns A hex color string (e.g., "#FFB3BA")
 *
 * @example
 * ```ts
 * const color = getPastelColorForUser("user-123");
 * // Returns: "#BAE1FF" (consistent for this user ID)
 * ```
 */
export const getPastelColorForUser = (userId: string): string => {
    if (!userId) {
        // Return a default color for empty/null user IDs
        return PASTEL_COLORS[0];
    }

    // Simple hash function to convert string to number
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        const char = userId.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Use absolute value and modulo to get index
    const index = Math.abs(hash) % PASTEL_COLORS.length;
    return PASTEL_COLORS[index];
};

/**
 * Convert hex color to format for ui-avatars.com API (remove # and uppercase)
 *
 * @param hex - Hex color string (e.g., "#FFB3BA" or "FFB3BA")
 * @returns Hex color string without # and in uppercase (e.g., "FFB3BA")
 *
 * @example
 * ```ts
 * const formatted = hexToUiAvatarsFormat("#FFB3BA");
 * // Returns: "FFB3BA"
 * ```
 */
export const hexToUiAvatarsFormat = (hex: string): string => {
    // Remove # if present and return uppercase
    return hex.replace("#", "").toUpperCase();
};

/**
 * Generate a ui-avatars.com URL with pastel background color
 *
 * @param name - User name to display in avatar
 * @param userId - User ID for consistent color generation
 * @param size - Avatar size in pixels (default: 32)
 * @returns URL string for ui-avatars.com API
 *
 * @example
 * ```ts
 * const url = generatePastelAvatarUrl("John Doe", "user-123", 48);
 * // Returns: "https://ui-avatars.com/api/?name=John+Doe&background=BAE1FF&color=333&size=48"
 * ```
 */
export const generatePastelAvatarUrl = (
    name: string,
    userId: string,
    size: number = 32
): string => {
    const pastelColor = getPastelColorForUser(userId);
    const colorHex = hexToUiAvatarsFormat(pastelColor);
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${colorHex}&color=333&size=${size}`;
};
