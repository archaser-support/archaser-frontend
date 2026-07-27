import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "i18next";
import React from "react";
import { I18nextProvider , initReactI18next } from "react-i18next";
import { vi, describe, it, beforeEach, expect } from "vitest";

import InvoiceDisplay from "@/shared/components/portal/InvoiceDisplay";
import { PortalInvoice } from "@/types/PortalInvoice";

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
                "invoices.no_invoices_found": "No invoices found",
            },
        },
        he: {
            translation: {
                "invoices.invoice_number": "מספר חשבונית",
                "invoices.original_amount": "סכום מקורי",
                "invoices.due_date": "תאריך יעד",
                "invoices.amount_paid": "סכום ששולם",
                "invoices.amount_owed": "סכום שנותר",
                "invoices.no_invoices_found": "לא נמצאו חשבוניות",
            },
        },
    },
});

// Mock useMobileDetection hook
vi.mock("@/shared/hooks/useMobileDetection", () => ({
    useMobileDetection: vi.fn(() => true),
}));

// Mock formatDate utility
vi.mock("@/utils/datetimeOperations", () => ({
    formatDate: (date: string) => "2024-01-01",
}));

const mockInvoices: PortalInvoice[] = [
    {
        id: 1,
        invoiceNumber: "INV-001",
        amount: 1000,
        customerAmount: 1000,
        dueDate: "2024-01-01",
        totalPaid: 500,
        customerTotalPaid: 500,
        outstandingDebt: 500,
        customerOutstandingDebt: 500,
        status: "Active",
        customerCurrency: "USD",
        currency: "USD",
    },
];

const mockColumns = [
    {
        key: "invoiceNumber" as keyof PortalInvoice,
        label: "Invoice Number",
        mobilePriority: 5,
    },
    {
        key: "customerAmount" as keyof PortalInvoice,
        label: "Original Amount",
        mobilePriority: 4,
    },
    {
        key: "dueDate" as keyof PortalInvoice,
        label: "Due Date",
        mobilePriority: 3,
    },
    {
        key: "customerTotalPaid" as keyof PortalInvoice,
        label: "Amount Paid",
        mobilePriority: 2,
    },
    {
        key: "customerOutstandingDebt" as keyof PortalInvoice,
        label: "Amount Owed",
        mobilePriority: 1,
    },
];

const renderWithI18n = (component: React.ReactElement) => {
    return render(<I18nextProvider i18n={i18n}>{component}</I18nextProvider>);
};

describe.skip("InvoiceDisplay RTL Layout (EMFILE Issues)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should display labels correctly in Hebrew RTL mode", () => {
        // Set language to Hebrew
        i18n.changeLanguage("he");

        renderWithI18n(
            <InvoiceDisplay
                invoices={mockInvoices}
                columns={mockColumns}
                isSelectable={false}
                emptyMessage="No invoices found"
            />
        );

        // Check that Hebrew labels are displayed
        expect(screen.getByText("מספר חשבונית")).toBeInTheDocument();
        expect(screen.getByText("סכום מקורי")).toBeInTheDocument();
    });

    it("should display labels correctly in English LTR mode", () => {
        // Set language to English
        i18n.changeLanguage("en");

        renderWithI18n(
            <InvoiceDisplay
                invoices={mockInvoices}
                columns={mockColumns}
                isSelectable={false}
                emptyMessage="No invoices found"
            />
        );

        // Check that English labels are displayed
        expect(screen.getByText("Invoice Number")).toBeInTheDocument();
        expect(screen.getByText("Original Amount")).toBeInTheDocument();
    });

    it("should expand and show additional details when card is clicked", () => {
        i18n.changeLanguage("en");

        renderWithI18n(
            <InvoiceDisplay
                invoices={mockInvoices}
                columns={mockColumns}
                isSelectable={false}
                emptyMessage="No invoices found"
            />
        );

        // Find and click the card to expand it
        const card = screen.getByText("INV-001").closest('[role="button"]');
        if (card) {
            fireEvent.click(card);
        }

        // Check that additional details are shown
        expect(screen.getByText("Due Date")).toBeInTheDocument();
        expect(screen.getByText("Amount Paid")).toBeInTheDocument();
        expect(screen.getByText("Amount Owed")).toBeInTheDocument();
    });

    it("should display desktop table with correct RTL layout in Hebrew", () => {
        // Mock mobile detection to return false (desktop)
        mockUseMobileDetection.mockReturnValue(false);

        i18n.changeLanguage("he");

        renderWithI18n(
            <InvoiceDisplay
                invoices={mockInvoices}
                columns={mockColumns}
                isSelectable={false}
                emptyMessage="No invoices found"
            />
        );

        // Check that Hebrew labels are displayed in the table
        expect(screen.getByText("מספר חשבונית")).toBeInTheDocument();
        expect(screen.getByText("סכום מקורי")).toBeInTheDocument();
    });

    it("should display desktop table with correct LTR layout in English", () => {
        // Mock mobile detection to return false (desktop)
        mockUseMobileDetection.mockReturnValue(false);

        i18n.changeLanguage("en");

        renderWithI18n(
            <InvoiceDisplay
                invoices={mockInvoices}
                columns={mockColumns}
                isSelectable={false}
                emptyMessage="No invoices found"
            />
        );

        // Check that English labels are displayed in the table
        expect(screen.getByText("Invoice Number")).toBeInTheDocument();
        expect(screen.getByText("Original Amount")).toBeInTheDocument();
    });
});
