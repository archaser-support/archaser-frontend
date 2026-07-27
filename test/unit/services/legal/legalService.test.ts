/**
 * Unit Test: Legal Service
 * 
 * Tests: Legal service functions including fetchLegalCases and fetchLegalStats
 * 
 * 📚 Documentation:
 * - Unit Testing Guide: docs/unit-testing-guide.md
 * - Best Practices: docs/development-guides/unit-testing-best-practices.md
 */

import { vi, beforeEach, describe, it, expect } from "vitest";

import { fetchLegalCases, fetchLegalStats, type LegalCasesResponse, type LegalCasesParams } from "@/shared/services/legalService";

// Mock the api module (not axios directly)
// Note: The mock factory must not reference variables outside its scope
vi.mock("@/app/api", () => ({
    default: {
        get: vi.fn(),
    },
}));

describe("Legal Service", () => {
    let mockApiGet: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        vi.clearAllMocks();
        // Get the mocked api instance
        const api = (await import("@/app/api")).default;
        mockApiGet = api.get as ReturnType<typeof vi.fn>;
        // Reset the mock implementation
        mockApiGet.mockReset();
    });

    describe("fetchLegalCases", () => {
        const mockLegalCasesResponse: LegalCasesResponse = {
            legalCases: [
                {
                    id: 1,
                    customer_id: 100,
                    customer: "Test Customer",
                    customer_number: "CUST-001",
                    amount_overdue: 5000,
                    amount_formatted: "$5,000.00",
                    days_past_due: 30,
                    customer_country: "United States",
                    customer_state: "CA",
                    customer_current_time: "2025-01-15T10:00:00Z",
                    last_call: "2025-01-10T14:00:00Z",
                    last_call_result: "No Answer",
                    period_start_date: "2025-01-01",
                    period_end_date: null,
                    currency: "USD",
                    date_moved_to_legal: "2025-01-15T00:00:00Z",
                },
            ],
            totalRecords: 1,
            currentPage: 1,
            totalPages: 1,
            currency: "USD",
            totalAmount: 5000,
            totalCustomers: 1,
        };

        it("should fetch legal cases with default parameters", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const queryKey: [string, LegalCasesParams] = ["legal-cases", {}];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "",
                    page: 1,
                    limit: 10,
                    country: "",
                    sortField: "last_call",
                    sortDirection: "desc",
                },
            });
        });

        it("should fetch legal cases with custom parameters", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const params: LegalCasesParams = {
                search: "Test Customer",
                page: 2,
                limit: 20,
                country: "United States",
                sortField: "amount_overdue",
                sortDirection: "asc",
            };
            const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "Test Customer",
                    page: 2,
                    limit: 20,
                    country: "United States",
                    sortField: "amount_overdue",
                    sortDirection: "asc",
                },
            });
        });

        it("should handle partial parameters", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const params: LegalCasesParams = {
                search: "Test",
                page: 3,
            };
            const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "Test",
                    page: 3,
                    limit: 10, // Default
                    country: "", // Default
                    sortField: "last_call", // Default
                    sortDirection: "desc", // Default
                },
            });
        });

        it("should handle empty search string", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const params: LegalCasesParams = {
                search: "",
            };
            const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "",
                    page: 1,
                    limit: 10,
                    country: "",
                    sortField: "last_call",
                    sortDirection: "desc",
                },
            });
        });

        it("should handle special characters in search", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const params: LegalCasesParams = {
                search: "Test & Company <Special>",
            };
            const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "Test & Company <Special>",
                    page: 1,
                    limit: 10,
                    country: "",
                    sortField: "last_call",
                    sortDirection: "desc",
                },
            });
        });

        it("should throw error when API call fails", async () => {
            // Arrange
            mockApiGet.mockRejectedValueOnce(new Error("Network error"));

            const queryKey: [string, LegalCasesParams] = ["legal-cases", {}];

            // Act & Assert
            await expect(fetchLegalCases({ queryKey })).rejects.toThrow(
                "Failed to fetch legal cases"
            );
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "",
                    page: 1,
                    limit: 10,
                    country: "",
                    sortField: "last_call",
                    sortDirection: "desc",
                },
            });
        });

        it("should throw error when API returns error response", async () => {
            // Arrange
            mockApiGet.mockRejectedValueOnce({
                response: {
                    status: 500,
                    data: { message: "Internal server error" },
                },
            });

            const queryKey: [string, LegalCasesParams] = ["legal-cases", {}];

            // Act & Assert
            await expect(fetchLegalCases({ queryKey })).rejects.toThrow(
                "Failed to fetch legal cases"
            );
        });

        it("should handle large page numbers", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const params: LegalCasesParams = {
                page: 1000,
                limit: 100,
            };
            const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

            // Act
            const result = await fetchLegalCases({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalCasesResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                params: {
                    search: "",
                    page: 1000,
                    limit: 100,
                    country: "",
                    sortField: "last_call",
                    sortDirection: "desc",
                },
            });
        });

        it("should handle different sort fields and directions", async () => {
            // Arrange
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalCasesResponse,
            });

            const sortFields = ["last_call", "amount_overdue", "days_past_due", "customer"];
            const sortDirections = ["asc", "desc"];

            for (const sortField of sortFields) {
                for (const sortDirection of sortDirections) {
                    vi.clearAllMocks();
                    mockApiGet.mockResolvedValueOnce({
                        data: mockLegalCasesResponse,
                    });

                    const params: LegalCasesParams = {
                        sortField,
                        sortDirection: sortDirection as "asc" | "desc",
                    };
                    const queryKey: [string, LegalCasesParams] = ["legal-cases", params];

                    // Act
                    await fetchLegalCases({ queryKey });

                    // Assert
                    expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases", {
                        params: {
                            search: "",
                            page: 1,
                            limit: 10,
                            country: "",
                            sortField,
                            sortDirection,
                        },
                    });
                }
            }
        });
    });

    describe("fetchLegalStats", () => {
        const mockLegalStatsResponse: LegalCasesResponse = {
            legalCases: [],
            totalRecords: 0,
            currentPage: 1,
            totalPages: 0,
            currency: "USD",
            totalAmount: 15000,
            totalCustomers: 3,
        };

        it("should fetch legal stats without parameters", async () => {
            // Arrange
            mockApiGet.mockReset();
            mockApiGet.mockResolvedValueOnce({
                data: mockLegalStatsResponse,
            });

            const queryKey: [string] = ["legal-stats"];

            // Act
            const result = await fetchLegalStats({ queryKey });

            // Assert
            expect(result).toEqual(mockLegalStatsResponse);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases/stats");
            expect(mockApiGet).toHaveBeenCalledTimes(1);
        });

        it("should throw error when API call fails", async () => {
            // Arrange
            mockApiGet.mockReset();
            mockApiGet.mockRejectedValueOnce(new Error("Network error"));

            const queryKey: [string] = ["legal-stats"];

            // Act & Assert
            await expect(fetchLegalStats({ queryKey })).rejects.toThrow(
                "Failed to fetch legal stats"
            );
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases/stats");
            expect(mockApiGet).toHaveBeenCalledTimes(1);
        });

        it("should throw error when API returns error response", async () => {
            // Arrange
            mockApiGet.mockRejectedValueOnce({
                response: {
                    status: 404,
                    data: { message: "Not found" },
                },
            });

            const queryKey: [string] = ["legal-stats"];

            // Act & Assert
            await expect(fetchLegalStats({ queryKey })).rejects.toThrow(
                "Failed to fetch legal stats"
            );
        });

        it("should handle empty stats response", async () => {
            // Arrange
            mockApiGet.mockReset();
            const emptyResponse: LegalCasesResponse = {
                legalCases: [],
                totalRecords: 0,
                currentPage: 1,
                totalPages: 0,
                currency: "USD",
                totalAmount: 0,
                totalCustomers: 0,
            };
            mockApiGet.mockResolvedValueOnce({
                data: emptyResponse,
            });

            const queryKey: [string] = ["legal-stats"];

            // Act
            const result = await fetchLegalStats({ queryKey });

            // Assert
            expect(result).toEqual(emptyResponse);
            expect(result.totalAmount).toBe(0);
            expect(result.totalCustomers).toBe(0);
            expect(mockApiGet).toHaveBeenCalledWith("/operations/legal-cases/stats");
            expect(mockApiGet).toHaveBeenCalledTimes(1);
        });
    });
});
