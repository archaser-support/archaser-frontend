/// <reference types="vitest/globals" />
import { NextApiRequest, NextApiResponse } from "next";
import { NextRequest } from "next/server";
import { vi, beforeEach, describe, it, expect } from "vitest";

import {
    getUser,
    getAccountId,
    getUserId,
    getUserLanguage,
} from "@/utils/authUtils";

// Mock next-auth/jwt
const mockGetToken = vi.fn();
vi.mock("next-auth/jwt", () => ({
    getToken: (args: any) => mockGetToken(args),
}));

describe("Auth Utilities", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXTAUTH_URL = "http://localhost:3000";
        process.env.NEXTAUTH_SECRET = "secret";
        process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";
    });

    describe("getUser", () => {
        it("should return user token with account_id", async () => {
            const mockToken = {
                account_id: 123,
                name: "Test User",
                locale: "en-US",
                id: "user-123",
                language: "English",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as Request;
            const result = await getUser(mockRequest);

            expect(result).toEqual(mockToken);
            expect(result.account_id).toBe(123);
            expect(mockGetToken).toHaveBeenCalledWith({
                req: mockRequest,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName:
                    process.env.NODE_ENV === "production"
                        ? "__Secure-next-auth.session-token.v1"
                        : "next-auth.session-token.v1",
            });
        });

        it("should throw error when token is null", async () => {
            mockGetToken.mockResolvedValue(null);

            const mockRequest = {} as Request;

            await expect(getUser(mockRequest)).rejects.toThrow(
                "Account ID not found in token"
            );
        });

        it("should throw error when account_id is missing", async () => {
            const mockToken = {
                name: "Test User",
                locale: "en-US",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as Request;

            await expect(getUser(mockRequest)).rejects.toThrow(
                "Account ID not found in token"
            );
        });

        it("should throw error when account_id is null", async () => {
            const mockToken = {
                account_id: null,
                name: "Test User",
                locale: "en-US",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as Request;

            await expect(getUser(mockRequest)).rejects.toThrow(
                "Account ID not found in token"
            );
        });
    });

    describe("getAccountId", () => {
        it("should return account_id from token for NextApiRequest", async () => {
            const mockToken = {
                account_id: 456,
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getAccountId(mockRequest);

            expect(result).toBe(456);
            expect(mockGetToken).toHaveBeenCalledWith({
                req: mockRequest,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName:
                    process.env.NODE_ENV === "production"
                        ? "__Secure-next-auth.session-token.v1"
                        : "next-auth.session-token.v1",
            });
        });

        it("should return account_id from token for NextRequest", async () => {
            const mockToken = {
                account_id: 789,
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextRequest;
            const result = await getAccountId(mockRequest);

            expect(result).toBe(789);
        });

        it("should return undefined when token is null", async () => {
            mockGetToken.mockResolvedValue(null);

            const mockRequest = {} as NextApiRequest;
            const result = await getAccountId(mockRequest);

            expect(result).toBeUndefined();
        });

        it("should return undefined when account_id is missing", async () => {
            const mockToken = {
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getAccountId(mockRequest);

            expect(result).toBeUndefined();
        });
    });

    describe("getUserId", () => {
        it("should return user id from token for NextApiRequest", async () => {
            const mockToken = {
                id: "user-456",
                account_id: 123,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserId(mockRequest);

            expect(result).toBe("user-456");
            expect(mockGetToken).toHaveBeenCalledWith({
                req: mockRequest,
                secret: process.env.NEXTAUTH_SECRET,
                cookieName:
                    process.env.NODE_ENV === "production"
                        ? "__Secure-next-auth.session-token.v1"
                        : "next-auth.session-token.v1",
            });
        });

        it("should return user id from token for NextRequest", async () => {
            const mockToken = {
                id: "user-789",
                account_id: 123,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextRequest;
            const result = await getUserId(mockRequest);

            expect(result).toBe("user-789");
        });

        it("should return undefined when token is null", async () => {
            mockGetToken.mockResolvedValue(null);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserId(mockRequest);

            expect(result).toBeUndefined();
        });

        it("should return undefined when id is missing", async () => {
            const mockToken = {
                account_id: 123,
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserId(mockRequest);

            expect(result).toBeUndefined();
        });
    });

    describe("getUserLanguage", () => {
        it("should return 'en' for English language", async () => {
            const mockToken = {
                language: "English",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("en");
        });

        it("should return 'he' for Hebrew language", async () => {
            const mockToken = {
                language: "Hebrew",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("he");
        });

        it("should default to 'en' when language is missing", async () => {
            const mockToken = {
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("en");
        });

        it("should default to 'en' when language is null", async () => {
            const mockToken = {
                language: null,
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("en");
        });

        it("should default to 'en' when language is unknown", async () => {
            const mockToken = {
                language: "Spanish",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("en");
        });

        it("should default to 'en' when token is null", async () => {
            mockGetToken.mockResolvedValue(null);

            const mockRequest = {} as NextApiRequest;
            const result = await getUserLanguage(mockRequest);

            expect(result).toBe("en");
        });

        it("should use production cookie name in production environment", async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

            process.env.NODE_ENV = "production";
            process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";

            const mockToken = {
                language: "English",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            await getUserLanguage(mockRequest);

            expect(mockGetToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    cookieName: "__Secure-next-auth.session-token.v1",
                })
            );

            process.env.NODE_ENV = originalEnv;
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
        });

        it("should use development cookie name in non-production environment", async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;

            process.env.NODE_ENV = "development";
            process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

            const mockToken = {
                language: "English",
                id: "user-123",
            };

            mockGetToken.mockResolvedValue(mockToken);

            const mockRequest = {} as NextApiRequest;
            await getUserLanguage(mockRequest);

            expect(mockGetToken).toHaveBeenCalledWith(
                expect.objectContaining({
                    cookieName: "next-auth.session-token.v1",
                })
            );

            process.env.NODE_ENV = originalEnv;
            process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
        });
    });
});


