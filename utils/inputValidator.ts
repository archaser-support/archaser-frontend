/**
 * Input Validation Utility
 *
 * Provides comprehensive input validation for API endpoints
 */

import { NextApiRequest } from "next";

import { isSuspiciousPayload } from "./payloadScanner";

export interface ValidationRule {
    required?: boolean;
    type?:
    | "string"
    | "number"
    | "boolean"
    | "array"
    | "object"
    | "email"
    | "url";
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    custom?: (value: any) => boolean | string; // Return true if valid, or error message if invalid
}

export interface ValidationSchema {
    [key: string]: ValidationRule | ValidationSchema;
}

export interface ValidationResult {
    valid: boolean;
    errors: Record<string, string>;
    data?: any;
}

/**
 * Validate a single value against a rule
 */
function validateValue(
    value: any,
    rule: ValidationRule,
    fieldName: string
): string | null {
    // Check required
    if (
        rule.required &&
        (value === undefined || value === null || value === "")
    ) {
        return `${fieldName} is required`;
    }

    // If not required and value is empty, skip other validations
    if (
        !rule.required &&
        (value === undefined || value === null || value === "")
    ) {
        return null;
    }

    // Type validation
    if (rule.type) {
        switch (rule.type) {
            case "string":
                if (typeof value !== "string") {
                    return `${fieldName} must be a string`;
                }
                if (
                    rule.minLength !== undefined &&
                    value.length < rule.minLength
                ) {
                    return `${fieldName} must be at least ${rule.minLength} characters`;
                }
                if (
                    rule.maxLength !== undefined &&
                    value.length > rule.maxLength
                ) {
                    return `${fieldName} must be at most ${rule.maxLength} characters`;
                }
                if (rule.pattern && !rule.pattern.test(value)) {
                    return `${fieldName} has invalid format`;
                }
                break;

            case "number":
                const numValue =
                    typeof value === "string" ? parseFloat(value) : value;
                if (isNaN(numValue) || typeof numValue !== "number") {
                    return `${fieldName} must be a number`;
                }
                if (rule.min !== undefined && numValue < rule.min) {
                    return `${fieldName} must be at least ${rule.min}`;
                }
                if (rule.max !== undefined && numValue > rule.max) {
                    return `${fieldName} must be at most ${rule.max}`;
                }
                break;

            case "boolean":
                if (
                    typeof value !== "boolean" &&
                    value !== "true" &&
                    value !== "false"
                ) {
                    return `${fieldName} must be a boolean`;
                }
                break;

            case "array":
                if (!Array.isArray(value)) {
                    return `${fieldName} must be an array`;
                }
                if (
                    rule.minLength !== undefined &&
                    value.length < rule.minLength
                ) {
                    return `${fieldName} must have at least ${rule.minLength} items`;
                }
                if (
                    rule.maxLength !== undefined &&
                    value.length > rule.maxLength
                ) {
                    return `${fieldName} must have at most ${rule.maxLength} items`;
                }
                break;

            case "object":
                if (
                    typeof value !== "object" ||
                    Array.isArray(value) ||
                    value === null
                ) {
                    return `${fieldName} must be an object`;
                }
                break;

            case "email":
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (typeof value !== "string" || !emailRegex.test(value)) {
                    return `${fieldName} must be a valid email address`;
                }
                if (rule.maxLength && value.length > rule.maxLength) {
                    return `${fieldName} must be at most ${rule.maxLength} characters`;
                }
                break;

            case "url":
                try {
                    new URL(value);
                } catch {
                    return `${fieldName} must be a valid URL`;
                }
                break;
        }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
        return `${fieldName} must be one of: ${rule.enum.join(", ")}`;
    }

    // Custom validation
    if (rule.custom) {
        const customResult = rule.custom(value);
        if (customResult !== true) {
            return customResult || `${fieldName} is invalid`;
        }
    }

    return null;
}

/**
 * Validate request body against schema
 */
export function validateRequestBody(
    req: NextApiRequest,
    schema: ValidationSchema
): ValidationResult {
    const errors: Record<string, string> = {};
    const data: any = {};

    // Get body (handle both parsed and raw)
    const body = req.body || {};

    // Security check: Global check for suspicious payloads in the entire body
    if (isSuspiciousPayload(body)) {
        console.warn(`[Security] Suspicious payload detected in request body at ${req.url}`);
        return {
            valid: false,
            errors: { _global: "Malicious payload detected and blocked" },
        };
    }

    // Validate each field in schema
    for (const [fieldName, rule] of Object.entries(schema)) {
        const value = body[fieldName];
        const validationRule = rule as ValidationRule;

        // Check if it's a nested schema
        if (
            validationRule &&
            typeof validationRule === "object" &&
            !("required" in validationRule) &&
            !("type" in validationRule)
        ) {
            // Nested schema - validate recursively
            if (value && typeof value === "object") {
                const nestedResult = validateRequestBody(
                    { ...req, body: value } as NextApiRequest,
                    validationRule as ValidationSchema
                );
                if (!nestedResult.valid) {
                    Object.assign(errors, nestedResult.errors);
                } else {
                    data[fieldName] = nestedResult.data;
                }
            } else if (validationRule.required) {
                errors[fieldName] = `${fieldName} is required`;
            }
        } else {
            // Regular field validation
            const error = validateValue(
                value,
                validationRule as ValidationRule,
                fieldName
            );
            if (error) {
                errors[fieldName] = error;
            } else if (value !== undefined) {
                // Type conversion for numbers and booleans
                if (validationRule.type === "number") {
                    data[fieldName] =
                        typeof value === "string" ? parseFloat(value) : value;
                } else if (validationRule.type === "boolean") {
                    data[fieldName] = value === "true" || value === true;
                } else {
                    data[fieldName] = value;
                }
            }
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        data: Object.keys(data).length > 0 ? data : undefined,
    };
}

/**
 * Validate query parameters against schema
 */
export function validateQueryParams(
    req: NextApiRequest,
    schema: ValidationSchema
): ValidationResult {
    const errors: Record<string, string> = {};
    const data: any = {};

    // Security check: Global check for suspicious payloads in query parameters
    if (isSuspiciousPayload(req.query)) {
        console.warn(`[Security] Suspicious payload detected in query params at ${req.url}`);
        return {
            valid: false,
            errors: { _global: "Malicious payload detected and blocked" },
        };
    }

    for (const [fieldName, rule] of Object.entries(schema)) {
        const value = req.query[fieldName];
        const validationRule = rule as ValidationRule;

        // Handle array query params
        let paramValue = value;
        if (Array.isArray(value) && validationRule.type !== "array") {
            paramValue = value[0]; // Take first value for non-array types
        }

        const error = validateValue(paramValue, validationRule, fieldName);
        if (error) {
            errors[fieldName] = error;
        } else if (paramValue !== undefined) {
            // Type conversion
            if (validationRule.type === "number") {
                data[fieldName] = parseInt(String(paramValue), 10);
            } else if (validationRule.type === "boolean") {
                const boolValue = Array.isArray(paramValue)
                    ? paramValue[0]
                    : paramValue;
                if (typeof boolValue === "boolean") {
                    data[fieldName] = boolValue;
                } else {
                    data[fieldName] = String(boolValue) === "true";
                }
            } else {
                data[fieldName] = paramValue;
            }
        }
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors,
        data: Object.keys(data).length > 0 ? data : undefined,
    };
}

/**
 * Sanitize string input (remove dangerous characters and HTML)
 */
export function sanitizeString(
    input: string,
    maxLength: number = 10000
): string {
    if (typeof input !== "string") {
        return "";
    }

    // Remove null bytes
    let sanitized = input.replace(/\0/g, "");

    // Strip HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, "");

    // Remove common XSS patterns
    sanitized = sanitized
        .replace(/javascript:/gi, "")
        .replace(/vbscript:/gi, "")
        .replace(/on\w+\s*=/gi, "");

    // Truncate to max length
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }

    return sanitized;
}

/**
 * Sanitize number input
 */
export function sanitizeNumber(
    input: any,
    min?: number,
    max?: number
): number | null {
    const num = typeof input === "string" ? parseFloat(input) : Number(input);

    if (isNaN(num)) {
        return null;
    }

    if (min !== undefined && num < min) {
        return min;
    }

    if (max !== undefined && num > max) {
        return max;
    }

    return num;
}
