"use client";

import { useState } from "react";

import { parseCSV } from "../utility/parseCSV";
import { parseExcel } from "../utility/parseExcel";

export function useFileParser() {
    const [parsedData, setParsedData] = useState<Record<string, any>[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [fileType, setFileType] = useState<string | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Convert Excel serial date number to ISO string
    const excelSerialDateToISODate = (serial: number) => {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30)); // Excel base date
        const msOffset = serial * 24 * 60 * 60 * 1000;
        const date = new Date(excelEpoch.getTime() + msOffset);
        return date.toISOString().split("T")[0]; // return only YYYY-MM-DD
    };

    const normalizeParsedData = (data: Record<string, any>[]) => {
        return data.map((row) => {
            const newRow: Record<string, any> = { ...row };
            Object.keys(newRow).forEach((key) => {
                const value = newRow[key];
                // Only convert to date if:
                // 1. The field name suggests it's a date field, AND
                // 2. The value is a number in Excel date range, AND
                // 3. The value is a whole number (no decimal places for monetary amounts)
                if (
                    typeof value === "number" &&
                    value > 40000 &&
                    value < 60000 &&
                    isDateField(key) &&
                    Number.isInteger(value)
                ) {
                    newRow[key] = excelSerialDateToISODate(value);
                }
                // Handle boolean-like values for common boolean field names
                else if (isBooleanField(key)) {
                    newRow[key] = parseBooleanValue(value);
                }
                // Handle amount fields - prevent Excel date conversion for monetary amounts
                else if (isAmountField(key) && typeof value === "number") {
                    // Keep amount fields as numbers, don't convert to dates
                    newRow[key] = value;
                }
            });
            return newRow;
        });
    };

    // Helper function to identify date fields
    const isDateField = (fieldName: string): boolean => {
        const dateFields = [
            'date',
            'created_at',
            'modified_at',
            'timestamp',
            'time',
            'due_date',
            'invoice_date',
            'payment_date',
            'birth_date',
            'start_date',
            'end_date',
            'expiry_date',
            'expiration_date',
            'valid_from',
            'valid_to',
            'effective_date',
            'issue_date',
            'delivery_date',
            'shipping_date',
            'order_date',
            'purchase_date',
            'sale_date',
            'transaction_date',
            'posted_date',
            'processed_date',
            'completed_date',
            'closed_date',
            'cancelled_date',
            'terminated_date',
            'last_login',
            'last_activity',
            'last_sync',
            'last_updated',
            'last_modified'
        ];

        const fieldLower = fieldName.toLowerCase();
        return dateFields.some(field =>
            fieldLower.includes(field) ||
            fieldLower.includes('_date') ||
            fieldLower.includes('_at') ||
            fieldLower.includes('_time')
        );
    };

    // Helper function to identify amount fields
    const isAmountField = (fieldName: string): boolean => {
        const amountFields = [
            'amount',
            'customer_amount',
            'customer_amount',
            'total_amount',
            'invoice_amount',
            'net_amount',
            'customer_net_amount',
            'total_paid',
            'customer_total_paid',
            'outstanding_amount',
            'customer_outstanding_amount',
            'balance',
            'customer_balance',
            'credit_amount',
            'customer_credit_amount',
            'debit_amount',
            'customer_debit_amount',
            'payment_amount',
            'customer_payment_amount',
            'refund_amount',
            'customer_refund_amount',
            'discount_amount',
            'customer_discount_amount',
            'tax_amount',
            'customer_tax_amount',
            'fee_amount',
            'customer_fee_amount',
            'commission_amount',
            'customer_commission_amount',
            'price',
            'customer_price',
            'cost',
            'customer_cost',
            'value',
            'customer_value',
            'sum',
            'customer_sum',
            'total',
            'customer_total',
            'subtotal',
            'customer_subtotal',
            'grand_total',
            'customer_grand_total',
            'customer_grand_total'
        ];

        const fieldLower = fieldName.toLowerCase();
        return amountFields.some(field =>
            fieldLower.includes(field) ||
            fieldLower.includes('_amount') ||
            fieldLower.includes('_price') ||
            fieldLower.includes('_cost') ||
            fieldLower.includes('_value') ||
            fieldLower.includes('_sum') ||
            fieldLower.includes('_total') ||
            fieldLower.includes('_balance') ||
            fieldLower.includes('_paid') ||
            fieldLower.includes('_credit') ||
            fieldLower.includes('_debit') ||
            fieldLower.includes('_payment') ||
            fieldLower.includes('_refund') ||
            fieldLower.includes('_discount') ||
            fieldLower.includes('_tax') ||
            fieldLower.includes('_fee') ||
            fieldLower.includes('_commission')
        );
    };

    // Helper function to identify boolean fields
    const isBooleanField = (fieldName: string): boolean => {
        const booleanFields = [
            'company_wide_address',
            'receives_standard_reminder',
            'receives_escalated_reminder',
            'is_active',
            'is_primary',
            'is_secondary',
            'enabled',
            'disabled',
            'active',
            'inactive'
        ];

        const fieldLower = fieldName.toLowerCase();
        return booleanFields.some(field =>
            fieldLower.includes(field) ||
            fieldLower.includes('boolean') ||
            fieldLower.includes('flag')
        );
    };

    // Helper function to parse boolean values from various formats
    const parseBooleanValue = (value: any): boolean => {
        if (typeof value === "boolean") {
            return value;
        }
        if (typeof value === "string") {
            const lowerValue = value.toLowerCase().trim();
            return lowerValue === "true" ||
                lowerValue === "1" ||
                lowerValue === "yes" ||
                lowerValue === "y" ||
                lowerValue === "on" ||
                lowerValue === "enabled" ||
                lowerValue === "active";
        }
        if (typeof value === "number") {
            return value === 1;
        }
        return false;
    };

    const parseFile = async (file: File) => {
        setIsParsing(true);
        setError(null);
        setParsedData([]);
        setHeaders([]);
        setFileType(file.type);

        try {
            let result: { data: Record<string, any>[]; headers: string[] };

            if (file.type.includes("csv")) {
                result = await parseCSV(file);
            } else if (
                file.type.includes("spreadsheet") ||
                file.type.includes("excel") ||
                file.type.includes("sheet")
            ) {
                result = await parseExcel(file);
            } else {
                throw new Error(
                    "Unsupported file type. Please upload a CSV or Excel file."
                );
            }

            const normalizedData = normalizeParsedData(result.data);
            setParsedData(normalizedData);
            setHeaders(result.headers);
            return normalizedData;
        } catch (err: any) {
            setError(err.message || "Failed to parse file.");
            return [];
        } finally {
            setIsParsing(false);
        }
    };

    const clear = () => {
        setParsedData([]);
        setHeaders([]);
        setError(null);
        setFileType(null);
    };

    return {
        parsedData,
        headers,
        parseFile,
        clear,
        isParsing,
        error,
        fileType,
    };
}
