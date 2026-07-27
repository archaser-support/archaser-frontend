import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import i18n from "i18next";
import React from "react";
import { I18nextProvider , initReactI18next } from "react-i18next";
import { vi, describe, it, beforeEach, expect } from "vitest";

import PortalHeader from "@/app/[locale]/portal/[customerUUID]/components/PortalHeader";

// Mock i18n
i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: "en",
    resources: {
        en: {
            translation: {
                "invoices.invoice_number": "Invoice Number",
                "invoices.original_amount": "Original Amount",
                "invoices.due_date": "Due Date",
                "invoices.amount_paid": "Amount Paid",
                "invoices.amount_owed": "Amount Owed",
            },
        },
        he: {
            translation: {
                "invoices.invoice_number": "מספר חשבונית",
                "invoices.original_amount": "סכום מקורי",
                "invoices.due_date": "תאריך יעד",
                "invoices.amount_paid": "סכום ששולם",
                "invoices.amount_owed": "סכום שנותר",
            },
        },
    },
});

// Mock fetch
global.fetch = vi.fn();

// Mock sessionStorage
const mockSessionStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, "sessionStorage", {
    value: mockSessionStorage,
});

const renderWithI18n = (component: React.ReactElement) => {
    return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe.skip("PortalHeader Language Switching (EMFILE Issues)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (fetch as any).mockResolvedValue({
            ok: true,
            json: async () => ({
                language: "Hebrew",
                invoices: [],
                logo: null,
                customerName: "Test Customer",
            }),
        });
    });

    it("should change language when user clicks language switcher", async () => {
        renderWithI18n(
            <PortalHeader
                customerName="Test Customer"
                logo={null}
                customerUUID="test-uuid"
            />
        );

        // Wait for the component to load
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                "/api/customers/test-uuid/invoices"
            );
        });

        // Find and click the language switcher
        const languageButton = screen.getByLabelText("Change language");
        fireEvent.click(languageButton);

        // Find and click the Hebrew option
        const hebrewOption = screen.getByText("עברית");
        fireEvent.click(hebrewOption);

        // Verify that sessionStorage was set with the user's preference
        expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
            "userLanguagePreference",
            "he"
        );

        // Verify that i18n language was changed
        expect(i18n.language).toBe("he");
    });

    it("should respect user language preference over URL locale", async () => {
        // Set a user preference
        mockSessionStorage.getItem.mockReturnValue("he");

        renderWithI18n(
            <PortalHeader
                customerName="Test Customer"
                logo={null}
                customerUUID="test-uuid"
            />
        );

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                "/api/customers/test-uuid/invoices"
            );
        });

        // Verify that the language is set to Hebrew (user preference) not English (URL locale)
        expect(i18n.language).toBe("he");
    });

    it("should use customer language preference when no user preference is set", async () => {
        // No user preference set
        mockSessionStorage.getItem.mockReturnValue(null);

        renderWithI18n(
            <PortalHeader
                customerName="Test Customer"
                logo={null}
                customerUUID="test-uuid"
            />
        );

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                "/api/customers/test-uuid/invoices"
            );
        });

        // Verify that the language is set to Hebrew (customer preference)
        expect(i18n.language).toBe("he");
    });
});
