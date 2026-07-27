import { vi } from 'vitest';

// Mock Functions
export const mockFunctions = {
    logCallback: (message: string, level: 'INFO' | 'ERROR' | 'WARNING' | 'DEBUG', parameters?: any, results?: any) => {
        // Debug log removed - use test assertions instead
    },
    translate: (key: string) => key,
    mockPrismaResponse: (data: any) => ({ count: Array.isArray(data) ? data.length : 1 }),
    mockScheduleDateTime: (options: any) => ({
        scheduledTime: new Date("2024-01-16T17:00:00.000Z"),
        calculation: "Mock calculation result",
    }),
    mockBusinessHoursService: {
        isBusinessHours: vi.fn().mockReturnValue(true),
        getNextBusinessDay: vi.fn().mockReturnValue(new Date("2024-01-16T09:00:00.000Z")),
        isHoliday: vi.fn().mockReturnValue(false),
        isVacation: vi.fn().mockReturnValue(false),
    },
    mockActivityService: {
        createAutomatedActivity: vi.fn(),
        updateActivity: vi.fn(),
        getActivityById: vi.fn(),
        getActivitiesByCustomer: vi.fn(),
    },
    mockCustomerService: {
        calculateNextAutomatedActivityTime: vi.fn(),
        getCustomerById: vi.fn(),
        updateCustomer: vi.fn(),
    },
    mockCronManager: {
        executeJob: vi.fn(),
        getJobStatus: vi.fn(),
        scheduleJob: vi.fn(),
    },
};

// Mock Prisma Responses
export const mockPrismaResponses = {
    activity: {
        create: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        delete: vi.fn(),
    },
    collectionPeriod: {
        findMany: vi.fn(),
        update: vi.fn(),
        findUnique: vi.fn(),
    },
    customer: {
        findUnique: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
    },
    contact: {
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
    },
    activityTemplate: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
    },
    activitySequence: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
    },
};

// Mock External Services
export const mockExternalServices = {
    emailService: {
        send: vi.fn().mockResolvedValue({ success: true, messageId: "mock-email-id" }),
        validate: vi.fn().mockReturnValue(true),
    },
    smsService: {
        send: vi.fn().mockResolvedValue({ success: true, messageId: "mock-sms-id" }),
        validate: vi.fn().mockReturnValue(true),
    },
    whatsappService: {
        send: vi.fn().mockResolvedValue({ success: true, messageId: "mock-whatsapp-id" }),
        validate: vi.fn().mockReturnValue(true),
    },
    timezoneService: {
        getTimezone: vi.fn().mockReturnValue("America/Los_Angeles"),
        convertToUTC: vi.fn().mockImplementation((date: Date) => date),
        convertFromUTC: vi.fn().mockImplementation((date: Date) => date),
    },
};

// Mock Configuration
export const mockConfig = {
    database: {
        url: "mock://database-url",
        maxConnections: 10,
    },
    scheduling: {
        defaultTimezone: "UTC",
        businessHoursStart: "09:00",
        businessHoursEnd: "18:00",
        maxRetries: 3,
    },
    logging: {
        level: "INFO",
        enableConsole: true,
        enableFile: false,
    },
};
