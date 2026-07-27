import { useTranslation } from "react-i18next";

/**
 * Helper function to get the appropriate typography variant based on language
 * @param hebrewVariant - The variant to use for Hebrew
 * @param englishVariant - The variant to use for English (defaults to undefined for standard variants)
 * @returns The appropriate variant string
 */
export const useTypographyVariant = (hebrewVariant: string, englishVariant?: string) => {
    const { i18n } = useTranslation("translation");
    return i18n.language === "he" ? hebrewVariant : (englishVariant || "body1");
};

/**
 * Helper function to get RTL-aware styles
 * @param hebrewStyles - Styles to apply for Hebrew
 * @param englishStyles - Styles to apply for English
 * @returns Combined styles object
 */
export const useRTLStyles = (hebrewStyles: any = {}, englishStyles: any = {}) => {
    const { i18n } = useTranslation("translation");
    return i18n.language === "he" ? hebrewStyles : englishStyles;
};

/**
 * Helper function to get RTL-aware text alignment
 * @returns Object with textAlign and direction properties
 */
export const useRTLAlignment = () => {
    const { i18n } = useTranslation("translation");
    return {
        textAlign: i18n.language === "he" ? "right" : "left",
        direction: i18n.language === "he" ? "rtl" : "ltr",
    };
};

/**
 * Helper function to get RTL-aware flex direction
 * @param reverseForHebrew - Whether to reverse flex direction for Hebrew (default: true)
 * @returns Object with flexDirection property
 */
export const useRTLFlexDirection = (reverseForHebrew: boolean = true) => {
    const { i18n } = useTranslation("translation");
    return {
        flexDirection: i18n.language === "he" && reverseForHebrew ? "row-reverse" : "row",
    };
};

/**
 * Helper function to get RTL-aware margins
 * @param marginValue - The margin value to use (default: 2)
 * @returns Object with margin properties
 */
export const useRTLMargins = (marginValue: number = 2) => {
    const { i18n } = useTranslation("translation");
    return {
        mr: i18n.language === "he" ? 0 : marginValue,
        ml: i18n.language === "he" ? marginValue : 0,
    };
};
