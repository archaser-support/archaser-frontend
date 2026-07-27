import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";
import { fetchNestPortalData } from "@/utils/nestPortal";
import { getServerSessionSafe } from "@/utils/serverSession";

interface PortalLayoutProps {
    children: React.ReactNode;
    params: Promise<{
        locale: string;
        customerUUID: string;
    }>;
}

export const dynamic = "force-dynamic";

export default async function PortalLayout({
    children,
    params,
}: PortalLayoutProps) {
    const { locale, customerUUID } = await params;
    let isVerified: { name: string; value: string } | undefined;
    let pathname = "";
    let search = "";

    try {
        const cookieStore = await cookies();
        isVerified = cookieStore.get(`portal_verified_${customerUUID}`);
    } catch {
        isVerified = undefined;
    }

    try {
        const headersList = await headers();
        pathname =
            headersList.get("x-pathname") ||
            headersList.get("next-url") ||
            "";
        search = headersList.get("x-search") || "";
    } catch {
        pathname = "";
        search = "";
    }

    // In some edge/dev requests, pathname headers can be unavailable.
    // Fail-open to avoid self-redirect loops on /verify.
    const hasKnownPathname = Boolean(pathname);
    const hasCidInQuery = search.includes("cid=");

    // Check if we are already on the verify page to avoid infinite redirect loop
    const isVerifyPage =
        hasKnownPathname &&
        (pathname.includes("/verify") ||
            pathname.endsWith("/verify/") ||
            pathname.endsWith("/verify"));
    const normalizedPathname = pathname.split("?")[0];
    const portalRootPath = `/${locale}/portal/${customerUUID}`;
    const isPortalRootPath =
        normalizedPathname === portalRootPath ||
        normalizedPathname === `${portalRootPath}/`;

    // Verify page has its own dedicated redirect logic.
    // Avoid additional layout-level checks here to prevent route loops.
    if (isVerifyPage) {
        return <>{children}</>;
    }

    // Fail-open on infra issues to prevent hard crashes in portal layout.
    let verificationEnabled = true;
    try {
        const portalData = await fetchNestPortalData(customerUUID);
        verificationEnabled =
            (portalData?.portal_verification_enabled as boolean | undefined) ??
            true;
    } catch {
        verificationEnabled = true;
    }

    // Check for active session to bypass verification for logged-in users (e.g. admins/agents)
    let session: Awaited<ReturnType<typeof getServerSessionSafe>> | null = null;
    try {
        session = await getServerSessionSafe();
    } catch {
        session = null;
    }

    if (!hasKnownPathname) {
        return <>{children}</>;
    }

    if (verificationEnabled && !session) {
        if (!isVerified && !isVerifyPage) {
            // Let page.tsx handle verification routing from portal root so it can
            // resolve/fallback cid before redirecting to /verify.
            if (isPortalRootPath) {
                return <>{children}</>;
            }
            // Let page.tsx decide the correct redirect when cid is present.
            // This preserves contact-targeted verification flow.
            if (hasCidInQuery) {
                return <>{children}</>;
            }
            redirect(`/${locale}/portal/${customerUUID}/verify`);
        }
    } else {
        // If verification is disabled OR user is logged in (admin bypassing),
        // but user is on verify page, redirect to portal home
        if (isVerifyPage) {
            redirect(`/${locale}/portal/${customerUUID}`);
        }
    }

    return <>{children}</>;
}
