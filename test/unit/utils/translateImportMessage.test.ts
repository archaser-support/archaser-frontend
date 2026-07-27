import { describe, expect, it } from "vitest";

import {
    IMPORT_VALIDATION_MESSAGE_FALLBACKS,
    translateImportMessage,
} from "@/shared/utils/translateImportMessage";

function createMockT(
    translations: Record<string, string> = {}
): (key: string, options?: { ns?: string }) => string {
    return (key: string, options?: { ns?: string }) => {
        const namespacedKey =
            options?.ns && !key.includes(".")
                ? `${options.ns}.${key}`
                : key;
        return translations[namespacedKey] ?? translations[key] ?? key;
    };
}

describe("translateImportMessage", () => {
    it("uses English fallback for payment amount derivation keys when locale is missing", () => {
        const t = createMockT();

        expect(
            translateImportMessage(
                "import.validation.paymentCustomerAmountZero",
                t
            )
        ).toBe(
            IMPORT_VALIDATION_MESSAGE_FALLBACKS[
                "import.validation.paymentCustomerAmountZero"
            ]
        );

        expect(
            translateImportMessage(
                "import.validation.paymentCurrencyMismatch",
                t
            )
        ).toBe(
            IMPORT_VALIDATION_MESSAGE_FALLBACKS[
                "import.validation.paymentCurrencyMismatch"
            ]
        );

        expect(
            translateImportMessage(
                "import.validation.paymentInvoiceRatioUnavailable",
                t
            )
        ).toBe(
            IMPORT_VALIDATION_MESSAGE_FALLBACKS[
                "import.validation.paymentInvoiceRatioUnavailable"
            ]
        );
    });

    it("prefers locale translation over English fallback", () => {
        const t = createMockT({
            "validation.paymentCurrencyMismatch":
                "מטבע התשלום אינו תואם למטבע החשבונית",
        });

        expect(
            translateImportMessage(
                "import.validation.paymentCurrencyMismatch",
                t
            )
        ).toBe("מטבע התשלום אינו תואם למטבע החשבונית");
    });

    it("routes parameterized validation keys through i18n", () => {
        const t = createMockT({
            "validation.businessUnitAccessDenied": "translated-bu-error",
        });

        expect(
            translateImportMessage(
                "import.validation.businessUnitAccessDenied:BU-EAST",
                t
            )
        ).toBe("translated-bu-error");
    });

    it("returns plain messages unchanged", () => {
        const t = createMockT();
        expect(translateImportMessage("Reference ID is required", t)).toBe(
            "Reference ID is required"
        );
    });
});
