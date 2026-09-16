/**
 * Decode literal `\uXXXX` sequences left in Priority error text.
 */
export function decodeJsonUnicodeEscapes(text: string): string {
    return text.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16))
    );
}

/**
 * Format billing-connector / Priority validation messages for UI display.
 * Extracts Priority `error.message` when the payload is embedded JSON and
 * decodes Hebrew `\uXXXX` escapes to real characters.
 */
export function formatPriorityValidationMessage(raw: string): string {
    const text = typeof raw === "string" ? raw : String(raw ?? "");
    if (!text.trim()) {
        return text;
    }

    const priorityMatch = text.match(
        /^(Priority returned \d+:\s*)([\s\S]+)$/i
    );
    if (priorityMatch) {
        const prefix = priorityMatch[1] ?? "";
        const body = (priorityMatch[2] ?? "").trim();
        const extracted = extractPriorityErrorMessage(body);
        if (extracted) {
            return `${prefix}${extracted}`;
        }
        return `${prefix}${decodeJsonUnicodeEscapes(body)}`;
    }

    const extracted = extractPriorityErrorMessage(text.trim());
    if (extracted) {
        return extracted;
    }
    return decodeJsonUnicodeEscapes(text);
}

function extractPriorityErrorMessage(body: string): string | null {
    try {
        const parsed = JSON.parse(body) as {
            error?: { message?: unknown };
            message?: unknown;
        };
        const nested =
            typeof parsed?.error?.message === "string"
                ? parsed.error.message.trim()
                : "";
        const top =
            typeof parsed?.message === "string" ? parsed.message.trim() : "";
        const message = nested || top;
        return message ? decodeJsonUnicodeEscapes(message) : null;
    } catch {
        // Body may still contain an embedded JSON object after a prefix.
    }

    const objectMatch = body.match(/\{[\s\S]*"message"\s*:\s*"((?:\\.|[^"\\])*)"/);
    if (objectMatch?.[1]) {
        try {
            return decodeJsonUnicodeEscapes(
                JSON.parse(`"${objectMatch[1]}"`) as string
            );
        } catch {
            return decodeJsonUnicodeEscapes(objectMatch[1]);
        }
    }
    return null;
}
