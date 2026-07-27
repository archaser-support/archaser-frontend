/**
 * Domain detection utilities for environment indicators
 */

export type EnvironmentType = 'localhost' | 'preprod' | 'production' | 'unknown';

/**
 * Detects the current environment based on the domain
 * @returns EnvironmentType - The detected environment
 */
export function detectEnvironment(): EnvironmentType {
    if (typeof window === 'undefined') {
        return 'unknown';
    }

    const hostname = window.location.hostname;
    const port = window.location.port;

    // Check for preprod or staging subdomain or port 3001
    if (hostname.includes('preprod') ||
        hostname.startsWith('preprod.') ||
        hostname.includes('staging') ||
        hostname.startsWith('staging.') ||
        port === '3001') {
        return 'preprod';
    }

    // Check for explicit localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'localhost';
    }

    // Check for local network patterns
    // Only treat these as localhost if they are commonly used for development
    // (192.168.x.x, 10.x.x.x, and private 172.16.x.x-172.31.x.x)
    if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
        return 'localhost';
    }

    if (hostname.startsWith('172.')) {
        const parts = hostname.split('.');
        if (parts.length === 4) {
            const secondOctet = parseInt(parts[1], 10);
            if (secondOctet >= 16 && secondOctet <= 31) {
                return 'localhost';
            }
        }
    }

    // Default to production for other domains
    return 'production';
}

/**
 * Gets the appropriate indicator color for the environment
 * @param environment - The environment type
 * @returns string - The color for the indicator
 */
export function getEnvironmentIndicatorColor(environment: EnvironmentType): string {
    switch (environment) {
        case 'localhost':
            return '#10B981'; // Green (success color from theme)
        case 'preprod':
            return '#F59E0B'; // Yellow/Amber (warning color from theme)
        case 'production':
            return 'transparent'; // No indicator for production
        default:
            return 'transparent';
    }
}

/**
 * Gets the environment display name
 * @param environment - The environment type
 * @returns string - The display name for the environment
 */
export function getEnvironmentDisplayName(environment: EnvironmentType): string {
    switch (environment) {
        case 'localhost':
            return 'Local Development';
        case 'preprod':
            return 'Pre-Production';
        case 'production':
            return 'Production';
        default:
            return 'Unknown';
    }
}

/**
 * Detects the current environment on the server side based on environment variables and hostname
 * @returns EnvironmentType - The detected environment
 */
export function detectServerEnvironment(): EnvironmentType {
    const nodeEnv = process.env.NODE_ENV;
    const isProduction = nodeEnv === 'production';
    const serverPort = process.env.PORT;

    // 1. If explicitly production, return production or preprod based on port
    if (isProduction) {
        // Port 3001 is used for staging/preprod in our ecosystem.config.js
        if (serverPort === '3001') {
            return 'preprod';
        }

        // Also check NEXTAUTH_URL for preprod indicators
        if (process.env.NEXTAUTH_URL) {
            try {
                const url = new URL(process.env.NEXTAUTH_URL);
                const hostname = url.hostname;
                const urlPort = url.port;

                if (urlPort === '3001' ||
                    hostname.startsWith('preprod.') ||
                    hostname === 'preprod' ||
                    hostname.startsWith('staging.') ||
                    hostname === 'staging') {
                    return 'preprod';
                }
            } catch (e) { /* ignore */ }
        }

        // Otherwise it must be production
        return 'production';
    }

    // 2. If explicitly development, return localhost
    if (nodeEnv === 'development') {
        return 'localhost';
    }

    // 3. Check for obvious localhost indicators in NEXTAUTH_URL
    if (process.env.NEXTAUTH_URL) {
        try {
            const url = new URL(process.env.NEXTAUTH_URL);
            const hostname = url.hostname;

            // Only return localhost if explicitly localhost/127.0.0.1
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'localhost';
            }
        } catch (error) {
            // Invalid URL, continue
        }
    }

    // 4. Default to production for everything else
    // This ensures that if we are on a real domain (even if not explicitly caught above),
    // we treat it as production rather than local.
    return 'production';
}

/**
 * Gets the environment prefix for email subjects
 * @param environment - The environment type
 * @returns string - The prefix to add to email subjects (empty for production)
 */
export function getEmailSubjectPrefix(environment: EnvironmentType): string {
    switch (environment) {
        case 'localhost':
            return '[LOCAL] ';
        case 'preprod':
            return '[PRE-PROD] ';
        case 'production':
            return ''; // No prefix for production
        default:
            return '[UNKNOWN] ';
    }
}

/**
 * Adds environment prefix to email subject if not in production
 * @param subject - The original email subject
 * @returns string - The subject with environment prefix if applicable
 */
export function addEnvironmentPrefixToEmailSubject(subject: string): string {
    const environment = detectServerEnvironment();
    const prefix = getEmailSubjectPrefix(environment);
    return prefix + subject;
}
