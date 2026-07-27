import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { prisma } from "@/lib/prisma";
import { ContactService } from "@/server/services/ContactService";
import { createPrismaMock } from "@/test/mocks/prisma";

// Mock Prisma
vi.mock("@/lib/prisma", async () => {
    const { createPrismaMock } = await import("@/test/mocks/prisma");
    return {
        prisma: createPrismaMock(),
    };
});

// Mock LogService
vi.mock("@/server/services/LogService", () => ({
    LogService: {
        getInstance: vi.fn(() => ({
            logMessage: vi.fn().mockResolvedValue(undefined),
        })),
    },
    logService: {
        logMessage: vi.fn().mockResolvedValue(undefined),
    },
    logMessage: vi.fn().mockResolvedValue(undefined),
}));

// Mock MongoLogService
vi.mock("@/server/services/MongoLogService", () => ({
    default: {
        getInstance: vi.fn(() => ({
            createLog: vi.fn().mockResolvedValue(undefined),
            logMessage: vi.fn().mockResolvedValue(undefined),
        })),
    },
}));

// Mock utility functions with dynamic implementation
const mockIdentifyCountry = vi.fn();
vi.mock("@/utils/phoneNumberUtils", () => ({
    identifyCountryFromPhoneNumber: (phoneNumber: string) => mockIdentifyCountry(phoneNumber),
}));

vi.mock("@/server/cron-jobs/activityWorkflowManager", () => ({
    clearStuckFlagForCustomer: vi.fn().mockResolvedValue(undefined),
}));

// Mock phone number library
vi.mock("libphonenumber-js", () => ({
    parsePhoneNumber: vi.fn(),
    getCountryCallingCode: vi.fn(),
}));

describe("ContactService", () => {
    let contactService: ContactService;

    beforeEach(() => {
        contactService = new ContactService();
        vi.clearAllMocks();
        // Default: return null for phone number identification
        mockIdentifyCountry.mockReturnValue(null);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("Contact Creation", () => {
        it("should create a new contact with basic information", async () => {
            const contactData = {
                first_name: "John",
                last_name: "Doe",
                email: "john.doe@example.com",
                phone: "+1234567890",
                mobile: "+9876543210",
                company_id: 1,
                role: "Manager",
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
            expect(prisma.contact.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    first_name: "John",
                    last_name: "Doe",
                    email: "john.doe@example.com",
                    company_id: 1,
                }),
            });
        });

        it("should create contact without optional fields", async () => {
            const contactData = {
                first_name: "Jane",
                company_id: 1,
            };

            const mockContact = {
                id: 2,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
            expect(prisma.contact.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    first_name: "Jane",
                    company_id: 1,
                }),
            });
        });

        it("should throw error when company does not exist", async () => {
            const contactData = {
                first_name: "John",
                company_id: 999,
            };

            (prisma.company.findUnique as any).mockResolvedValue(null);

            await expect(
                contactService.upsertContact(contactData)
            ).rejects.toThrow();
        });
    });

    describe("Contact Update", () => {
        it("should update existing contact", async () => {
            const contactData = {
                id: 1,
                first_name: "John",
                last_name: "Updated",
                email: "john.updated@example.com",
                company_id: 1,
            };

            const mockExistingContact = {
                id: 1,
                first_name: "John",
                last_name: "Doe",
                email: "john.doe@example.com",
                mobile: "+1234567890",
                company_id: 1,
                country_id: null,
            };

            const mockUpdatedContact = {
                ...mockExistingContact,
                ...contactData,
                modified_at: new Date(),
            };

            (prisma.contact.findUnique as any).mockResolvedValue(
                mockExistingContact
            );
            (prisma.contact.update as any).mockResolvedValue(
                mockUpdatedContact
            );
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockUpdatedContact);
            expect(prisma.contact.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    first_name: "John",
                    last_name: "Updated",
                    email: "john.updated@example.com",
                }),
            });
        });

        it("should update contact when mobile number changes", async () => {
            const contactData = {
                id: 1,
                first_name: "John",
                mobile: "+972541234567", // Israeli number
                company_id: 1,
            };

            const mockExistingContact = {
                id: 1,
                first_name: "John",
                mobile: "+1234567890", // Different number
                company_id: 1,
                country_id: null,
            };

            const mockCountry = {
                id: 106,
                name: "Israel",
                iso2: "IL",
                phonecode: "972",
            };

            const mockUpdatedContact = {
                ...mockExistingContact,
                ...contactData,
                country_id: 106,
                modified_at: new Date(),
            };

            // Mock country identification for Israel
            mockIdentifyCountry.mockReturnValue({
                id: 0,
                name: "Israel",
                phonecode: "972",
                iso2: "IL",
            });

            (prisma.contact.findUnique as any).mockResolvedValue(
                mockExistingContact
            );
            (prisma.contact.update as any).mockResolvedValue(
                mockUpdatedContact
            );
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockUpdatedContact);
            expect(prisma.contact.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    mobile: "+972541234567",
                    country_id: 106,
                }),
            });
        });
    });

    describe("Country Detection from Mobile Number", () => {
        it("should detect US country from mobile number", async () => {
            const contactData = {
                first_name: "John",
                mobile: "+15551234567",
                company_id: 1,
            };

            const mockCountry = {
                id: 232,
                name: "United States",
                iso2: "US",
                phonecode: "1",
            };

            const mockContact = {
                id: 1,
                ...contactData,
                country_id: 232,
                created_at: new Date(),
                modified_at: new Date(),
            };

            // Mock country identification for US
            mockIdentifyCountry.mockReturnValue({
                id: 0,
                name: "United States",
                phonecode: "1",
                iso2: "US",
            });

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBe(232);
            expect(prisma.country.findFirst).toHaveBeenCalledWith({
                where: { iso2: "US" },
                select: { id: true },
            });
        });

        it("should detect Canadian country from mobile number", async () => {
            const contactData = {
                first_name: "Marie",
                mobile: "+14161234567",
                company_id: 1,
            };

            const mockCountry = {
                id: 124,
                name: "Canada",
                iso2: "CA",
                phonecode: "1",
            };

            const mockContact = {
                id: 4,
                ...contactData,
                country_id: 124,
                created_at: new Date(),
                modified_at: new Date(),
            };

            // Mock country identification for Canada
            mockIdentifyCountry.mockReturnValue({
                id: 0,
                name: "Canada",
                phonecode: "1",
                iso2: "CA",
            });

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBe(124);
            expect(prisma.country.findFirst).toHaveBeenCalledWith({
                where: { iso2: "CA" },
                select: { id: true },
            });
        });

        it("should detect UK country from mobile number", async () => {
            const contactData = {
                first_name: "Jane",
                mobile: "+447911123456",
                company_id: 1,
            };

            const mockCountry = {
                id: 826,
                name: "United Kingdom",
                iso2: "GB",
                phonecode: "44",
            };

            const mockContact = {
                id: 2,
                ...contactData,
                country_id: 826,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBe(826);
        });

        it("should detect India country from mobile number", async () => {
            const contactData = {
                first_name: "Raj",
                mobile: "+919876543210",
                company_id: 1,
            };

            const mockCountry = {
                id: 101,
                name: "India",
                iso2: "IN",
                phonecode: "91",
            };

            const mockContact = {
                id: 3,
                ...contactData,
                country_id: 101,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBe(101);
        });

        it("should handle invalid mobile number format", async () => {
            const contactData = {
                first_name: "John",
                mobile: "invalid-number",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                country_id: null,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(null);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBeNull();
            expect(prisma.country.findFirst).not.toHaveBeenCalled();
        });

        it("should handle country not found in database", async () => {
            const contactData = {
                first_name: "John",
                mobile: "+999123456789", // Non-existent country code
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                country_id: null,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(null);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBeNull();
        });

        it("should update country when mobile number changes", async () => {
            const contactData = {
                id: 1,
                first_name: "John",
                mobile: "+919876543210", // Indian number
                company_id: 1,
            };

            const mockExistingContact = {
                id: 1,
                first_name: "John",
                mobile: "+15551234567", // US number
                company_id: 1,
                country_id: 232, // US country ID
            };

            const mockCountry = {
                id: 101,
                name: "India",
                iso2: "IN",
                phonecode: "91",
            };

            const mockUpdatedContact = {
                ...mockExistingContact,
                mobile: "+919876543210",
                country_id: 101,
                modified_at: new Date(),
            };

            // Mock country identification for India
            mockIdentifyCountry.mockReturnValue({
                id: 0,
                name: "India",
                phonecode: "91",
                iso2: "IN",
            });

            (prisma.contact.findUnique as any).mockResolvedValue(
                mockExistingContact
            );
            (prisma.contact.update as any).mockResolvedValue(
                mockUpdatedContact
            );
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.country.findFirst as any).mockResolvedValue(mockCountry);

            const result = await contactService.upsertContact(contactData);

            expect(result.country_id).toBe(101);
            expect(prisma.contact.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: expect.objectContaining({
                    mobile: "+919876543210",
                    country_id: 101,
                }),
            });
        });
    });

    describe("Contact Validation", () => {
        it("should validate required fields", async () => {
            const contactData = {
                // Missing first_name
                first_name: "", // Empty string to test validation
                company_id: 1,
            };

            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            await expect(
                contactService.upsertContact(contactData)
            ).rejects.toThrow();
        });

        it("should validate email format", async () => {
            const contactData = {
                first_name: "John",
                email: "invalid-email",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            // Should still create contact but with invalid email
            expect(result).toBeDefined();
        });

        it("should validate phone number format", async () => {
            const contactData = {
                first_name: "John",
                phone: "invalid-phone",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toBeDefined();
        });
    });

    describe("Contact Retrieval", () => {
        it("should get contact by ID with company and country info", async () => {
            const mockContact = {
                id: 1,
                first_name: "John",
                last_name: "Doe",
                email: "john.doe@example.com",
                mobile: "+15551234567",
                company_id: 1,
                country_id: 232,
                Company: {
                    name: "Test Company",
                },
                Country: {
                    id: 232,
                    name: "United States",
                    iso2: "US",
                },
            };

            (prisma.contact.findUnique as any).mockResolvedValue(mockContact);

            const result = await contactService.getContactById(1);

            expect(result).toEqual(mockContact);
            expect(prisma.contact.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                include: {
                    Company: {
                        select: { name: true },
                    },
                    Country: {
                        select: { id: true, name: true, iso2: true },
                    },
                },
            });
        });

        it("should return null for non-existent contact", async () => {
            (prisma.contact.findUnique as any).mockResolvedValue(null);

            const result = await contactService.getContactById(999);

            expect(result).toBeNull();
        });
    });

    describe("Contact List Retrieval", () => {
        it("should get contacts with pagination and search", async () => {
            const mockContacts = [
                {
                    id: 1,
                    first_name: "John",
                    last_name: "Doe",
                    email: "john.doe@example.com",
                    company_id: 1,
                    Company: { name: "Test Company" },
                },
                {
                    id: 2,
                    first_name: "Jane",
                    last_name: "Smith",
                    email: "jane.smith@example.com",
                    company_id: 1,
                    Company: { name: "Test Company" },
                },
            ];

            (prisma.contact.findMany as any).mockResolvedValue(mockContacts);
            (prisma.contact.count as any).mockResolvedValue(2);

            const result = await contactService.getContacts({
                page: 1,
                limit: 10,
                search: "John",
                companyId: 1,
            });

            expect(result.contacts).toEqual(mockContacts);
            expect(result.totalRecords).toBe(2);
        });

        it("should filter contacts by status", async () => {
            const mockContacts = [
                {
                    id: 1,
                    first_name: "John",
                    status: "Active",
                    company_id: 1,
                    Company: { name: "Test Company" },
                },
            ];

            (prisma.contact.findMany as any).mockResolvedValue(mockContacts);
            (prisma.contact.count as any).mockResolvedValue(1);

            const result = await contactService.getContacts({
                page: 1,
                limit: 10,
                status: "Active",
                companyId: 1,
            });

            expect(result.contacts).toEqual(mockContacts);
            expect(result.totalRecords).toBe(1);
        });
    });

    describe("Error Handling", () => {
        it("should handle database connection errors", async () => {
            const contactData = {
                first_name: "John",
                company_id: 1,
            };

            (prisma.company.findUnique as any).mockRejectedValue(
                new Error("Database connection failed")
            );

            await expect(
                contactService.upsertContact(contactData)
            ).rejects.toThrow("Database connection failed");
        });

        it("should handle invalid company ID", async () => {
            const contactData = {
                first_name: "John",
                company_id: 999,
            };

            (prisma.company.findUnique as any).mockResolvedValue(null);

            await expect(
                contactService.upsertContact(contactData)
            ).rejects.toThrow();
        });

        it("should handle duplicate contact creation", async () => {
            const contactData = {
                first_name: "John",
                email: "john.doe@example.com",
                company_id: 1,
            };

            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });
            (prisma.contact.create as any).mockRejectedValue(
                new Error("Unique constraint failed")
            );

            await expect(
                contactService.upsertContact(contactData)
            ).rejects.toThrow("Unique constraint failed");
        });
    });

    describe("Edge Cases", () => {
        it("should handle contact with only phone number (no mobile)", async () => {
            const contactData = {
                first_name: "John",
                phone: "+15551234567",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
        });

        it("should handle contact with only email (no phone/mobile)", async () => {
            const contactData = {
                first_name: "John",
                email: "john.doe@example.com",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
        });

        it("should handle contact with special characters in name", async () => {
            const contactData = {
                first_name: "José",
                last_name: "García-López",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
        });

        it("should handle very long email addresses", async () => {
            const contactData = {
                first_name: "John",
                email: "very.long.email.address.that.exceeds.normal.length@very.long.domain.name.com",
                company_id: 1,
            };

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData);

            expect(result).toEqual(mockContact);
        });
    });

    describe("Customer Country Fallback", () => {
        it("should fallback to customer country when phone has no country code", async () => {
            const contactData = {
                first_name: "John",
                phone: "1234567890", // No country code
                company_id: 1,
                customer_id: 1,
            };
            const userId = "user-123";

            (prisma.customer.findUnique as any).mockResolvedValue({
                id: 1,
                country_id: 2,
            });

            const mockContact = {
                id: 1,
                ...contactData,
                country_id: 2,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData, userId);

            expect(prisma.customer.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                select: { country_id: true },
            });
            expect(result.country_id).toBe(2);
        });

        it("should use customer country when no phone number provided", async () => {
            const contactData = {
                first_name: "John",
                company_id: 1,
                customer_id: 1,
            };
            const userId = "user-123";

            (prisma.customer.findUnique as any).mockResolvedValue({
                id: 1,
                country_id: 3,
            });

            const mockContact = {
                id: 1,
                ...contactData,
                country_id: 3,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData, userId);

            expect(prisma.customer.findUnique).toHaveBeenCalledWith({
                where: { id: 1 },
                select: { country_id: true },
            });
            expect(result.country_id).toBe(3);
        });
    });

    describe("Data Trimming", () => {
        it("should trim whitespace from string fields", async () => {
            const contactData = {
                first_name: "  John  ",
                last_name: "  Doe  ",
                email: "  john@example.com  ",
                phone: "  +1234567890  ",
                mobile: "  +1234567891  ",
                role: "  Primary Contact  ",
                company_id: 1,
                customer_id: 1,
            };
            const userId = "user-123";

            const mockContact = {
                id: 1,
                first_name: "John",
                last_name: "Doe",
                email: "john@example.com",
                phone: "+1234567890",
                mobile: "+1234567891",
                role: "Primary Contact",
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            const result = await contactService.upsertContact(contactData, userId);

            expect(prisma.contact.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        first_name: "John",
                        last_name: "Doe",
                        email: "john@example.com",
                        phone: "+1234567890",
                        mobile: "+1234567891",
                        role: "Primary Contact",
                    }),
                })
            );
            expect(result.first_name).toBe("John");
        });
    });

    describe("Boolean Field Handling", () => {
        it("should handle company_wide_address boolean", async () => {
            const contactData = {
                first_name: "John",
                company_id: 1,
                customer_id: 1,
                company_wide_address: true,
            };
            const userId = "user-123";

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            await contactService.upsertContact(contactData, userId);

            expect(prisma.contact.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        company_wide_address: true,
                    }),
                })
            );
        });

        it("should handle reminder flags", async () => {
            const contactData = {
                first_name: "John",
                company_id: 1,
                customer_id: 1,
                receives_standard_reminder: true,
                receives_escalated_reminder: false,
            };
            const userId = "user-123";

            const mockContact = {
                id: 1,
                ...contactData,
                created_at: new Date(),
                modified_at: new Date(),
            };

            (prisma.contact.create as any).mockResolvedValue(mockContact);
            (prisma.company.findUnique as any).mockResolvedValue({
                id: 1,
                name: "Test Company",
            });

            await contactService.upsertContact(contactData, userId);

            expect(prisma.contact.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        receives_standard_reminder: true,
                        receives_escalated_reminder: false,
                    }),
                })
            );
        });
    });
});
