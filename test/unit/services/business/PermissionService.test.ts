import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

import { PermissionService } from "@/server/services/PermissionService";

describe("PermissionService.updateRolePermissions", () => {
    let mockPrisma: any;
    let permissionService: PermissionService;

    beforeEach(async () => {
        vi.clearAllMocks();

        const { prisma } = await import("@/lib/prisma");
        mockPrisma = prisma;
        mockPrisma.$transaction.mockImplementation((callback: any) =>
            callback(mockPrisma)
        );

        permissionService = PermissionService.getInstance();
    });

    it("wraps permission replacement in a transaction", async () => {
        const permissions = permissionService.getAllPermissionKeys().slice(0, 2);
        mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
        mockPrisma.rolePermission.upsert.mockResolvedValue({});

        await permissionService.updateRolePermissions(
            42,
            "Collection_Manager",
            permissions,
            "user-1"
        );

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
            where: {
                account_id: 42,
                role: "Collection_Manager",
                permission_key: {
                    notIn: permissions,
                },
            },
        });
        expect(mockPrisma.rolePermission.upsert).toHaveBeenCalledTimes(
            permissions.length
        );
    });

    it("rethrows upsert failures so the transaction can rollback", async () => {
        const permission = permissionService.getAllPermissionKeys()[0];
        mockPrisma.rolePermission.deleteMany.mockResolvedValue({ count: 0 });
        mockPrisma.rolePermission.upsert.mockRejectedValueOnce(
            new Error("boom")
        );

        await expect(
            permissionService.updateRolePermissions(
                42,
                "Collection_Manager",
                [permission],
                "user-1"
            )
        ).rejects.toThrow("boom");

        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
});
