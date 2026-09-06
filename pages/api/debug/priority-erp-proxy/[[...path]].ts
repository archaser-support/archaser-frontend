import { execFile } from "child_process";
import fs from "fs";
import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import util from "util";

import { PRIORITY_SANDBOX_SERVICE_ROOT } from "@/shared/constants/prioritySandbox";

const execFileAsync = util.promisify(execFile);

/** Wrap a value for a remote POSIX single-quoted shell argument. */
function shellSingleQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

const PROXY_PREFIX = "/api/debug/priority-erp-proxy";

function resolveSshKeyPath(): string {
    if (process.env.SSH_KEY_PATH?.trim()) {
        return process.env.SSH_KEY_PATH.trim();
    }
    const candidates = [
        path.resolve(process.cwd(), "../archaser.pem"),
        path.resolve(process.cwd(), "../backend/archaser.pem"),
        path.resolve(process.cwd(), "../../archaser.pem"),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    return "";
}

/**
 * Transparent proxy for Priority ERP used in local development.
 * Use `/api/debug/priority-erp-proxy` as the connector Base URL; requests
 * forward via SSH to an allowlisted host (default portal.archaser.com).
 */
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    if (process.env.NODE_ENV !== "development") {
        return res.status(403).json({
            error: "This helper is only available in local development mode",
        });
    }

    const rawUrl = req.url || "";
    const prefixIndex = rawUrl.indexOf(PROXY_PREFIX);
    const remainingPath =
        prefixIndex !== -1
            ? rawUrl.substring(prefixIndex + PROXY_PREFIX.length)
            : "";

    const rawBaseUrl = (
        process.env.PRIORITY_ERP_TARGET_URL || PRIORITY_SANDBOX_SERVICE_ROOT
    ).replace(/\/+$/, "");
    const targetUrl = `${rawBaseUrl}${remainingPath.startsWith("/") ? "" : "/"}${remainingPath}`;

    const method = req.method || "GET";
    const authHeader = req.headers.authorization;
    const sshHost = process.env.SSH_HOST || "portal.archaser.com";
    const sshUser = process.env.SSH_USER || "ubuntu";
    const sshKeyPath = resolveSshKeyPath();

    try {
        // execFile (no local shell) so OData query params like $filter are not
        // expanded away. URL/headers stay single-quoted for the remote shell.
        let curlCmd = `curl -sS -X ${method} ${shellSingleQuote(targetUrl)}`;

        if (authHeader) {
            curlCmd += ` -H ${shellSingleQuote(`Authorization: ${authHeader}`)}`;
        }

        const accept = req.headers.accept || "application/json";
        curlCmd += ` -H ${shellSingleQuote(`Accept: ${accept}`)}`;

        if (method === "POST" || method === "PUT" || method === "PATCH") {
            const payloadStr =
                typeof req.body === "string"
                    ? req.body
                    : JSON.stringify(req.body ?? {});
            curlCmd += ` -d ${shellSingleQuote(payloadStr)}`;

            const contentType =
                req.headers["content-type"] || "application/json";
            curlCmd += ` -H ${shellSingleQuote(`Content-Type: ${contentType}`)}`;
        }

        const sshArgs = [
            "-o",
            "StrictHostKeyChecking=no",
            "-o",
            "ConnectTimeout=10",
        ];
        if (sshKeyPath) {
            sshArgs.push("-i", sshKeyPath);
        }
        sshArgs.push(`${sshUser}@${sshHost}`, curlCmd);

        const { stdout, stderr } = await execFileAsync("ssh", sshArgs, {
            maxBuffer: 50 * 1024 * 1024,
        });

        const body = stdout.trim();
        if (!body) {
            console.warn("[Priority Proxy] Empty upstream response:", {
                targetUrl,
                stderr: stderr?.trim() || null,
            });
            return res.status(502).json({
                error: "Priority proxy returned an empty response",
                targetUrl,
                stderr: stderr?.trim() || undefined,
            });
        }

        if (stderr?.trim()) {
            console.warn("[Priority Proxy] SSH stderr:", stderr.trim());
        }

        try {
            const jsonOutput = JSON.parse(body);
            return res.status(200).json(jsonOutput);
        } catch {
            return res.status(200).send(body);
        }
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[Priority Proxy] Error executing proxy:", message);
        return res.status(500).json({
            error: "Failed to execute remote proxy request",
            details: message,
        });
    }
}
