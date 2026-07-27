import { vi } from "vitest";

// Mock NextAuth JWT
vi.mock("next-auth/jwt", () => ({
    getToken: vi.fn().mockResolvedValue({
        account_id: 1,
        user_id: "test-user-id",
        role: "Admin",
    }),
}));

// Mock Prisma client
vi.mock("@/lib/prisma", () => ({
    prisma: {
        customer: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
        activitiesSequence: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
        activitiesTemplate: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
        disputeReason: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            deleteMany: vi.fn(),
        },
        $transaction: vi.fn(),
        $connect: vi.fn(),
        $disconnect: vi.fn(),
    },
}));

// Mock AccountService
vi.mock("@/server/services/AccountService", () => ({
    AccountService: {
        createCustomer: vi.fn(),
    },
}));

// Mock AccessControlService
vi.mock("@/server/services/AccessControlService", () => ({
    AccessControlService: {
        getInstance: vi.fn().mockReturnValue({
            getUserInfo: vi.fn().mockResolvedValue({
                accountId: 1,
                role: "Admin",
                isAccountManager: true,
            }),
        }),
    },
}));

// Mock file upload service
vi.mock("@/lib/fileUploadService", () => ({
    FileUploadService: {
        uploadFile: vi.fn(),
    },
}));

// Mock formidable
vi.mock("formidable", () => ({
    default: vi.fn().mockReturnValue({
        parse: vi.fn().mockResolvedValue([{}, {}]),
    }),
}));
