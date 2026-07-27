import type { TFunction } from "i18next";

/**
 * English fallbacks for payment-import validation keys until locale entries are approved.
 * Keys match server-side `import.validation.*` message identifiers.
 */
export const IMPORT_VALIDATION_MESSAGE_FALLBACKS: Record<string, string> = {
    "import.validation.paymentCustomerAmountZero":
        "Customer amount cannot be zero",
    "import.validation.paymentCurrencyMismatch":
        "Payment currency does not match the invoice currency",
    "import.validation.paymentInvoiceRatioUnavailable":
        "Cannot derive base amount: the linked invoice has no valid amount ratio",
};

const PARAM_KEY_SUFFIXES: Record<string, string> = {
    business_unit_not_found: "businessUnit",
    businessUnitAccessDenied: "businessUnit",
    business_unit_access_denied: "businessUnit",
    parent_customer_not_found: "parentCustomerNumber",
    parent_customer_access_denied: "parentCustomerNumber",
    customerNotFound: "businessUnit",
    policyNotFound: "businessUnit",
    policyTopUpNotAssignable: "businessUnit",
    policyNotAssignable: "businessUnit",
    noNamedPolicyMatch: "businessUnit",
};

const TRANSLATION_KEY_WITH_PARAM =
    /^([a-z_]+\.[a-z_]+(?:\.[a-z_]+)*):(.+)$/i;

function getParamNameForKey(lastKeyPart: string): string {
    return PARAM_KEY_SUFFIXES[lastKeyPart] ?? "value";
}

function translateKeyWithParameter(
    fullKey: string,
    paramValue: string,
    t: TFunction
): string | null {
    const keyParts = fullKey.split(".");
    const namespace = keyParts[0];
    const translationKey = keyParts.slice(1).join(".");
    const lastKeyPart = keyParts[keyParts.length - 1];
    const paramName = getParamNameForKey(lastKeyPart);

    const translated = t(translationKey, {
        [paramName]: paramValue,
        ns: namespace,
    });

    if (translated === translationKey || translated === fullKey) {
        return IMPORT_VALIDATION_MESSAGE_FALLBACKS[fullKey] ?? null;
    }

    return translated;
}

function translatePlainImportKey(msg: string, t: TFunction): string | null {
    if (!msg.includes(".") || msg.includes(" ")) {
        return null;
    }

    const keyWithoutNamespace = msg.startsWith("import.")
        ? msg.substring(7)
        : msg;

    const translated = t(keyWithoutNamespace, { ns: "import" });
    if (translated !== keyWithoutNamespace) {
        return translated;
    }

    if (IMPORT_VALIDATION_MESSAGE_FALLBACKS[msg]) {
        return IMPORT_VALIDATION_MESSAGE_FALLBACKS[msg];
    }

    if (keyWithoutNamespace.includes(".")) {
        const [category, ...rest] = keyWithoutNamespace.split(".");
        const suffix = rest.join(".");
        const snakeSuffix = suffix
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");

        const candidates = [
            `${category}.${snakeSuffix}`,
            `actions.${category}_${snakeSuffix}`,
            `fields.${category}_${snakeSuffix}`,
            `messages.${category}_${snakeSuffix}`,
        ];

        for (const candidate of candidates) {
            const candidateTranslation = t(candidate, { ns: "import" });
            if (candidateTranslation !== candidate) {
                return candidateTranslation;
            }
        }
    }

    return IMPORT_VALIDATION_MESSAGE_FALLBACKS[msg] ?? null;
}

/**
 * Resolve import result/validation messages that may be i18n keys, optionally with parameters.
 * Falls back to English defaults for payment amount derivation errors when locale keys are absent.
 */
export function translateImportMessage(message: string, t: TFunction): string {
    if (!message || typeof message !== "string") {
        return message;
    }

    const msg = message.trim();
    if (!msg) {
        return message;
    }

    if (msg.includes(", ") && msg.includes(":")) {
        const parts = msg.split(", ");
        return parts
            .map((part) => {
                const trimmedPart = part.trim();
                const match = trimmedPart.match(TRANSLATION_KEY_WITH_PARAM);
                if (!match) {
                    return trimmedPart;
                }
                const [, fullKey, paramValue] = match;
                return (
                    translateKeyWithParameter(fullKey, paramValue, t) ??
                    trimmedPart
                );
            })
            .join(", ");
    }

    const match = msg.match(TRANSLATION_KEY_WITH_PARAM);
    if (match) {
        const [, fullKey, paramValue] = match;
        return translateKeyWithParameter(fullKey, paramValue, t) ?? msg;
    }

    return translatePlainImportKey(msg, t) ?? msg;
}
