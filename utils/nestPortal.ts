/**
 * Server-side Nest portal data helpers (Amplify RSC — no Prisma).
 */

export function nestOrigin(): string {
    const configured =
        process.env.NEST_API_BASE_URL?.trim() ||
        process.env.NEXT_PUBLIC_NEST_API_BASE_URL?.trim();
    if (configured) {
        return configured.replace(/\/$/, "");
    }
    return "http://localhost:3002";
}

export async function fetchNestPortalData(
    customerUUID: string
): Promise<Record<string, unknown> | null> {
    try {
        const url = `${nestOrigin()}/api/customers/${encodeURIComponent(customerUUID)}/portal-data`;
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            cache: "no-store",
        });
        if (!response.ok) {
            return null;
        }
        return (await response.json()) as Record<string, unknown>;
    } catch {
        return null;
    }
}
