import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

/**
 * Session for RSC layouts/pages.
 * Amplify uses the jose NextAuth stub (cookie bridge) — still call getServerSession.
 * Do not short-circuit to null solely because AMPLIFY_SSR is set.
 */
export async function getServerSessionSafe(): Promise<Session | null> {
    try {
        const { authOptions } = await import("@/server/auth/authOptions");
        return await getServerSession(authOptions);
    } catch {
        return null;
    }
}
