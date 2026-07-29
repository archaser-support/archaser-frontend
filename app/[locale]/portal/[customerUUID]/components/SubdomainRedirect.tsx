"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { isEnvironmentHost } from "@/utils/domainUtils";

interface SubdomainRedirectProps {
    customerUUID: string;
    customerSubdomain: string | null;
}

export default function SubdomainRedirect({
    customerUUID,
    customerSubdomain,
}: SubdomainRedirectProps) {
    const router = useRouter();
    const [shouldRedirect, setShouldRedirect] = useState(false);

    useEffect(() => {
        // Only redirect if we have a subdomain and we're not already on the correct subdomain
        if (customerSubdomain && typeof window !== "undefined") {
            const currentHostname = window.location.hostname;
            const expectedSubdomain = customerSubdomain;

            // Only implement subdomain redirects in production (not localhost,
            // staging or dev, where tenant subdomains are not configured)
            const isProduction =
                !currentHostname.includes("localhost") &&
                !currentHostname.includes("127.0.0.1") &&
                !isEnvironmentHost(currentHostname);

            // Check if we're already on the correct subdomain
            const isOnCorrectSubdomain = currentHostname.startsWith(
                `${expectedSubdomain}.`
            );

            if (!isOnCorrectSubdomain && isProduction) {
                // We need to redirect to the correct subdomain (production only)
                const protocol = window.location.protocol;
                const baseDomain = "archaser.com";
                const currentPath = window.location.pathname;
                const redirectUrl = `${protocol}//${expectedSubdomain}.${baseDomain}${currentPath}`;

                // Use window.location.href for a full page redirect
                window.location.href = redirectUrl;
            }
        }
    }, [customerSubdomain, customerUUID]);

    // This component doesn't render anything
    return null;
}
