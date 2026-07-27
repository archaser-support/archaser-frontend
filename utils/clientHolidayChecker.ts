/**
 * Client-side holiday checker
 * Provides holiday checking functionality without server dependencies
 */

export interface Holiday {
    date: string; // YYYY-MM-DD format
    name: string;
    type: "national" | "religious" | "observance";
}

export interface HolidayCalendar {
    countryCode: string;
    holidays: Holiday[];
}

export class ClientHolidayChecker {
    private static instance: ClientHolidayChecker;
    private holidayCalendars: Map<string, HolidayCalendar> = new Map();

    private constructor() {
        this.initializeHolidayCalendars();
    }

    public static getInstance(): ClientHolidayChecker {
        if (!ClientHolidayChecker.instance) {
            ClientHolidayChecker.instance = new ClientHolidayChecker();
        }
        return ClientHolidayChecker.instance;
    }

    /**
     * Check if a specific date is a holiday in a country
     */
    public isHoliday(
        countryCode: string,
        date: Date
    ): { isHoliday: boolean; holidayName?: string } {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dateStr = `${year}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;

        const calendar = this.holidayCalendars.get(countryCode);
        if (!calendar) return { isHoliday: false };

        const holiday = calendar.holidays.find((h) => h.date === dateStr);
        return {
            isHoliday: !!holiday,
            holidayName: holiday?.name,
        };
    }

    /**
     * Get all holidays for a country and year
     */
    public getHolidays(
        countryCode: string,
        year: number = new Date().getFullYear()
    ): Holiday[] {
        const calendar = this.holidayCalendars.get(countryCode);
        if (!calendar) return [];

        return calendar.holidays.filter((holiday) =>
            holiday.date.startsWith(year.toString())
        );
    }

    /**
     * Get supported countries
     */
    public getSupportedCountries(): string[] {
        return Array.from(this.holidayCalendars.keys());
    }

    /**
     * Initialize holiday calendars for different countries
     */
    private initializeHolidayCalendars(): void {
        // United States
        this.holidayCalendars.set("US", {
            countryCode: "US",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                {
                    date: "2024-01-15",
                    name: "Martin Luther King Jr. Day",
                    type: "national",
                },
                {
                    date: "2024-02-19",
                    name: "Presidents' Day",
                    type: "national",
                },
                { date: "2024-05-27", name: "Memorial Day", type: "national" },
                {
                    date: "2024-07-04",
                    name: "Independence Day",
                    type: "national",
                },
                { date: "2024-09-02", name: "Labor Day", type: "national" },
                { date: "2024-10-14", name: "Columbus Day", type: "national" },
                { date: "2024-11-11", name: "Veterans Day", type: "national" },
                {
                    date: "2024-11-28",
                    name: "Thanksgiving Day",
                    type: "national",
                },
                { date: "2024-12-25", name: "Christmas Day", type: "national" },
                // 2025 holidays
                {
                    date: "2025-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                {
                    date: "2025-01-20",
                    name: "Martin Luther King Jr. Day",
                    type: "national",
                },
                {
                    date: "2025-02-17",
                    name: "Presidents' Day",
                    type: "national",
                },
                { date: "2025-05-26", name: "Memorial Day", type: "national" },
                {
                    date: "2025-07-04",
                    name: "Independence Day",
                    type: "national",
                },
                { date: "2025-09-01", name: "Labor Day", type: "national" },
                { date: "2025-10-13", name: "Columbus Day", type: "national" },
                { date: "2025-11-11", name: "Veterans Day", type: "national" },
                {
                    date: "2025-11-27",
                    name: "Thanksgiving Day",
                    type: "national",
                },
                { date: "2025-12-25", name: "Christmas Day", type: "national" },
            ],
        });

        // United Kingdom
        this.holidayCalendars.set("GB", {
            countryCode: "GB",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2024-01-02", name: "Bank Holiday", type: "national" },
                {
                    date: "2024-05-06",
                    name: "Early May Bank Holiday",
                    type: "national",
                },
                {
                    date: "2024-05-27",
                    name: "Spring Bank Holiday",
                    type: "national",
                },
                {
                    date: "2024-08-26",
                    name: "Summer Bank Holiday",
                    type: "national",
                },
                {
                    date: "2024-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
                { date: "2024-12-26", name: "Boxing Day", type: "national" },
                // 2025 holidays
                {
                    date: "2025-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2025-01-02", name: "Bank Holiday", type: "national" },
                {
                    date: "2025-05-05",
                    name: "Early May Bank Holiday",
                    type: "national",
                },
                {
                    date: "2025-05-26",
                    name: "Spring Bank Holiday",
                    type: "national",
                },
                {
                    date: "2025-08-25",
                    name: "Summer Bank Holiday",
                    type: "national",
                },
                {
                    date: "2025-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
                { date: "2025-12-26", name: "Boxing Day", type: "national" },
            ],
        });

        // Israel
        this.holidayCalendars.set("IL", {
            countryCode: "IL",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                {
                    date: "2024-05-14",
                    name: "Independence Day",
                    type: "national",
                },
                {
                    date: "2024-09-17",
                    name: "Rosh Hashanah",
                    type: "religious",
                },
                { date: "2024-09-26", name: "Yom Kippur", type: "religious" },
                { date: "2024-10-02", name: "Sukkot", type: "religious" },
                { date: "2024-04-23", name: "Passover", type: "religious" },
                // 2025 holidays
                {
                    date: "2025-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                {
                    date: "2025-05-03",
                    name: "Independence Day",
                    type: "national",
                },
                {
                    date: "2025-10-07",
                    name: "Rosh Hashanah",
                    type: "religious",
                },
                { date: "2025-10-16", name: "Yom Kippur", type: "religious" },
                { date: "2025-10-21", name: "Sukkot", type: "religious" },
                { date: "2025-04-13", name: "Passover", type: "religious" },
            ],
        });

        // Germany
        this.holidayCalendars.set("DE", {
            countryCode: "DE",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2024-05-01", name: "Labor Day", type: "national" },
                {
                    date: "2024-10-03",
                    name: "German Unity Day",
                    type: "national",
                },
                {
                    date: "2024-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
                { date: "2024-12-26", name: "Boxing Day", type: "national" },
                // 2025 holidays
                {
                    date: "2025-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2025-05-01", name: "Labor Day", type: "national" },
                {
                    date: "2025-10-03",
                    name: "German Unity Day",
                    type: "national",
                },
                {
                    date: "2025-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
                { date: "2025-12-26", name: "Boxing Day", type: "national" },
            ],
        });

        // France
        this.holidayCalendars.set("FR", {
            countryCode: "FR",
            holidays: [
                {
                    date: "2024-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2024-05-01", name: "Labor Day", type: "national" },
                {
                    date: "2024-05-08",
                    name: "Victory in Europe Day",
                    type: "national",
                },
                { date: "2024-07-14", name: "Bastille Day", type: "national" },
                {
                    date: "2024-08-15",
                    name: "Assumption Day",
                    type: "religious",
                },
                {
                    date: "2024-11-01",
                    name: "All Saints' Day",
                    type: "religious",
                },
                { date: "2024-11-11", name: "Armistice Day", type: "national" },
                {
                    date: "2024-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
                // 2025 holidays
                {
                    date: "2025-01-01",
                    name: "New Year's Day",
                    type: "national",
                },
                { date: "2025-05-01", name: "Labor Day", type: "national" },
                {
                    date: "2025-05-08",
                    name: "Victory in Europe Day",
                    type: "national",
                },
                { date: "2025-07-14", name: "Bastille Day", type: "national" },
                {
                    date: "2025-08-15",
                    name: "Assumption Day",
                    type: "religious",
                },
                {
                    date: "2025-11-01",
                    name: "All Saints' Day",
                    type: "religious",
                },
                { date: "2025-11-11", name: "Armistice Day", type: "national" },
                {
                    date: "2025-12-25",
                    name: "Christmas Day",
                    type: "religious",
                },
            ],
        });
    }

    /**
     * Add custom holidays for a country
     */
    public addCustomHolidays(countryCode: string, holidays: Holiday[]): void {
        const existing = this.holidayCalendars.get(countryCode);
        if (existing) {
            existing.holidays.push(...holidays);
        } else {
            this.holidayCalendars.set(countryCode, {
                countryCode,
                holidays,
            });
        }
    }

    /**
     * Check if a date range contains any holidays
     */
    public getHolidaysInRange(
        countryCode: string,
        startDate: Date,
        endDate: Date
    ): Holiday[] {
        const holidays: Holiday[] = [];
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();

        for (let year = startYear; year <= endYear; year++) {
            const yearHolidays = this.getHolidays(countryCode, year);
            holidays.push(...yearHolidays);
        }

        return holidays.filter((holiday) => {
            const holidayDate = new Date(holiday.date);
            return holidayDate >= startDate && holidayDate <= endDate;
        });
    }
}
