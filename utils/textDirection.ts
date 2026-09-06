export type TextDirection = "ltr" | "rtl";

/**
 * Strong RTL letters: Hebrew, Arabic, Syriac, Thaana, N'Ko, Samaritan,
 * Mandaic, and Arabic presentation forms.
 */
const RTL_LETTER =
    /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u07C0-\u07EA\u0800-\u083E\u0840-\u085B\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Strong LTR letters: Basic Latin + Latin Extended (covers A–Z and common accents). */
const LTR_LETTER = /[A-Za-z\u00C0-\u024F\u1E00-\u1EFF]/;

/**
 * Resolve input text direction from the first strong letter.
 * Leading spaces are ignored; digits/punctuation are skipped until a letter.
 * Empty / no letters → fallback (usually the app language direction).
 */
export function resolveTextDirection(
    text: string,
    fallback: TextDirection
): TextDirection {
    const withoutLeadingSpace = text.replace(/^\s+/, "");
    for (const char of withoutLeadingSpace) {
        if (RTL_LETTER.test(char)) return "rtl";
        if (LTR_LETTER.test(char)) return "ltr";
    }
    return fallback;
}
