import { beforeEach, describe, expect, it, vi } from "vitest";

import { ImportContactService } from "@/server/services/import/ImportContactService";
import { createPrismaMock } from "@/test/mocks/prisma";

const mockUpsertContact = vi.fn();

const { prismaHolder } = vi.hoisted(() => ({
    prismaHolder: {
        prisma: null as ReturnType<typeof createPrismaMock> | null,
    },
}));

vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    prismaHolder.prisma = createPrismaMock();
    return {
        prismaJobs: () => prismaHolder.prisma!,
    };
});

vi.mock("@/server/services/ContactService", () => ({
    ContactService: vi.fn().mockImplementation(() => ({
        upsertContact: mockUpsertContact,
    })),
}));

describe("ImportContactService", () => {
    let mockPrisma: ReturnType<typeof createPrismaMock>;

    beforeEach(async () => {
        vi.clearAllMocks();
        mockPrisma = prismaHolder.prisma!;
        mockUpsertContact.mockResolvedValue({ id: 77 });
    });

    it("upserts by company_id and erp_contact_id when ERP id is provided", async () => {
        mockPrisma.contact.findFirst.mockResolvedValue({ id: 12 });

        const service = new ImportContactService();
        await service.importContact(
            {
                first_name: "Jane",
                customer_number: "CUST-1",
                erp_contact_id: "ERP-100",
            },
            5,
            9,
            "user-1"
        );

        expect(mockPrisma.contact.findFirst).toHaveBeenCalledWith({
            where: {
                company_id: 5,
                erp_contact_id: "ERP-100",
            },
            select: { id: true },
        });
        expect(mockUpsertContact).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 12,
                first_name: "Jane",
                erp_contact_id: "ERP-100",
                company_id: 5,
                customer_id: 9,
            }),
            "user-1"
        );
    });

    it("creates a new contact when erp_contact_id is not mapped", async () => {
        const service = new ImportContactService();
        await service.importContact(
            {
                first_name: "Bob",
                customer_number: "CUST-1",
            },
            5,
            9
        );

        expect(mockPrisma.contact.findFirst).not.toHaveBeenCalled();
        expect(mockUpsertContact).toHaveBeenCalledWith(
            expect.objectContaining({
                first_name: "Bob",
                company_id: 5,
                customer_id: 9,
            }),
            undefined
        );
    });
});
