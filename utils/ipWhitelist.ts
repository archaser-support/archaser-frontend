/**
 * IP Whitelist Utility
 *
 * Validates IP addresses against a whitelist (supports CIDR notation)
 */

/**
 * Parse IP address to number for comparison
 */
function ipToNumber(ip: string): number {
    const parts = ip.split(".");
    return (
        parseInt(parts[0], 10) * 256 * 256 * 256 +
        parseInt(parts[1], 10) * 256 * 256 +
        parseInt(parts[2], 10) * 256 +
        parseInt(parts[3], 10)
    );
}

/**
 * Check if IP is in CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
    const [network, prefixLength] = cidr.split("/");
    const prefix = parseInt(prefixLength || "32", 10);

    const ipNum = ipToNumber(ip);
    const networkNum = ipToNumber(network);
    const mask = ~(0xffffffff >>> prefix);

    return (ipNum & mask) === (networkNum & mask);
}

/**
 * Get allowed IPs from environment variable
 */
function getAllowedIPs(): string[] {
    const ipsEnv = process.env.ALLOW_TEST_AUTH_IPS;
    if (!ipsEnv) {
        return [];
    }

    return ipsEnv.split(",").map((ip) => ip.trim());
}

/**
 * Check if IP address is allowed
 */
export function isIpAllowed(ip: string | undefined): boolean {
    if (!ip) {
        return false;
    }

    // Remove port if present
    const cleanIp = ip.split(":")[0];

    const allowedIPs = getAllowedIPs();

    // If no whitelist configured, deny in production
    if (allowedIPs.length === 0) {
        return process.env.NODE_ENV === "development";
    }

    // Check exact match or CIDR
    return allowedIPs.some((allowed) => {
        if (allowed.includes("/")) {
            // CIDR notation
            return isIpInCidr(cleanIp, allowed);
        } else {
            // Exact match
            return cleanIp === allowed;
        }
    });
}

/**
 * Get client IP from request
 */
export function getClientIP(req: {
    headers: { [key: string]: string | string[] | undefined };
    socket?: { remoteAddress?: string };
}): string | undefined {
    // Try to get real IP from various headers (for proxies/load balancers)
    const forwardedFor = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const cfConnectingIp = req.headers["cf-connecting-ip"]; // Cloudflare

    if (typeof forwardedFor === "string") {
        return forwardedFor.split(",")[0].trim();
    } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return forwardedFor[0].split(",")[0].trim();
    } else if (typeof realIp === "string") {
        return realIp;
    } else if (typeof cfConnectingIp === "string") {
        return cfConnectingIp;
    } else if (req.socket?.remoteAddress) {
        return req.socket.remoteAddress;
    }

    return undefined;
}
