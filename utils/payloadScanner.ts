/**
 * Payload Scanner Utility
 * 
 * Detects suspicious shell injection patterns and malicious Base64 payloads.
 */

const DANGEROUS_PATTERNS = [
    // Base64 execution patterns
    /base64\s+(--decode|-d)/i,

    // Shell piping patterns
    /\|\s*sh\b/i,
    /\|\s*bash\b/i,
    /\|\s*zsh\b/i,
    /;\s*sh\b/i,
    /;\s*bash\b/i,

    // Download and execute patterns
    /curl\s+.*\s*\|\s*sh/i,
    /wget\s+.*\s*\|\s*sh/i,
    /\bcurl\s+-[oO]/i,  // curl with output option (more specific)
    /\bwget\s+-[oO]/i,  // wget with output option (more specific)

    // Reverse shell / netcat
    /nc\s+-e/i,
    /netcat\s+-e/i,
    /\/dev\/tcp\//i,

    // Code execution functions (require opening paren immediately or with space)
    /\bexec\s*\(/i,
    /\beval\s*\(/i,
    /\bFunction\s*\(/i,

    // Node.js dangerous requires
    /require\s*\(\s*['"]child_process['"]\s*\)/i,
    /require\s*\(\s*['"]fs['"]\s*\)/i,
    /\bprocess\.env\b/i,
    /\bspawn\s*\(/i,
    /\bfork\s*\(/i,
    /\bexecSync\s*\(/i,
    /\bspawnSync\s*\(/i,

    // System commands
    /\bsudo\b/i,
    /\bcrontab\b/i,
    /\brm\s+-rf\b/i,
    /\bchmod\s+\+x\b/i,

    // Sensitive file access
    /cat\s+\/etc\/passwd/i,
    /cat\s+\/etc\/shadow/i,
    /\.ssh\/authorized_keys/i,

    // Windows-specific attack patterns (from production logs)
    /powershell\.exe/i,
    /\bpowershell\s+-/i,  // powershell with options
    /cmd\.exe\s*\/[cC]/i, // cmd.exe /c
    /svchost\.exe/i,
    /C:\\Users\\Public/i,
    /C:userspublic/i, // URL-encoded variant
    /\\Windows\\System32/i,

    // Common malware paths
    /downloads[\\\/].*\.exe/i,
    /temp[\\\/].*\.exe/i,
    /appdata[\\\/].*\.exe/i,

    // Script injection (more specific patterns)
    /<script[\s>]/i,
    /javascript:/i,
    /data:text\/html/i,
    // Event handlers - must be at start of attribute or after space/quote (not in middle of word)
    /[\s"'<]on(click|load|error|mouseover|mouseout|keydown|keyup|submit|focus|blur|change)\s*=/i,

    // Path traversal
    /\.\.\//,
    /\.\.%2[fF]/, // URL encoded
    /\.\.\\/, // Windows style

    // SQL injection patterns (more specific)
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /'\s*OR\s*1\s*=\s*1/i,
    /\bUNION\s+SELECT\b/i,
    /;\s*DROP\s+TABLE\b/i,
    /;\s*DELETE\s+FROM\b/i,

    // Command substitution
    /\$\([^)]+\)/,
    /`[^`]+`/,
];

/**
 * Checks if a string contains suspicious patterns
 */
export function isSuspiciousString(input: string): boolean {
    if (!input || typeof input !== "string") return false;

    // 1. Check direct patterns
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(input)) return true;
    }

    // 2. Detect potential Base64 and check decoded content
    // A potential Base64 string for a payload is usually at least 16 chars and 
    // satisfies the Base64 charset.
    const base64Regex = /([A-Za-z0-9+/]{16,}(:?={0,2}))/g;
    let match;
    while ((match = base64Regex.exec(input)) !== null) {
        const potentialBase64 = match[0];
        try {
            let decoded = "";
            if (typeof Buffer !== "undefined") {
                decoded = Buffer.from(potentialBase64, "base64").toString(
                    "utf8"
                );
            } else {
                // Edge runtime fallback
                decoded = new TextDecoder().decode(
                    Uint8Array.from(atob(potentialBase64), (c) =>
                        c.charCodeAt(0)
                    )
                );
            }

            // Check if decoded content looks like code or shell commands
            if (decoded) {
                for (const pattern of DANGEROUS_PATTERNS) {
                    if (pattern.test(decoded)) return true;
                }
            }
        } catch (e) {
            // Not valid UTF-8 base64, ignore
        }
    }

    return false;
}

/**
 * Recursively scans an object for suspicious patterns
 */
export function isSuspiciousPayload(payload: any): boolean {
    if (!payload) return false;

    if (typeof payload === 'string') {
        return isSuspiciousString(payload);
    }

    if (Array.isArray(payload)) {
        return payload.some(item => isSuspiciousPayload(item));
    }

    if (typeof payload === 'object') {
        return Object.values(payload).some(value => isSuspiciousPayload(value));
    }

    return false;
}
