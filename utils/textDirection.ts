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

/** Strip markup and `{template}` tokens so mixed Hebrew emails still detect RTL. */
export function resolveContentTextDirection(
    htmlOrText: string,
    fallback: TextDirection
): TextDirection {
    const stripped = htmlOrText
        .replace(/<[^>]+>/g, " ")
        .replace(/\{[^{}]+\}/g, " ")
        .replace(/&[#a-zA-Z0-9]+;/g, " ");
    return resolveTextDirection(stripped, fallback);
}

const CHART_AXIS_LABEL_SELECTOR = [
    ".apexcharts-yaxis-texts-g text",
    ".apexcharts-xaxis-texts-g text",
    ".recharts-cartesian-axis-tick-value",
].join(", ");

export type TruncatedTextOverflowStyle = {
    overflow: "hidden";
    textOverflow: "ellipsis";
    whiteSpace: "nowrap";
    direction: TextDirection;
};

/** CSS ellipsis whose dots sit on the inline end (left for Hebrew, right for English). */
export function truncatedTextOverflowStyle(
    text: string,
    fallback: TextDirection = "ltr"
): TruncatedTextOverflowStyle {
    return {
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        direction: resolveTextDirection(text, fallback),
    };
}

/**
 * Keep the start of a chart label and append `...`.
 * Pair with `applyChartLabelTextDirection` / `TruncatedChartLabel` so Hebrew
 * shows the dots on the left.
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
    if (maxLength <= 0) return "";
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength)}...`;
}

/** Set SVG/HTML axis-label direction from each label’s first strong letter. */
export function applyChartLabelTextDirection(
    root: ParentNode,
    fallback: TextDirection = "ltr"
): void {
    root.querySelectorAll(CHART_AXIS_LABEL_SELECTOR).forEach((node) => {
        const dir = resolveTextDirection(node.textContent ?? "", fallback);
        node.setAttribute("direction", dir);
        node.setAttribute("unicode-bidi", "plaintext");
        if (node instanceof HTMLElement) {
            node.dir = dir;
            node.style.direction = dir;
        }
    });
}
