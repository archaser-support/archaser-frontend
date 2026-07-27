import { InvoiceInput } from "./InvoiceService";

export interface InvoicePaymentInput {
    account_id: number;
    company_code: string;
    customer_number: string;
    invoice_number: string;
    payment_date: string;
    amount?: number;
    payment_method?: string;
    reference?: string;
    customer_currency: string;
    customer_amount: number;
}

export interface CustomerInput {
    name: string;
    customer_number: string;
    company_code: string;
    country_iso2: string;
    state_iso2?: string;
    city?: string;
    address_line1?: string;
    address_line2?: string;
    postal_code?: string;
    owner_email?: string;
    business_unit?: string;
    parent_customer_number?: string;
    /** Company registration number (CRN / מספר ח.פ.). */
    crn?: string | null;
    // mobile?: string; // if you enable later
}

export interface ContactInput {
    first_name: string;
    last_name?: string;
    customer_number: string;
    erp_contact_id?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    role?: string;
    company_wide_address?: boolean;
    receives_standard_reminder?: boolean;
    receives_escalated_reminder?: boolean;
    generic_text1?: string;
    generic_text2?: string;
    generic_number1?: number;
    generic_number2?: number;
    generic_date1?: string;
    generic_date2?: string;
}

export class ImportService {
    static normalizeDateInput(value: unknown): string | null | undefined {
        if (value === null || value === undefined || value === "") {
            return value as null | undefined;
        }

        if (typeof value === "number") {
            return ImportService.excelSerialDateToISODate(value);
        }

        if (value instanceof Date) {
            return value.toISOString().split("T")[0];
        }

        if (typeof value === "string") {
            const dateObj = new Date(value);
            if (!isNaN(dateObj.getTime())) {
                return dateObj.toISOString().split("T")[0];
            }
            return value;
        }

        return String(value);
    }

    static excelSerialDateToISODate(serial: number): string {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel base date
        const msOffset = serial * 24 * 60 * 60 * 1000;
        const date = new Date(excelEpoch.getTime() + msOffset);
        return date.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    private static toOptionalPaymentNumber(
        value: unknown
    ): number | undefined {
        if (value === null || value === undefined || value === "") {
            return undefined;
        }
        const parsed =
            typeof value === "string" ? parseFloat(value) : Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }

    static normalizePaymentInput(record: any): InvoicePaymentInput {
        let paymentDateStr = "";

        if (typeof record.payment_date === "number") {
            paymentDateStr = ImportService.excelSerialDateToISODate(
                record.payment_date
            );
        } else if (record.payment_date instanceof Date) {
            paymentDateStr = record.payment_date.toISOString().split("T")[0];
        } else if (typeof record.payment_date === "string") {
            const dateObj = new Date(record.payment_date);
            if (!isNaN(dateObj.getTime())) {
                paymentDateStr = dateObj.toISOString().split("T")[0];
            } else {
                paymentDateStr = record.payment_date;
            }
        }

        return {
            account_id: Number(record.account_id),
            company_code: String(record.company_code).trim(),
            customer_number: String(record.customer_number),
            invoice_number: String(record.invoice_number).trim(),
            payment_date: paymentDateStr,
            amount: ImportService.toOptionalPaymentNumber(record.amount),
            customer_amount: Number(record.customer_amount),
            payment_method: record.payment_method
                ? String(record.payment_method).trim()
                : "",
            customer_currency: String(record.customer_currency).trim(),
            reference: record.reference ? String(record.reference).trim() : "",
        };
    }

    static normalizeInvoiceInput(
        invoice: any,
        account_id: number
    ): InvoiceInput {
        // Convert date values (string/Date/Excel serial) to ISO date strings for Joi validation.
        const normalizedInvoice = {
            ...invoice,
            account_id,
            customer_number: String(invoice.customer_number),
            invoice_number: String(invoice.invoice_number),
            credit_for_invoice_number: invoice.credit_for_invoice_number
                ? String(invoice.credit_for_invoice_number)
                : undefined,
            invoice_date: ImportService.normalizeDateInput(invoice.invoice_date),
            due_date: ImportService.normalizeDateInput(invoice.due_date),
        };

        return normalizedInvoice;
    }

    static validateInvoiceData(invoice: any): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        // Check required fields
        if (!invoice.invoice_number) {
            errors.push("Invoice number is required");
        }

        if (!invoice.invoice_date) {
            errors.push("Invoice date is required");
        }

        if (!invoice.due_date) {
            errors.push("Due date is required");
        }

        // Check amount validity - amount is required and must be a valid number
        if (
            invoice.amount === null ||
            invoice.amount === undefined ||
            invoice.amount === ""
        ) {
            errors.push("Amount is required and cannot be empty");
        } else {
            const numAmount = Number(invoice.amount);
            if (isNaN(numAmount)) {
                errors.push("Amount must be a valid number");
            }
            // Note: We allow negative amounts for credit invoices and zero amounts, so no validation for <= 0
        }

        // Check date validity
        if (
            invoice.invoice_date &&
            isNaN(new Date(invoice.invoice_date).getTime())
        ) {
            errors.push("Invalid invoice date format");
        }

        if (invoice.due_date && isNaN(new Date(invoice.due_date).getTime())) {
            errors.push("Invalid due date format");
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    static normalizeCustomerInput(record: any): CustomerInput {
        let countryCode = String(record.country_iso2).trim();

        if (countryCode === "UK" || countryCode === "uk") {
            countryCode = "GB";
        }

        // Handle both customer_number and temp__customer_number for backward compatibility
        const customerNumber =
            record.customer_number || record.temp__customer_number;
        if (!customerNumber || customerNumber === "undefined") {
            throw new Error("Customer number is required");
        }

        return {
            name: String(record.name).trim(),
            customer_number: String(customerNumber).trim(),
            company_code: record.company_code
                ? String(record.company_code).trim()
                : "",
            country_iso2: countryCode,
            state_iso2: record.state_iso2
                ? String(record.state_iso2).trim()
                : undefined,
            city: record.city ? String(record.city).trim() : undefined,
            address_line1: record.address_line1
                ? String(record.address_line1).trim()
                : undefined,
            address_line2: record.address_line2
                ? String(record.address_line2).trim()
                : undefined,
            postal_code: record.postal_code
                ? String(record.postal_code).trim()
                : undefined,
            owner_email: record.owner_email
                ? String(record.owner_email).trim()
                : undefined,
            business_unit: record.business_unit
                ? String(record.business_unit).trim()
                : undefined,
            parent_customer_number: record.parent_customer_number
                ? String(record.parent_customer_number).trim()
                : undefined,
            crn:
                record.crn === undefined
                    ? undefined
                    : record.crn === null ||
                        String(record.crn).trim() === ""
                      ? null
                      : String(record.crn).trim(),
            // mobile: record.mobile ? String(record.mobile).trim() : undefined,
        };
    }

    /** Parse boolean from CSV/Excel common formats; used by customer import. */
    static parseImportBoolean(value: unknown): boolean {
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "number") {
            return value === 1;
        }
        if (typeof value === "string") {
            const s = value.toLowerCase().trim();
            if (s === "true" || s === "1" || s === "yes" || s === "y") {
                return true;
            }
            if (s === "false" || s === "0" || s === "no" || s === "n" || s === "") {
                return false;
            }
        }
        return Boolean(value);
    }

    static normalizeContactInput(record: any): ContactInput {
        // Helper function to parse boolean values from various formats
        const parseBoolean = (value: any): boolean => {
            if (typeof value === "boolean") {
                return value;
            }
            if (typeof value === "string") {
                const lowerValue = value.toLowerCase().trim();
                return (
                    lowerValue === "true" ||
                    lowerValue === "1" ||
                    lowerValue === "yes" ||
                    lowerValue === "y" ||
                    lowerValue === "on"
                );
            }
            if (typeof value === "number") {
                return value === 1;
            }
            return false;
        };

        const parseOptionalNumber = (value: any): number | undefined => {
            if (value === null || value === undefined || value === "") {
                return undefined;
            }
            if (typeof value === "number" && !isNaN(value)) {
                return value;
            }
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
                    return undefined;
                }
                const parsed = parseFloat(trimmed);
                return isNaN(parsed) ? undefined : parsed;
            }
            return undefined;
        };

        const parseOptionalDateString = (value: any): string | undefined => {
            if (value === null || value === undefined || value === "") {
                return undefined;
            }
            if (typeof value === "string") {
                const trimmed = value.trim();
                if (trimmed === "" || trimmed === "null" || trimmed === "undefined") {
                    return undefined;
                }
                const date = new Date(trimmed);
                return isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
            }
            if (typeof value === "number") {
                const date = new Date(value);
                return isNaN(date.getTime()) ? undefined : date.toISOString().slice(0, 10);
            }
            return undefined;
        };

        const result: ContactInput = {
            first_name: String(record.first_name).trim(),
            last_name: record.last_name
                ? String(record.last_name).trim()
                : undefined,
            customer_number: String(record.customer_number),
            email: record.email ? String(record.email).trim() : undefined,
            phone: record.phone ? String(record.phone).trim() : undefined,
            mobile: record.mobile ? String(record.mobile).trim() : undefined,
            role: record.role ? String(record.role).trim() : undefined,
            company_wide_address: parseBoolean(record.company_wide_address),
            receives_standard_reminder: parseBoolean(
                record.receives_standard_reminder
            ),
            receives_escalated_reminder: parseBoolean(
                record.receives_escalated_reminder
            ),
        };

        if (record.generic_text1 !== undefined && record.generic_text1 !== null && record.generic_text1 !== "") {
            result.generic_text1 = String(record.generic_text1).trim();
        }
        if (record.generic_text2 !== undefined && record.generic_text2 !== null && record.generic_text2 !== "") {
            result.generic_text2 = String(record.generic_text2).trim();
        }
        const num1 = parseOptionalNumber(record.generic_number1);
        if (num1 !== undefined) result.generic_number1 = num1;
        const num2 = parseOptionalNumber(record.generic_number2);
        if (num2 !== undefined) result.generic_number2 = num2;
        const date1 = parseOptionalDateString(record.generic_date1);
        if (date1 !== undefined) result.generic_date1 = date1;
        const date2 = parseOptionalDateString(record.generic_date2);
        if (date2 !== undefined) result.generic_date2 = date2;

        if (
            record.erp_contact_id !== undefined &&
            record.erp_contact_id !== null &&
            String(record.erp_contact_id).trim() !== ""
        ) {
            result.erp_contact_id = String(record.erp_contact_id).trim();
        }

        return result;
    }
}
