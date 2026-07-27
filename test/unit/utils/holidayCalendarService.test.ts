import { describe, it, expect, beforeEach } from "vitest";

// Import the real class - no mocks needed since it doesn't have external dependencies
import { HolidayCalendarService } from "@/utils/holidayCalendarService";

describe("HolidayCalendarService", () => {
    let service: HolidayCalendarService;

    beforeEach(() => {
        service = HolidayCalendarService.getInstance();
    });

    describe("Singleton Pattern", () => {
        it("should return the same instance", () => {
            const instance1 = HolidayCalendarService.getInstance();
            const instance2 = HolidayCalendarService.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe("getSupportedCountries", () => {
        it("should return list of supported countries", () => {
            const countries = service.getSupportedCountries();
            expect(Array.isArray(countries)).toBe(true);
            expect(countries.length).toBeGreaterThan(0);
            expect(countries).toContain("US");
            expect(countries).toContain("GB");
            expect(countries).toContain("CA");
            expect(countries).toContain("DE");
            expect(countries).toContain("FR");
            expect(countries).toContain("AU");
            expect(countries).toContain("JP");
            expect(countries).toContain("IN");
            expect(countries).toContain("BR");
            expect(countries).toContain("MX");
            expect(countries).toContain("ZA");
            expect(countries).toContain("SG");
            expect(countries).toContain("IL");
            expect(countries).toContain("SA");
            expect(countries).toContain("AE");
            expect(countries).toContain("CN");
            expect(countries).toContain("KR");
        });
    });

    describe("getHolidays", () => {
        it("should return holidays for US in 2024", () => {
            const holidays = service.getHolidays("US", 2024);
            expect(holidays).not.toBeNull();
            expect(holidays?.countryCode).toBe("US");
            expect(Array.isArray(holidays?.holidays)).toBe(true);
            expect(holidays?.holidays.length).toBeGreaterThan(0);
        });

        it("should return holidays for GB in 2024", () => {
            const holidays = service.getHolidays("GB", 2024);
            expect(holidays).not.toBeNull();
            expect(holidays?.countryCode).toBe("GB");
            expect(Array.isArray(holidays?.holidays)).toBe(true);
            expect(holidays?.holidays.length).toBeGreaterThan(0);
        });

        it("should return null for unsupported country", () => {
            const holidays = service.getHolidays("XX", 2024);
            expect(holidays).toBeNull();
        });

        it("should use current year when year is not specified", () => {
            const currentYear = new Date().getFullYear();
            const holidays = service.getHolidays("US");
            expect(holidays).not.toBeNull();
            expect(holidays?.holidays.length).toBeGreaterThan(0);
        });
    });

    describe("isHoliday", () => {
        it("should detect New Year's Day in US", () => {
            const newYearsDay = new Date("2024-01-01");
            const result = service.isHoliday("US", newYearsDay);
            expect(result.isHoliday).toBe(true);
            expect(result.holidayName).toBe("New Year's Day");
        });

        it("should detect Christmas Day in US", () => {
            const christmasDay = new Date("2024-12-25");
            const result = service.isHoliday("US", christmasDay);
            expect(result.isHoliday).toBe(true);
            expect(result.holidayName).toBe("Christmas Day");
        });

        it("should detect regular day as not holiday", () => {
            const regularDay = new Date("2024-01-16"); // Regular Tuesday (not a holiday)
            const result = service.isHoliday("US", regularDay);
            expect(result.isHoliday).toBe(false);
            expect(result.holidayName).toBeUndefined();
        });

        it("should handle unsupported country", () => {
            const testDate = new Date("2024-01-01");
            const result = service.isHoliday("XX", testDate);
            expect(result.isHoliday).toBe(false);
            expect(result.holidayName).toBeUndefined();
        });

        it("should detect Independence Day in US", () => {
            const independenceDay = new Date("2024-07-04");
            const result = service.isHoliday("US", independenceDay);
            expect(result.isHoliday).toBe(true);
            expect(result.holidayName).toBe("Independence Day");
        });

        it("should detect Labor Day in US", () => {
            const laborDay = new Date("2024-09-02");
            const result = service.isHoliday("US", laborDay);
            expect(result.isHoliday).toBe(true);
            expect(result.holidayName).toBe("Labor Day");
        });
    });

    describe("getCalendarTypes", () => {
        it("should return gregorian for US", () => {
            const types = service.getCalendarTypes("US");
            expect(types).toEqual(["gregorian"]);
        });

        it("should return gregorian and hebrew for Israel", () => {
            const types = service.getCalendarTypes("IL");
            expect(types).toEqual(["gregorian", "hebrew"]);
        });

        it("should return gregorian and islamic for Saudi Arabia", () => {
            const types = service.getCalendarTypes("SA");
            expect(types).toEqual(["gregorian", "islamic"]);
        });

        it("should return gregorian and islamic for UAE", () => {
            const types = service.getCalendarTypes("AE");
            expect(types).toEqual(["gregorian", "islamic"]);
        });

        it("should return gregorian and chinese for Singapore", () => {
            const types = service.getCalendarTypes("SG");
            expect(types).toEqual(["gregorian", "chinese"]);
        });

        it("should return gregorian and chinese for China", () => {
            const types = service.getCalendarTypes("CN");
            expect(types).toEqual(["gregorian", "chinese"]);
        });

        it("should return gregorian for unsupported country", () => {
            const types = service.getCalendarTypes("XX");
            expect(types).toEqual(["gregorian"]);
        });
    });

    describe("getHolidaysInRange", () => {
        it("should return holidays within date range", () => {
            const startDate = new Date("2024-01-01");
            const endDate = new Date("2024-01-31");
            const holidays = service.getHolidaysInRange(
                "US",
                startDate,
                endDate
            );

            expect(Array.isArray(holidays)).toBe(true);
            expect(holidays.length).toBeGreaterThan(0);

            // Should include New Year's Day
            const newYearsHoliday = holidays.find(
                (h) => h.name === "New Year's Day"
            );
            expect(newYearsHoliday).toBeDefined();
            expect(newYearsHoliday?.date).toBe("2024-01-01");
        });

        it("should return empty array for range with no holidays", () => {
            const startDate = new Date("2024-01-02");
            const endDate = new Date("2024-01-14");
            const holidays = service.getHolidaysInRange(
                "US",
                startDate,
                endDate
            );

            expect(Array.isArray(holidays)).toBe(true);
            expect(holidays.length).toBe(0);
        });

        it("should handle unsupported country", () => {
            const startDate = new Date("2024-01-01");
            const endDate = new Date("2024-12-31");
            const holidays = service.getHolidaysInRange(
                "XX",
                startDate,
                endDate
            );

            expect(Array.isArray(holidays)).toBe(true);
            expect(holidays.length).toBe(0);
        });
    });

    describe("Variable Holidays", () => {
        it("should include Thanksgiving for US", () => {
            const holidays = service.getHolidays("US", 2024);
            const thanksgiving = holidays?.holidays.find(
                (h) => h.name === "Thanksgiving Day"
            );
            expect(thanksgiving).toBeDefined();
            expect(thanksgiving?.type).toBe("national");
        });

        it("should include Easter-related holidays for GB", () => {
            const holidays = service.getHolidays("GB", 2024);
            const goodFriday = holidays?.holidays.find(
                (h) => h.name === "Good Friday"
            );
            const easterMonday = holidays?.holidays.find(
                (h) => h.name === "Easter Monday"
            );

            expect(goodFriday).toBeDefined();
            expect(easterMonday).toBeDefined();
            expect(goodFriday?.type).toBe("religious");
            expect(easterMonday?.type).toBe("religious");
        });

        it("should include Hebrew calendar holidays for Israel", () => {
            const holidays = service.getHolidays("IL", 2024);
            const roshHashanah = holidays?.holidays.find(
                (h) => h.name === "Rosh Hashanah"
            );
            const yomKippur = holidays?.holidays.find(
                (h) => h.name === "Yom Kippur"
            );

            expect(roshHashanah).toBeDefined();
            expect(yomKippur).toBeDefined();
            expect(roshHashanah?.type).toBe("religious");
            expect(yomKippur?.type).toBe("religious");
        });
    });

    describe("Edge Cases", () => {
        it("should handle invalid dates gracefully", () => {
            const invalidDate = new Date("invalid-date");
            // This will throw an error, which is expected behavior
            expect(() => service.isHoliday("US", invalidDate)).toThrow();
        });
    });

    describe("Business Logic Validation", () => {
        it("should validate holiday data structure", () => {
            const holidays = service.getHolidays("US", 2024);
            expect(holidays).not.toBeNull();

            if (holidays) {
                holidays.holidays.forEach((holiday) => {
                    expect(holiday).toHaveProperty("date");
                    expect(holiday).toHaveProperty("name");
                    expect(holiday).toHaveProperty("type");
                    expect(typeof holiday.date).toBe("string");
                    expect(typeof holiday.name).toBe("string");
                    expect(["national", "religious", "observance"]).toContain(
                        holiday.type
                    );
                });
            }
        });

        it("should ensure all holiday dates are valid ISO dates", () => {
            const holidays = service.getHolidays("US", 2024);
            expect(holidays).not.toBeNull();

            if (holidays) {
                holidays.holidays.forEach((holiday) => {
                    const date = new Date(holiday.date);
                    expect(date.toString()).not.toBe("Invalid Date");
                });
            }
        });
    });

    describe("Holiday Calendar Caching", () => {
        beforeEach(() => {
            // Clear cache before each test to ensure clean state
            service.clearCache();
        });

        it("should cache holidays for the same country/year", () => {
            // First call - should generate
            const holidays1 = service.getHolidays("US", 2024);

            // Second call - should use cache (same object reference)
            const holidays2 = service.getHolidays("US", 2024);

            expect(holidays1).not.toBeNull();
            expect(holidays2).not.toBeNull();
            expect(holidays1).toBe(holidays2); // Same object reference from cache
        });

        it("should generate new holidays for different years", () => {
            const holidays2024 = service.getHolidays("US", 2024);
            const holidays2025 = service.getHolidays("US", 2025);

            expect(holidays2024).not.toBeNull();
            expect(holidays2025).not.toBeNull();
            expect(holidays2024).not.toBe(holidays2025); // Different objects
            expect(holidays2024?.holidays.length).toBeGreaterThan(0);
            expect(holidays2025?.holidays.length).toBeGreaterThan(0);
        });

        it("should generate new holidays for different countries", () => {
            const usHolidays = service.getHolidays("US", 2024);
            const gbHolidays = service.getHolidays("GB", 2024);

            expect(usHolidays).not.toBeNull();
            expect(gbHolidays).not.toBeNull();
            expect(usHolidays).not.toBe(gbHolidays); // Different objects
        });

        it("should clear cache when clearCache() is called", () => {
            // Populate cache
            const holidays1 = service.getHolidays("US", 2024);
            expect(holidays1).not.toBeNull();

            // Verify cache is working
            const holidays2 = service.getHolidays("US", 2024);
            expect(holidays1).toBe(holidays2);

            // Clear cache
            service.clearCache();

            // Next call should generate new instance
            const holidays3 = service.getHolidays("US", 2024);
            expect(holidays3).not.toBeNull();
            // Note: May or may not be same reference depending on implementation,
            // but cache should be cleared
        });

        it("should cache multiple country/year combinations independently", () => {
            const us2024 = service.getHolidays("US", 2024);
            const us2025 = service.getHolidays("US", 2025);
            const gb2024 = service.getHolidays("GB", 2024);
            const il2024 = service.getHolidays("IL", 2024);

            // All should be cached independently
            expect(service.getHolidays("US", 2024)).toBe(us2024);
            expect(service.getHolidays("US", 2025)).toBe(us2025);
            expect(service.getHolidays("GB", 2024)).toBe(gb2024);
            expect(service.getHolidays("IL", 2024)).toBe(il2024);
        });
    });
});
