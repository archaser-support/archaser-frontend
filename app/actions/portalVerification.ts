'use server'

import { cookies } from "next/headers";
import { isAmplifySsrBuild } from "@/utils/amplifyMode";

async function getVerificationService() {
    if (isAmplifySsrBuild()) {
        return null;
    }
    const { VerificationService } = await import(
        "@/server/services/VerificationService"
    );
    return VerificationService.getInstance();
}

export async function sendVerificationCodeAction(customerUUID: string, contactId?: number): Promise<{ success: boolean; emailObfuscated?: string; error?: string }> {
    const service = await getVerificationService();
    if (!service) {
        return { success: false, error: "Verification unavailable" };
    }
    const result = await service.sendVerificationEmail(customerUUID, contactId);
    return result;
}

export async function verifyCodeAction(customerUUID: string, code: string) {
    const service = await getVerificationService();
    if (!service) {
        return { success: false, message: "Verification unavailable" };
    }
    const isValid = await service.verifyCode(customerUUID, code);

    if (isValid) {
        // Set a cookie to mark this session as verified for this specific customer
        // Expires in 24 hours (or whatever policy is preferred)
        const cookieStore = await cookies();
        cookieStore.set(`portal_verified_${customerUUID}`, 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/', // Path should perhaps be scoped? But easier to keep root for now or /portal
            sameSite: 'lax'
        });
        return { success: true };
    }

    return { success: false, message: "Invalid or expired code" };
}

export async function getMaskedContactEmailAction(customerUUID: string, contactId?: number) {
    const service = await getVerificationService();
    if (!service) {
        return null;
    }
    const data = await service.getEmailAddress(customerUUID, contactId);
    if (!data) return null;

    const [local, domain] = data.email.split('@');
    const obfuscated = `${local.substring(0, 2)}***@${domain}`;
    return obfuscated;
}
