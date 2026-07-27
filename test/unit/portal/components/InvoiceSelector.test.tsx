import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";
import React from "react";
import { useTranslation } from "react-i18next";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import InvoiceSelector from "@/app/[locale]/portal/[customerUUID]/(sub pages)/create-dispute/InvoiceSelector";
import { PortalInvoice } from "@/types/PortalInvoice";

// Mock Next.js router
vi.mock("next/navigation", () => ({
    useRouter: vi.fn(),
}));

// Mock react-i18next
vi.mock("react-i18next", () => ({
    useTranslation: vi.fn(),
}));

// Mock broadcast utility
vi.mock("@/utils/broadcast", () => ({
    broadcast: {
        postMessage: vi.fn(),
    },
}));

// Mock constants
vi.mock("@/utils/constants", () => ({
    BROADCAST_CONSTANTS: {
        REFRESH_TIMELINE: "REFRESH_TIMELINE",
    },
}));

// Mock components
vi.mock("@/shared/components/portal/InvoiceDisplay", () => ({
    default: ({
        invoices,
        onInvoiceSelect,
        onSelectAll,
        selectedInvoices,
    }: any) => (
        <div data-testid="invoice-display">
            {invoices.map((invoice: PortalInvoice) => (
                <div key={invoice.id} data-testid={`invoice-${invoice.id}`}>
                    <button onClick={() => onInvoiceSelect(invoice.id)}>
                        Select Invoice {invoice.id}
                    </button>
                </div>
            ))}
            <button onClick={() => onSelectAll(true)}>Select All</button>
            <button onClick={() => onSelectAll(false)}>Deselect All</button>
        </div>
    ),
}));

vi.mock("@/shared/components/portal/invoiceColumns", () => ({
    useInvoiceColumns: () => [],
}));

const mockRouter = {
    push: vi.fn(),
};

const mockT = vi.fn((key: string, options?: any) => {
    const translations: Record<string, string> = {
        "portal.dispute_creation.step_select_invoices": "Select Invoices",
        "portal.dispute_creation.step_provide_details": "Provide Details",
        "portal.dispute_creation.step_submit": "Submit",
        "portal.dispute_creation.selected_invoices_label":
            "Selected Invoices ({{count}})",
        "portal.dispute_creation.total_amount_selected":
            "Total Amount: ${{amount}}",
        "portal.dispute_creation.continue_to_details": "Continue to Details",
        "portal.dispute_creation.dispute_reason": "Dispute Reason",
        "portal.dispute_creation.select_dispute_reason":
            "Select a dispute reason",
        "portal.dispute_creation.dispute_message": "Dispute Message",
        "portal.dispute_creation.enter_dispute_message":
            "Enter your dispute message",
        "portal.dispute_creation.submit_dispute": "Submit Dispute",
        "portal.dispute_creation.submitting": "Submitting...",
        "portal.dispute_creation.go_to_homepage": "Go to Homepage",
        "portal.dispute_creation.all_invoices_already_in_disputes":
            "All Invoices Already in Disputes",
        "portal.dispute_creation.all_invoices_already_in_disputes_description":
            "All outstanding invoices are currently being reviewed as part of existing disputes.",
        "portal.dispute_creation.invoices_under_review": "Invoices Under Review",
        "portal.dispute_creation.no_outstanding_invoices":
            "No Outstanding Invoices",
        "portal.dispute_creation.no_outstanding_invoices_description":
            "All outstanding invoices are now part of disputes.",
        "portal.dispute_creation.account_not_found": "Account Not Found",
        "portal.dispute_creation.submit_another_dispute":
            "Submit Another Dispute",
        "portal.dispute_creation.dispute_submitted_successfully":
            "Dispute Submitted Successfully",
        "portal.dispute_creation.validation.select_at_least_one_invoice":
            "Please select at least one invoice",
        "portal.dispute_creation.validation.select_dispute_reason":
            "Please select a dispute reason",
        "portal.dispute_creation.validation.enter_dispute_message":
            "Please enter a dispute message",
        "portal.dispute_creation.validation.dispute_message_help":
            "Please provide specific details about your dispute.",
        "portal.dispute.no_more_invoices_available":
            "No More Invoices Available",
        "portal.dispute.no_more_invoices_available_description":
            "All outstanding invoices are now part of disputes.",
        "portal.general.no_invoices_found": "No invoices found",
        "common.actions.back": "Back",
    };

    let result = translations[key] || key;

    // Handle interpolation
    if (options && typeof result === "string") {
        Object.keys(options).forEach((optionKey) => {
            result = result.replace(
                new RegExp(`{{${optionKey}}}`, "g"),
                options[optionKey]
            );
        });
    }

    return result;
});

const mockI18n = {
    changeLanguage: vi.fn(),
    language: "en",
};

const mockInvoices: PortalInvoice[] = [
    {
        id: 1,
        invoiceNumber: "INV-001",
        amount: 100,
        customerAmount: 100,
        dueDate: "2024-01-01T00:00:00.000Z",
        totalPaid: 0,
        customerTotalPaid: 0,
        outstandingDebt: 100,
        customerOutstandingDebt: 100,
        status: "Open",
        customerCurrency: "USD",
        currency: "USD",
    },
    {
        id: 2,
        invoiceNumber: "INV-002",
        amount: 200,
        customerAmount: 200,
        dueDate: "2024-01-02T00:00:00.000Z",
        totalPaid: 0,
        customerTotalPaid: 0,
        outstandingDebt: 200,
        customerOutstandingDebt: 200,
        status: "Open",
        customerCurrency: "USD",
        currency: "USD",
    },
];

const mockReasons = [
    { id: 1, name: "Billing Error", editable: true },
    { id: 2, name: "Service Not Received", editable: true },
];

const defaultProps = {
    invoices: mockInvoices,
    customer_id: 123,
    reasons: mockReasons,
    customerUUID: "test-uuid",
    sub_domain: "test",
    isStandalone: false,
    hasDisputedInvoices: false,
};

describe.skip("InvoiceSelector (EMFILE Issues)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (useRouter as any).mockReturnValue(mockRouter);
        (useTranslation as any).mockReturnValue({ t: mockT, i18n: mockI18n });

        // Mock fetch for API calls
        global.fetch = vi.fn();

        // Ensure MutationObserver is properly mocked
        (global.MutationObserver as any).mockClear();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Initial Rendering", () => {
        it("should render the stepper with correct steps", () => {
            render(<InvoiceSelector {...defaultProps} />);

            expect(screen.getByText("Select Invoices")).toBeTruthy();
            expect(screen.getByText("Provide Details")).toBeTruthy();
            expect(screen.getByText("Submit")).toBeTruthy();
        });

        it("should render invoice selection step by default", () => {
            render(<InvoiceSelector {...defaultProps} />);

            expect(screen.getByTestId("invoice-display")).toBeTruthy();
            expect(screen.getByText("Selected Invoices (0)")).toBeTruthy();
        });

        it("should show continue button when invoices are selected", () => {
            render(<InvoiceSelector {...defaultProps} />);

            // Select an invoice
            fireEvent.click(screen.getByText("Select Invoice 1"));

            expect(screen.getByText("Continue to Details")).toBeTruthy();
        });
    });

    describe("Invoice Selection", () => {
        it("should allow selecting individual invoices", () => {
            render(<InvoiceSelector {...defaultProps} />);

            fireEvent.click(screen.getByText("Select Invoice 1"));

            expect(screen.getByText("Selected Invoices (1)")).toBeTruthy();
            expect(screen.getByText("Total Amount: $100.00")).toBeTruthy();
        });

        it("should allow selecting all invoices", () => {
            render(<InvoiceSelector {...defaultProps} />);

            fireEvent.click(screen.getByText("Select All"));

            expect(screen.getByText("Selected Invoices (2)")).toBeTruthy();
            expect(screen.getByText("Total Amount: $300.00")).toBeTruthy();
        });

        it("should allow deselecting all invoices", () => {
            render(<InvoiceSelector {...defaultProps} />);

            fireEvent.click(screen.getByText("Select All"));
            fireEvent.click(screen.getByText("Deselect All"));

            expect(screen.getByText("Selected Invoices (0)")).toBeTruthy();
        });
    });

    describe("Dispute Form", () => {
        it("should navigate to dispute form when continue is clicked", () => {
            render(<InvoiceSelector {...defaultProps} />);

            // Select an invoice and continue
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            // Check that dispute form fields are present
            expect(screen.getAllByText(/Dispute Reason/i).length).toBeGreaterThan(0);
            expect(screen.getAllByText(/Dispute Message/i).length).toBeGreaterThan(0);
        });

        it.skip("should show validation errors for empty form submission", async () => {
            render(<InvoiceSelector {...defaultProps} />);

            // Select invoice and go to form
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            // Try to submit without filling form
            fireEvent.click(screen.getByText("Submit Dispute"));

            // Validation errors should appear immediately (no async state change)
            await waitFor(() => {
                expect(
                    screen.queryByText("Please select a dispute reason")
                ).toBeTruthy();
            });
        });
    });

    describe("Dispute Submission", () => {
        it.skip("should submit dispute successfully", async () => {
            // Mock successful API responses
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            render(<InvoiceSelector {...defaultProps} />);

            // Select invoice and fill form
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            // Fill dispute reason
            const reasonSelect = screen.getByText("Select a dispute reason");
            fireEvent.mouseDown(reasonSelect);
            fireEvent.click(screen.getByText("Billing Error"));

            // Fill dispute message
            const messageTextarea = screen.getByPlaceholderText(
                "Enter your dispute message"
            );
            fireEvent.change(messageTextarea, {
                target: { value: "Test dispute message" },
            });

            // Submit
            fireEvent.click(screen.getByText("Submit Dispute"));

            // Wait for success message
            await waitFor(() => {
                expect(screen.queryByText("Dispute Submitted Successfully")).toBeTruthy();
            });
        });

        it("should show loading state during submission", async () => {
            // Mock slow API response
            (global.fetch as any).mockImplementation(
                () =>
                    new Promise((resolve) =>
                        setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: () => ({ success: true }),
                                }),
                            100
                        )
                    )
            );

            render(<InvoiceSelector {...defaultProps} />);

            // Select invoice and fill form
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            // Fill form
            const reasonSelect = screen.getByText("Select a dispute reason");
            fireEvent.mouseDown(reasonSelect);
            fireEvent.click(screen.getByText("Billing Error"));

            const messageTextarea = screen.getByPlaceholderText(
                "Enter your dispute message"
            );
            fireEvent.change(messageTextarea, {
                target: { value: "Test message" },
            });

            // Submit
            fireEvent.click(screen.getByText("Submit Dispute"));

            expect(screen.getByText("Submitting...")).toBeTruthy();
        });
    });

    describe("Success State", () => {
        it.skip("should show success message after submission", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            render(<InvoiceSelector {...defaultProps} />);

            // Complete submission flow
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            const reasonSelect = screen.getByText("Select a dispute reason");
            fireEvent.mouseDown(reasonSelect);
            fireEvent.click(screen.getByText("Billing Error"));

            const messageTextarea = screen.getByPlaceholderText(
                "Enter your dispute message"
            );
            fireEvent.change(messageTextarea, {
                target: { value: "Test message" },
            });

            fireEvent.click(screen.getByText("Submit Dispute"));

            await waitFor(() => {
                expect(
                    screen.queryByText("Dispute Submitted Successfully")
                ).toBeTruthy();
            });

            // After success screen appears, check buttons
            await waitFor(() => {
                expect(screen.queryByText("Submit Another Dispute")).toBeTruthy();
                expect(screen.queryByText("Go to Homepage")).toBeTruthy();
            });
        });

        it.skip('should show "Submit Another Dispute" button with invoices available', async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            render(<InvoiceSelector {...defaultProps} />);

            // Complete submission flow
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            const reasonSelect = screen.getByText("Select a dispute reason");
            fireEvent.mouseDown(reasonSelect);
            fireEvent.click(screen.getByText("Billing Error"));

            const messageTextarea = screen.getByPlaceholderText(
                "Enter your dispute message"
            );
            fireEvent.change(messageTextarea, {
                target: { value: "Test message" },
            });

            fireEvent.click(screen.getByText("Submit Dispute"));

            await waitFor(() => {
                expect(
                    screen.queryByText("Dispute Submitted Successfully")
                ).toBeTruthy();
            });

            // Should show submit another dispute button
            await waitFor(() => {
                expect(screen.queryByText("Submit Another Dispute")).toBeTruthy();
                expect(screen.queryByText("Go to Homepage")).toBeTruthy();
            });
        });
    });

    describe("Error States", () => {
        it("should show account not found message when customer_id is 0", () => {
            render(<InvoiceSelector {...defaultProps} customer_id={0} />);

            expect(screen.getByText("Account Not Found")).toBeTruthy();
        });

        it("should show no outstanding invoices message when no invoices", () => {
            render(<InvoiceSelector {...defaultProps} invoices={[]} />);

            expect(
                screen.getByText("No Outstanding Invoices")
            ).toBeTruthy();
        });

        it("should show all invoices in disputes message when hasDisputedInvoices is true", () => {
            render(
                <InvoiceSelector
                    {...defaultProps}
                    invoices={[]}
                    hasDisputedInvoices={true}
                />
            );

            expect(
                screen.getByText("All Invoices Already in Disputes")
            ).toBeTruthy();
            expect(
                screen.getByText("Invoices Under Review")
            ).toBeTruthy();
        });
    });

    describe("Navigation", () => {
        it("should navigate back from dispute form to invoice selection", () => {
            render(<InvoiceSelector {...defaultProps} />);

            // Go to dispute form
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            // Go back
            fireEvent.click(screen.getByText("Back"));

            expect(screen.getByTestId("invoice-display")).toBeTruthy();
        });

        it.skip("should navigate to homepage from success state", async () => {
            (global.fetch as any).mockResolvedValueOnce({
                ok: true,
                json: async () => ({ success: true }),
            });

            render(<InvoiceSelector {...defaultProps} />);

            // Complete submission flow
            fireEvent.click(screen.getByText("Select Invoice 1"));
            fireEvent.click(screen.getByText("Continue to Details"));

            const reasonSelect = screen.getByText("Select a dispute reason");
            fireEvent.mouseDown(reasonSelect);
            fireEvent.click(screen.getByText("Billing Error"));

            const messageTextarea = screen.getByPlaceholderText(
                "Enter your dispute message"
            );
            fireEvent.change(messageTextarea, {
                target: { value: "Test message" },
            });

            fireEvent.click(screen.getByText("Submit Dispute"));

            await waitFor(() => {
                const homepageButton = screen.queryByText("Go to Homepage");
                expect(homepageButton).toBeTruthy();
            });

            fireEvent.click(screen.getByText("Go to Homepage"));
            expect(mockRouter.push).toHaveBeenCalledWith("/portal/test-uuid");
        });
    });
});
