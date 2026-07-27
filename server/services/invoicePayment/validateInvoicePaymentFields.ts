type InvoicePaymentFieldInput = {
    invoice_id?: number | null;
    invoice_number?: string | null;
};

export function validateInvoicePaymentFields(
    data: InvoicePaymentFieldInput
): void {
    if (data.invoice_id == null) {
        const invoiceNumber = data.invoice_number?.trim();
        if (!invoiceNumber) {
            throw new Error(
                "invoice_number is required when invoice_id is null"
            );
        }
    }
}
