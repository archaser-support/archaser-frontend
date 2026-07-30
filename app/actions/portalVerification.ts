"use server";

import { cookies } from "next/headers";
import { nestOrigin } from "@/utils/nestPortal";

/**
 * Portal e-mail verification. The codes themselves live in Nest; this action
 * only exists so the verified flag can be written to an httpOnly cookie.
 */
async function postToNest<T>(
    path: string,
    body: Record<string, unknown>
): Promise<T | null> {
    try {
        const response = await fetch(`${nestOrigin()}/api/portal/${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            cache: "no-store",
        });
        if (!response.ok) {
            return null;
        }
        return (await response.json()) as T;
    } catch {
        return null;
    }
}

export async function sendVerificationCodeAction(
    customerUUID: string,
    contactId?: number
): Promise<{ success: boolean; emailObfuscated?: string; error?: string }> {
    const result = await postToNest<{
        success: boolean;
        emailObfuscated?: string;
        error?: string;
    }>("send-verification-code", { customerUUID, contactId });
    return result ?? { success: false, error: "Verification unavailable" };
}

export async function verifyCodeAction(customerUUID: string, code: string) {
    const result = await postToNest<{ valid: boolean }>("verify-code", {
        customerUUID,
        code,
    });

    if (result?.valid) {
        const cookieStore = await cookies();
        cookieStore.set(`portal_verified_${customerUUID}`, "true", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30,
            path: "/",
            sameSite: "lax",
        });
        return { success: true };
    }

    return { success: false, message: "Invalid or expired code" };
}

export async function getMaskedContactEmailAction(
    customerUUID: string,
    contactId?: number
): Promise<string | null> {
    const result = await postToNest<{ email?: string }>(
        "verification-email",
        { customerUUID, contactId }
    );
    const email = result?.email;
    if (!email) {
        return null;
    }
    const [local, domain] = email.split("@");
    if (!domain) {
        return null;
    }
    return `${local.substring(0, 2)}***@${domain}`;
}
