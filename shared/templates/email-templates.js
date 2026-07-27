import fs from "fs";
import path from "path";

// Base template path
const TEMPLATE_BASE_PATH = "shared/templates/emails";

// Supported languages
const SUPPORTED_LANGUAGES = ["en", "he"];

// Email template types
const EMAIL_TYPES = {
    FORGOT_PASSWORD: "forgot-password",
    WELCOME_USER: "welcome-user",
    DISPUTE_NOTIFICATION: "dispute-notification",
    REPORT_SHARED: "report-shared",
    // Add more email types as needed
};

// Email subjects for different languages
const EMAIL_SUBJECTS = {
    [EMAIL_TYPES.FORGOT_PASSWORD]: {
        en: "Reset Password Request",
        he: "בקשת איפוס סיסמה",
    },
    [EMAIL_TYPES.WELCOME_USER]: {
        en: "Welcome to ARchaser",
        he: "ברוכים הבאים ל-ARchaser",
    },
    [EMAIL_TYPES.DISPUTE_NOTIFICATION]: {
        en: "New Dispute Notification",
        he: "התראה על ערעור חדש",
    },
    [EMAIL_TYPES.REPORT_SHARED]: {
        en: "Report Shared: ${reportName}",
        he: "דוח שותף: ${reportName}",
    },
};

/**
 * Get email template with language support
 * @param {string} templateType - Type of email template
 * @param {string} language - Language code (en, he)
 * @param {Object} variables - Variables to replace in template
 * @returns {string} - Rendered HTML template
 */
export const getEmailTemplate = (
    templateType,
    language = "en",
    variables = {}
) => {
    try {
        // Validate template type
        if (!Object.values(EMAIL_TYPES).includes(templateType)) {
            throw new Error(`Invalid template type: ${templateType}`);
        }

        // Validate language and ensure it's supported
        if (!SUPPORTED_LANGUAGES.includes(language)) {
            language = "en";
        }

        // Construct template path for requested language
        const templatePath = path.resolve(
            TEMPLATE_BASE_PATH,
            templateType,
            `${language}.html`
        );

        // Check if template exists for requested language
        if (fs.existsSync(templatePath)) {
            return renderTemplate(templatePath, variables);
        }

        // Fallback to English if requested language template doesn't exist
        console.warn(
            `Template ${templateType}/${language}.html not found, falling back to English`
        );
        const fallbackPath = path.resolve(
            TEMPLATE_BASE_PATH,
            templateType,
            "en.html"
        );

        if (!fs.existsSync(fallbackPath)) {
            throw new Error(
                `Template not found for ${templateType} (tried ${language} and en)`
            );
        }

        return renderTemplate(fallbackPath, variables);
    } catch (error) {
        console.error(
            `Error loading email template ${templateType}/${language}:`,
            error
        );
        throw error;
    }
};

/**
 * Render template with variables
 * @param {string} templatePath - Path to template file
 * @param {Object} variables - Variables to replace
 * @returns {string} - Rendered template
 */
const renderTemplate = (templatePath, variables) => {
    let template = fs.readFileSync(templatePath, "utf-8");

    // Replace variables in template
    Object.entries(variables).forEach(([key, value]) => {
        const placeholder = new RegExp(`\\$\\{${key}\\}`, "g");
        template = template.replace(placeholder, value);
    });

    return template;
};

/**
 * Get email subject for template type and language
 * @param {string} templateType - Type of email template
 * @param {string} language - Language code
 * @returns {string} - Email subject
 */
export const getEmailSubject = (templateType, language = "en") => {
    if (!Object.values(EMAIL_TYPES).includes(templateType)) {
        throw new Error(`Invalid template type: ${templateType}`);
    }

    const subjects = EMAIL_SUBJECTS[templateType];
    if (!subjects) {
        throw new Error(`Invalid template type: ${templateType}`);
    }

    // Validate language and fallback to English if not supported or not found
    if (!SUPPORTED_LANGUAGES.includes(language) || !subjects[language]) {
        return subjects["en"] || "Email from ARchaser";
    }

    return subjects[language];
};

/**
 * Validate email template exists
 * @param {string} templateType - Type of email template
 * @param {string} language - Language code
 * @returns {boolean} - Whether template exists
 */
export const templateExists = (templateType, language = "en") => {
    try {
        const templatePath = path.resolve(
            TEMPLATE_BASE_PATH,
            templateType,
            `${language}.html`
        );
        return fs.existsSync(templatePath);
    } catch (error) {
        return false;
    }
};

/**
 * Get all available templates
 * @returns {Object} - Available templates by type and language
 */
export const getAvailableTemplates = () => {
    const available = {};

    Object.values(EMAIL_TYPES).forEach((templateType) => {
        available[templateType] = {};
        SUPPORTED_LANGUAGES.forEach((language) => {
            available[templateType][language] = templateExists(
                templateType,
                language
            );
        });
    });

    return available;
};

// Export constants for external use
export { EMAIL_SUBJECTS, EMAIL_TYPES, SUPPORTED_LANGUAGES };
