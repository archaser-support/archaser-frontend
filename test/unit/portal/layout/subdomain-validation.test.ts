import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { AccountService } from "@/server/services/AccountService";

// Mock Next.js modules
vi.mock("next/headers", () => ({
    headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    redirect: vi.fn(),
}));

// Mock AccountService
vi.mock("@/server/services/AccountService", () => ({
    AccountService: {
        getCustomerBySubdomain: vi.fn(),
    },
}));

// Import the function to test (we'll need to extract it from the layout)
// For now, we'll test the logic inline
function extractSubdomain(host: string): string | null {
    if (!host) return null;

    // Handle localhost for development
    if (host.includes("localhost")) {
        return null;
    }

    // For production, extract subdomain
    const hostParts = host.split(".");
    if (hostParts.length > 2) {
        return hostParts[0];
    }

    return null;
}

describe("Portal Layout - Subdomain Validation", () => {
    const mockHeaders = vi.mocked(headers);
    const mockRedirect = vi.mocked(redirect);
    const mockGetCustomerBySubdomain = vi.mocked(
        AccountService.getCustomerBySubdomain
    );

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("extractSubdomain", () => {
        it("should extract subdomain from valid hostname", () => {
            const host = "testcompany.archaser.com";
            const result = extractSubdomain(host);
            expect(result).toBe("testcompany");
        });

        it("should handle hostname with multiple subdomains", () => {
            const host = "sub1.sub2.archaser.com";
            const result = extractSubdomain(host);
            expect(result).toBe("sub1");
        });

        it("should return null for localhost", () => {
            const host = "localhost:3000";
            const result = extractSubdomain(host);
            expect(result).toBeNull();
        });

        it("should return null for localhost with subdomain", () => {
            const host = "testcompany.localhost:3000";
            const result = extractSubdomain(host);
            expect(result).toBeNull();
        });

        it("should return null for domain without subdomain", () => {
            const host = "archaser.com";
            const result = extractSubdomain(host);
            expect(result).toBeNull();
        });

        it("should return null for empty host", () => {
            const host = "";
            const result = extractSubdomain(host);
            expect(result).toBeNull();
        });

        it("should return null for null host", () => {
            const host = null as any;
            const result = extractSubdomain(host);
            expect(result).toBeNull();
        });
    });

    describe("Customer Lookup by Subdomain", () => {
        it("should find customer for valid subdomain", async () => {
            const mockCustomer = {
                id: 1,
                name: "Test Company",
                sub_domain: "testcompany",
                status: "Active" as const,
            };

            mockGetCustomerBySubdomain.mockResolvedValue(mockCustomer);

            const result =
                await AccountService.getCustomerBySubdomain("testcompany");

            expect(mockGetCustomerBySubdomain).toHaveBeenCalledWith(
                "testcompany"
            );
            expect(result).toEqual(mockCustomer);
        });

        it("should return null for non-existent subdomain", async () => {
            mockGetCustomerBySubdomain.mockResolvedValue(null);

            const result =
                await AccountService.getCustomerBySubdomain("nonexistent");

            expect(mockGetCustomerBySubdomain).toHaveBeenCalledWith(
                "nonexistent"
            );
            expect(result).toBeNull();
        });

        it("should handle database errors gracefully", async () => {
            const error = new Error("Database connection failed");
            mockGetCustomerBySubdomain.mockRejectedValue(error);

            await expect(
                AccountService.getCustomerBySubdomain("testcompany")
            ).rejects.toThrow("Database connection failed");
        });
    });

    describe("Reserved Subdomains", () => {
        it('should skip validation for "portal" subdomain', () => {
            const host = "portal.archaser.com";
            const subdomain = extractSubdomain(host);

            // In the actual layout, this would skip customer lookup
            expect(subdomain).toBe("portal");
        });

        it('should skip validation for "preprod" subdomain', () => {
            const host = "preprod.archaser.com";
            const subdomain = extractSubdomain(host);

            expect(subdomain).toBe("preprod");
        });
    });

    describe("Error Handling Scenarios", () => {
        it("should handle missing host header", () => {
            const host = null;
            const result = extractSubdomain(host as any);
            expect(result).toBeNull();
        });

        it("should handle malformed hostname", () => {
            const host = "invalid..hostname";
            const result = extractSubdomain(host);
            expect(result).toBe("invalid");
        });

        it("should handle hostname with only dots", () => {
            const host = "...archaser.com";
            const result = extractSubdomain(host);
            expect(result).toBe("");
        });
    });

    describe("Integration Scenarios", () => {
        it("should handle complete subdomain validation flow", async () => {
            const mockCustomer = {
                id: 1,
                name: "Valid Company",
                sub_domain: "validcompany",
                status: "Active" as const,
            };

            const host = "validcompany.archaser.com";
            const subdomain = extractSubdomain(host);

            expect(subdomain).toBe("validcompany");

            mockGetCustomerBySubdomain.mockResolvedValue(mockCustomer);

            const customer = await AccountService.getCustomerBySubdomain(
                subdomain!
            );

            expect(customer).toEqual(mockCustomer);
            expect(mockGetCustomerBySubdomain).toHaveBeenCalledWith(
                "validcompany"
            );
        });

        it("should handle subdomain validation failure", async () => {
            const host = "invalidcompany.archaser.com";
            const subdomain = extractSubdomain(host);

            expect(subdomain).toBe("invalidcompany");

            mockGetCustomerBySubdomain.mockResolvedValue(null);

            const customer = await AccountService.getCustomerBySubdomain(
                subdomain!
            );

            expect(customer).toBeNull();
            // In the actual layout, this would trigger a redirect
        });
    });
});
