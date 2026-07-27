/**
 * Password validation utility
 * Validates password complexity requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */

export interface PasswordValidationError {
    type: "min_length" | "uppercase" | "lowercase" | "number" | "special_char";
    message: string;
}

/**
 * Validates password against complexity requirements
 * @param password - The password to validate
 * @returns Array of validation errors (empty array if password is valid)
 */
export function validatePassword(password: string): PasswordValidationError[] {
    const errors: PasswordValidationError[] = [];

    if (password.length < 8) {
        errors.push({
            type: "min_length",
            message: "Password must be at least 8 characters long",
        });
    }

    if (!/(?=.*[a-z])/.test(password)) {
        errors.push({
            type: "lowercase",
            message: "Password must contain at least one lowercase letter",
        });
    }

    if (!/(?=.*[A-Z])/.test(password)) {
        errors.push({
            type: "uppercase",
            message: "Password must contain at least one uppercase letter",
        });
    }

    if (!/(?=.*\d)/.test(password)) {
        errors.push({
            type: "number",
            message: "Password must contain at least one number",
        });
    }

    if (!/(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/.test(password)) {
        errors.push({
            type: "special_char",
            message: "Password must contain at least one special character",
        });
    }

    return errors;
}

/**
 * Checks if a password is valid (meets all requirements)
 * @param password - The password to validate
 * @returns true if password is valid, false otherwise
 */
export function isValidPassword(password: string): boolean {
    return validatePassword(password).length === 0;
}
