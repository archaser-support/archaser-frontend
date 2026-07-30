import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

/**
 * Session for RSC layouts/pages, read from the NextAuth cookie bridge that
 * wraps the Nest access token.
 */
export async function getServerSessionSafe(): Promise<Session | null> {
    try {
        const { authOptions } = await import("@/lib/authOptions");
        return await getServerSession(authOptions);
    } catch {
        return null;
    }
}
