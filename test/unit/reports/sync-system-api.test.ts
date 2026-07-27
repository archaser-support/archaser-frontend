import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMocks } from "node-mocks-http";
import type { NextApiRequest, NextApiResponse } from "next";

import handler from "@/pages/api/reports/sync-system";

// Mock next-auth session
vi.mock("next-auth", () => ({
    getServerSession: vi.fn(),
}));

// Mock authOptions import used by the handler
vi.mock("@/server/auth/authOptions", () => ({
    authOptions: {},
}));

// Mock AccessControlService
const getUserInfoMock = vi.fn();
vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: () => ({
            getUserInfo: getUserInfoMock,
        }),
    },
}));

// Mock ReportService
const syncMock = vi.fn();
vi.mock("@/server/services/ReportService", () => ({
    ReportService: {
        getInstance: () => ({
            syncSystemReportsToAllAccounts: syncMock,
        }),
    },
}));

import { getServerSession } from "next-auth";

describe("POST /api/reports/sync-system", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 405 for non-POST", async () => {
        (getServerSession as any).mockResolvedValueOnce({ user: { id: "u" } });
        getUserInfoMock.mockResolvedValueOnce({
            accountId: 10013,
            userId: "u",
            role: "archaser_admin",
        });

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "GET",
        });

        await handler(req, res);
        expect(res._getStatusCode()).toBe(405);
    });

    it("should return 401 when unauthenticated", async () => {
        (getServerSession as any).mockResolvedValueOnce(null);

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: { reportIds: [1] },
        });

        await handler(req, res);
        expect(res._getStatusCode()).toBe(401);
    });

    it("should return 403 when account is not 10013", async () => {
        (getServerSession as any).mockResolvedValueOnce({ user: { id: "u" } });
        getUserInfoMock.mockResolvedValueOnce({
            accountId: 20001,
            userId: "u",
            role: "Account_Manager",
        });

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: { reportIds: [1] },
        });

        await handler(req, res);
        expect(res._getStatusCode()).toBe(403);
    });

    it("should return 400 for missing/invalid reportIds", async () => {
        (getServerSession as any).mockResolvedValueOnce({ user: { id: "u" } });
        getUserInfoMock.mockResolvedValueOnce({
            accountId: 10013,
            userId: "u",
            role: "archaser_admin",
        });

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: { reportIds: [] },
        });

        await handler(req, res);
        expect(res._getStatusCode()).toBe(400);
    });

    it("should call service and return 200", async () => {
        (getServerSession as any).mockResolvedValueOnce({ user: { id: "u" } });
        getUserInfoMock.mockResolvedValueOnce({
            accountId: 10013,
            userId: "u",
            role: "archaser_admin",
        });

        syncMock.mockResolvedValueOnce({
            syncedReports: 2,
            targetAccounts: 10,
            created: 3,
            updated: 17,
        });

        const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
            method: "POST",
            body: { reportIds: [1, 2] },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        const data = JSON.parse(res._getData());
        expect(data).toEqual({
            syncedReports: 2,
            targetAccounts: 10,
            created: 3,
            updated: 17,
        });
        expect(syncMock).toHaveBeenCalledWith([1, 2], "u");
    });
});

