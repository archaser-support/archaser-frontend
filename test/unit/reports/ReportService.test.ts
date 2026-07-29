import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ReportService, ReportConfig, CreateReportData } from '@/server/services/ReportService';
import { LogService } from '@/server/services/LogService';
import { LogLevel } from '@/types/enums';

// Mock dependencies
const logMessageMock = vi.fn();
const logServiceInstance = { logMessage: logMessageMock };

vi.mock('@/server/services/LogService', () => ({
    LogService: {
        getInstance: vi.fn(() => logServiceInstance),
    },
}));

vi.mock('@/lib/prisma', () => ({
    prisma: {
        report: {
            create: vi.fn(),
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            upsert: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
            deleteMany: vi.fn(),
            count: vi.fn(),
        },
        account: {
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        $transaction: vi.fn(async (fn: any) => {
            // Provide the same mocked prisma object as the transaction client
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const { prisma } = await import('@/lib/prisma');
            return await fn(prisma);
        }),
        reportShare: {
            findFirst: vi.fn(),
        },
        userDefaultReport: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
        user: {
            findMany: vi.fn(),
        },
    },
}));

describe('ReportService', () => {
    let reportService: ReportService;
    let prisma: any;
    let logServiceMock: any;

    const mockReportConfig: ReportConfig = {
        tables: ['Customer', 'Invoice'],
        joins: [
            {
                type: 'LEFT',
                from: 'Customer',
                to: 'Invoice',
                on: 'Customer.id = Invoice.customer_id',
            },
        ],
        fields: [
            { table: 'Customer', field: 'name' },
            { table: 'Invoice', field: 'amount' },
        ],
        filters: [],
        sorting: [{ field: 'Customer.name', direction: 'ASC' }],
    };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mocks
        const prismaModule = await import('../../../lib/prisma');
        prisma = prismaModule.prisma;
        prisma.user.findMany.mockResolvedValue([]);

        // Reset ReportService singleton to ensure it picks up any changes/fresh state
        (ReportService as any).instance = null;
        reportService = ReportService.getInstance();

        // Get the log service mock (which we know is consistent now)
        const logServiceModule = await import('../../../server/services/LogService');
        logServiceMock = logServiceModule.LogService.getInstance();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('validateReportConfig', () => {
        // Access private method via any cast
        const validateConfig = (config: ReportConfig) => (reportService as any).validateReportConfig(config);

        it('should pass for valid config', () => {
            expect(() => validateConfig(mockReportConfig)).not.toThrow();
        });

        it('should throw if no tables defined', () => {
            const invalidConfig = { ...mockReportConfig, tables: [] };
            expect(() => validateConfig(invalidConfig)).toThrow("Report must have at least one table");
        });

        it('should throw if no fields selected', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Report must have at least one selected field"
            );
        });

        it('should throw if a selected column has an empty field name', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: 'Customer', field: 'name' },
                    { table: 'Invoice', field: '   ' },
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Each selected column must have a non-empty table and field"
            );
        });

        it('should throw if a filter has no field selected', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                filters: [
                    {
                        table: 'Customer',
                        field: '',
                        operator: '=',
                        value: 'x',
                    },
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Each filter must have a table and field selected"
            );
        });

        it('should throw if join references unknown table', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                joins: [{
                    type: 'LEFT',
                    from: 'Customer',
                    to: 'UnknownTable', // Invalid
                    on: '...',
                }],
            };
            expect(() => validateConfig(invalidConfig)).toThrow("Join references unknown table: UnknownTable");
        });

        it('should throw if field references unknown table', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{
                    table: 'UnknownTable', // Invalid
                    field: 'name',
                }],
            };
            expect(() => validateConfig(invalidConfig)).toThrow("Field references unknown table: UnknownTable");
        });

        it('should throw if filter references unknown table', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                filters: [{
                    table: 'UnknownTable', // Invalid
                    field: 'name',
                    operator: '=',
                    value: 'Test',
                }],
            };
            expect(() => validateConfig(invalidConfig)).toThrow("Filter references unknown table: UnknownTable");
        });

        it('should throw if between filter has invalid values', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                filters: [{
                    table: 'Customer',
                    field: 'created_at',
                    operator: 'between',
                    value: ['2023-01-01'], // Missing second value
                }],
            };
            expect(() => validateConfig(invalidConfig)).toThrow('Filter with "between" operator requires both start and end values');
        });

        it('should accept filter with operator "in" and value as array', () => {
            const configWithIn: ReportConfig = {
                ...mockReportConfig,
                filters: [{
                    table: 'Customer',
                    field: 'status',
                    operator: 'in',
                    value: ['active', 'pending'],
                }],
            };
            expect(() => validateConfig(configWithIn)).not.toThrow();
        });

        it('should throw if filter with operator "in" has no values', () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                filters: [{
                    table: 'Customer',
                    field: 'Country.name',
                    operator: 'in',
                    value: [],
                }],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                'Each filter must have a value'
            );
        });

        it("should throw if grouping references a field that is not selected", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                grouping: ["Customer.status"],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Grouping references unknown selected field: Customer.status"
            );
        });

        it("should throw when aggregated config includes non-aggregated fields not present in grouping", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    { table: "Invoice", field: "amount", aggregation: "SUM" },
                ],
                grouping: [],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "When aggregation is used, every non-aggregated selected field must be included in grouping"
            );
        });

        it("should accept aggregation when all non-aggregated fields are included in grouping", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    { table: "Invoice", field: "amount", aggregation: "SUM" },
                ],
                grouping: ["Customer.name"],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should accept grouped config when grouping uses field alias", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name", alias: "customerName" },
                    { table: "Invoice", field: "amount", aggregation: "SUM" },
                ],
                grouping: ["customerName"],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should accept two different aggregations on the same field when grouping is valid", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "SUM",
                    },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "AVG",
                    },
                ],
                grouping: ["Customer.name"],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should accept valid formula config for ungrouped reports", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas: [
                    {
                        id: "f1",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                        format: "number",
                    } as any,
                ],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should accept formula references to fields not shown as report columns", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{ table: "Invoice", field: "amount" }],
                formulas: [
                    {
                        id: "f1",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                        format: "number",
                    } as any,
                ],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should reject formula references outside report tables", () => {
            const invalidConfig: ReportConfig = {
                tables: ["Invoice"],
                joins: [],
                fields: [{ table: "Invoice", field: "amount" }],
                filters: [],
                formulas: [
                    {
                        id: "f1",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                        format: "number",
                    } as any,
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Formula references unavailable field"
            );
        });

        it("should reject constants-only formulas with no field references", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{ table: "Invoice", field: "amount" }],
                formulas: [
                    {
                        id: "f1",
                        label: "Constant",
                        expression: "100/2",
                        format: "number",
                    } as any,
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                /must (eventually )?reference at least one report field/
            );
        });

        it("should reject grouped formulas without aggregation", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Invoice", field: "amount", aggregation: "SUM" },
                    { table: "Customer", field: "name" },
                    { table: "Customer", field: "cost_percent" },
                ],
                grouping: ["Customer.name", "Customer.cost_percent"],
                formulas: [
                    {
                        id: "f1",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]/100",
                        format: "number",
                    } as any,
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "requires an aggregation for grouped reports"
            );
        });

        it("should accept formula→formula references via [formula:<id>]", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas: [
                    {
                        id: "premium",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]",
                        format: "number",
                    },
                    {
                        id: "total",
                        label: "Total",
                        expression: "[formula:premium]+1",
                        format: "number",
                    },
                ],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should reject display-label formula references in persisted expressions", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas: [
                    {
                        id: "premium",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]",
                        format: "number",
                    },
                    {
                        id: "total",
                        label: "Total",
                        expression: "[Premium]+1",
                        format: "number",
                    },
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                'Formula references must use [formula:<id>] (not label "Premium")'
            );
        });

        it("should reject formula labels that match an allowed field name", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{ table: "Invoice", field: "amount" }],
                formulas: [
                    {
                        id: "spoof",
                        label: "Invoice.amount",
                        expression: "[Invoice.amount]*2",
                        format: "number",
                    },
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Formula label cannot match an allowed field name: Invoice.amount"
            );
        });

        it("should reject formula cycles and self-references", () => {
            const cycleConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{ table: "Invoice", field: "amount" }],
                formulas: [
                    {
                        id: "a",
                        label: "A",
                        expression: "[formula:b]",
                        format: "number",
                    },
                    {
                        id: "b",
                        label: "B",
                        expression: "[formula:a]",
                        format: "number",
                    },
                ],
            };
            expect(() => validateConfig(cycleConfig)).toThrow(
                /dependency cycle|cannot reference itself/
            );

            const selfRefConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [{ table: "Invoice", field: "amount" }],
                formulas: [
                    {
                        id: "a",
                        label: "A",
                        expression: "[formula:a]+[Invoice.amount]",
                        format: "number",
                    },
                ],
            };
            expect(() => validateConfig(selfRefConfig)).toThrow(
                "cannot reference itself"
            );
        });

        it("should reject compose-only Currency formulas with disagreeing currency sources", () => {
            const invalidConfig: ReportConfig = {
                tables: ["Invoice", "Payment"],
                joins: [],
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Payment", field: "amount" },
                ],
                filters: [],
                formulas: [
                    {
                        id: "inv",
                        label: "Invoice Amt",
                        expression: "[Invoice.amount]",
                        format: "currency",
                    },
                    {
                        id: "pay",
                        label: "Payment Amt",
                        expression: "[Payment.amount]",
                        format: "currency",
                    },
                    {
                        id: "total",
                        label: "Total",
                        expression: "[formula:inv]+[formula:pay]",
                        format: "currency",
                    },
                ],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Currency formulas require an amount field"
            );
        });

        it("should accept compose-only Currency formulas that inherit a shared source", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Invoice", field: "amount" },
                    { table: "Customer", field: "cost_percent" },
                ],
                formulas: [
                    {
                        id: "premium",
                        label: "Premium",
                        expression: "[Invoice.amount]*[Customer.cost_percent]",
                        format: "currency",
                    },
                    {
                        id: "fee",
                        label: "Fee",
                        expression: "[Invoice.amount]*0.01",
                        format: "currency",
                    },
                    {
                        id: "total",
                        label: "Total",
                        expression: "[formula:premium]+[formula:fee]",
                        format: "currency",
                    },
                ],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should accept two identical aggregations on the same field when output keys differ", () => {
            const validConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "SUM",
                    },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "SUM",
                        alias: "Invoice_amount__SUM_2",
                    },
                ],
                grouping: ["Customer.name"],
            };
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("should throw when grouping lists an aggregated column output key (any aggregation)", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "MIN",
                    },
                ],
                grouping: ["Customer.name", "Invoice.amount__MIN"],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Grouping cannot use aggregated field output as dimension: Invoice.amount__MIN"
            );
        });

        it("should throw when two fields produce the same output key", () => {
            const invalidConfig: ReportConfig = {
                ...mockReportConfig,
                fields: [
                    { table: "Customer", field: "name" },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "SUM",
                    },
                    {
                        table: "Invoice",
                        field: "amount",
                        aggregation: "SUM",
                    },
                ],
                grouping: ["Customer.name"],
            };
            expect(() => validateConfig(invalidConfig)).toThrow(
                "Duplicate report field output keys"
            );
        });
    });

    describe('generateDescription', () => {
        // Access private method via any cast
        const generateDescription = (config: ReportConfig) => (reportService as any).generateDescription(config);

        it('should generate simple description for no filters', async () => {
            const config: ReportConfig = {
                tables: ['Customer'],
            };
            const desc = await generateDescription(config);
            expect(desc).toBe('All customers.');
        });

        it('should generate description with filters', async () => {
            const config: ReportConfig = {
                tables: ['Invoice'],
                filters: [
                    {
                        table: 'Invoice',
                        field: 'amount',
                        operator: '>',
                        value: 1000,
                    }
                ],
            };
            const desc = await generateDescription(config);
            // Assuming getFieldLabel returns "amount" and getOperatorLabel returns "greater than"
            expect(desc).toContain('amount greater than 1000');
        });
    });

    describe('createReport', () => {
        const createData: CreateReportData = {
            account_id: 1,
            name: 'Test Report',
            report_config: mockReportConfig,
            created_by: 'user-1',
        };

        it('should create a report successfully', async () => {
            const mockReport = {
                id: 1,
                name: 'Test Report',
                unique_name: 'test_report',
                ...createData,
            };

            prisma.report.findFirst.mockResolvedValue(null); // No existing report with same name
            prisma.report.create.mockResolvedValue(mockReport);

            const result = await reportService.createReport(createData);

            expect(result).toEqual(mockReport);
            expect(prisma.report.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    name: 'Test Report',
                    unique_name: 'test_report',
                    account_id: 1,
                }),
            });
            expect(logServiceMock.logMessage).toHaveBeenCalledWith(
                LogLevel.INFO,
                expect.stringContaining('Report created'),
                'ReportService',
                undefined,
                1,
                'user-1'
            );
        });

        it('should generate unique name with suffix if exists', async () => {
            const mockReport = {
                id: 2,
                name: 'Test Report',
                unique_name: 'test_report_1',
            };

            // First check returns existing, second returns null
            prisma.report.findFirst
                .mockResolvedValueOnce({ id: 1 }) // test_report exists
                .mockResolvedValueOnce(null);     // test_report_1 does not exist

            prisma.report.create.mockResolvedValue(mockReport);

            await reportService.createReport(createData);

            expect(prisma.report.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    unique_name: 'test_report_1',
                }),
            });
        });

        it('should unset other defaults if is_system and is_default is true', async () => {
            const systemDefaultData = { ...createData, is_system: true, is_default: true, context: 'INVOICE_LIST' };

            prisma.report.create.mockResolvedValue({ id: 1, ...systemDefaultData });
            prisma.report.findFirst.mockResolvedValue(null);

            await reportService.createReport(systemDefaultData);

            expect(prisma.report.updateMany).toHaveBeenCalledWith({
                where: {
                    context: 'INVOICE_LIST',
                    is_default: true,
                    account_id: 1,
                    id: { not: -1 },
                },
                data: {
                    is_default: false,
                },
            });
        });

        it('should set default sorting from first field when report_config.sorting is missing', async () => {
            const dataWithoutSorting: CreateReportData = {
                ...createData,
                report_config: {
                    ...mockReportConfig,
                    sorting: undefined as any,
                },
            };
            prisma.report.findFirst.mockResolvedValue(null);
            prisma.report.create.mockImplementation((args: { data: any }) => {
                expect(args.data.report_config.sorting).toEqual([
                    { field: 'Customer.name', direction: 'ASC' },
                ]);
                return Promise.resolve({ id: 1, ...args.data });
            });

            await reportService.createReport(dataWithoutSorting);
        });

        it('should set default sorting from first field when report_config.sorting is empty array', async () => {
            const dataWithEmptySorting: CreateReportData = {
                ...createData,
                report_config: {
                    ...mockReportConfig,
                    sorting: [],
                },
            };
            prisma.report.findFirst.mockResolvedValue(null);
            prisma.report.create.mockImplementation((args: { data: any }) => {
                expect(args.data.report_config.sorting).toEqual([
                    { field: 'Customer.name', direction: 'ASC' },
                ]);
                return Promise.resolve({ id: 1, ...args.data });
            });

            await reportService.createReport(dataWithEmptySorting);
        });

        it('should throw friendly error when duplicate unique name (P2002)', async () => {
            prisma.report.findFirst.mockResolvedValue(null);
            const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                code: 'P2002',
                clientVersion: '1.0',
                meta: { target: ['account_id', 'unique_name'] },
            });
            prisma.report.create.mockRejectedValue(p2002Error);

            await expect(reportService.createReport(createData)).rejects.toThrow(
                'A report with the name "Test Report" already exists. Please choose a different name.'
            );
        });
    });

    describe('getReport', () => {
        it('should return report if user owns account', async () => {
            const report = { id: 1, account_id: 1, is_public: false };
            prisma.report.findUnique.mockResolvedValue(report);

            const result = await reportService.getReport(1, 1, 'user-1');
            expect(result).toEqual(report);
        });

        it('should return report if system report', async () => {
            const report = { id: 1, account_id: 999, is_system: true }; // Different account
            prisma.report.findUnique.mockResolvedValue(report);

            const result = await reportService.getReport(1, 1, 'user-1');
            expect(result).toEqual(report);
        });

        it('should return null if different account and not public/shared', async () => {
            const report = { id: 1, account_id: 2, is_public: false, is_system: false };
            prisma.report.findUnique.mockResolvedValue(report);
            prisma.reportShare.findFirst.mockResolvedValue(null);

            const result = await reportService.getReport(1, 1, 'user-1');
            expect(result).toBeNull();
        });

        it('should return report if shared with user', async () => {
            const report = { id: 1, account_id: 2, is_public: false, is_system: false };
            prisma.report.findUnique.mockResolvedValue(report);
            prisma.reportShare.findFirst.mockResolvedValue({ id: 1 }); // Shared

            const result = await reportService.getReport(1, 1, 'user-1');
            expect(result).toEqual(report);
        });
    });

    describe('getDefaultView', () => {
        it('should return user default if exists', async () => {
            const userDefaultReport = { id: 10, name: 'User Default' };
            prisma.userDefaultReport.findUnique.mockResolvedValue({
                Report: userDefaultReport,
            });

            const result = await reportService.getDefaultView(1, 'ctx', 'user-1');
            expect(result).toEqual(userDefaultReport);
        });

        it('should return system default if no user default', async () => {
            prisma.userDefaultReport.findUnique.mockResolvedValue(null);

            const systemDefault = { id: 20, is_system: true };
            prisma.report.findFirst.mockResolvedValue(systemDefault);

            const result = await reportService.getDefaultView(1, 'ctx', 'user-1');
            expect(result).toEqual(systemDefault);

            // Should verify that the first findFirst call was for system default
            expect(prisma.report.findFirst).toHaveBeenCalledWith(expect.objectContaining({
                where: expect.objectContaining({ is_system: true })
            }));
        });

        it('should return account default if no user or system default', async () => {
            prisma.userDefaultReport.findUnique.mockResolvedValue(null);

            // First call (system default) returns null
            // Second call (account default) returns report
            const accountDefault = { id: 30, account_id: 1 };
            prisma.report.findFirst
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(accountDefault);

            const result = await reportService.getDefaultView(1, 'ctx', 'user-1');
            expect(result).toEqual(accountDefault);
        });
    });

    describe('updateReport', () => {
        it('should throw when report not found', async () => {
            prisma.report.findUnique.mockResolvedValue(null);

            await expect(
                reportService.updateReport(999, { name: 'Updated', report_config: mockReportConfig }, 1)
            ).rejects.toThrow('Report with ID 999 not found');
        });

        it('should throw when account does not match (access denied)', async () => {
            prisma.report.findUnique.mockResolvedValue({ id: 1, account_id: 2, is_system: false });

            await expect(
                reportService.updateReport(1, { name: 'Updated', report_config: mockReportConfig }, 1)
            ).rejects.toThrow(/Unauthorized to update report/);
        });

        it('should set default sorting from first field when report_config.sorting is empty', async () => {
            const existing = { id: 1, account_id: 1, is_system: false };
            prisma.report.findUnique.mockResolvedValue(existing);
            prisma.report.update.mockImplementation((args: { where: any; data: any }) => {
                expect(args.data.report_config.sorting).toEqual([
                    { field: 'Customer.name', direction: 'ASC' },
                ]);
                return Promise.resolve({ ...existing, ...args.data });
            });

            await reportService.updateReport(1, {
                report_config: { ...mockReportConfig, sorting: [] },
            }, 1);
        });

        it('should persist report_config.grouping on update', async () => {
            const existing = { id: 1, account_id: 1, is_system: false };
            prisma.report.findUnique.mockResolvedValue(existing);
            const grouping = ['Customer.name'];
            prisma.report.update.mockImplementation((args: { where: any; data: any }) => {
                expect(args.data.report_config.grouping).toEqual(grouping);
                return Promise.resolve({ ...existing, ...args.data });
            });

            await reportService.updateReport(
                1,
                {
                    report_config: { ...mockReportConfig, grouping },
                },
                1
            );
        });

        it('should throw friendly error when duplicate unique name on update (P2002)', async () => {
            prisma.report.findUnique.mockResolvedValue({ id: 1, account_id: 1, is_system: false });
            prisma.report.update.mockRejectedValue(
                new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
                    code: 'P2002',
                    clientVersion: '1.0',
                    meta: { target: ['account_id', 'unique_name'] },
                })
            );

            await expect(
                reportService.updateReport(1, { name: 'Duplicate Name', report_config: mockReportConfig }, 1)
            ).rejects.toThrow(/already exists.*Please choose a different name/);
        });
    });

    describe('syncSystemReportsToAllAccounts', () => {
        it('should throw if any selected report is not a system report', async () => {
            prisma.report.findMany.mockResolvedValueOnce([
                { id: 1, account_id: 10013, unique_name: 'r1', is_system: false },
            ]);

            await expect(
                reportService.syncSystemReportsToAllAccounts([1], 'admin-user')
            ).rejects.toThrow('Only system reports can be synced');
        });

        it('should upsert by (account_id, unique_name) into all non-deleted accounts and return counts', async () => {
            // master selected reports
            prisma.report.findMany
                .mockResolvedValueOnce([
                    {
                        id: 1,
                        account_id: 10013,
                        unique_name: 'customers_open',
                        name: 'Customers Open',
                        description: 'desc',
                        report_config: { tables: ['Customer'] },
                        is_public: false,
                        is_system: true,
                        is_default: false,
                        context: 'customers',
                        created_by: 'x',
                        modified_by: 'y',
                    },
                    {
                        id: 2,
                        account_id: 10013,
                        unique_name: 'customers_closed',
                        name: 'Customers Closed',
                        description: null,
                        report_config: { tables: ['Customer'] },
                        is_public: true,
                        is_system: true,
                        is_default: true,
                        context: 'customers',
                        created_by: null,
                        modified_by: null,
                    },
                ])
                // existing copies query
                .mockResolvedValueOnce([
                    { account_id: 20001, unique_name: 'customers_open' },
                ]);

            prisma.account.findMany.mockResolvedValueOnce([
                { id: 20001 },
                { id: 20002 },
            ]);

            prisma.report.upsert.mockResolvedValue({ id: 999 });

            const result = await reportService.syncSystemReportsToAllAccounts(
                [1, 2],
                'admin-user'
            );

            // 2 reports * 2 accounts = 4 upserts
            expect(prisma.report.upsert).toHaveBeenCalledTimes(4);

            // counts: one existing, three new
            expect(result).toEqual({
                syncedReports: 2,
                targetAccounts: 2,
                created: 3,
                updated: 1,
            });

            // spot-check one upsert call shape
            expect(prisma.report.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        account_id_unique_name: {
                            account_id: 20001,
                            unique_name: 'customers_open',
                        },
                    },
                    update: expect.objectContaining({
                        is_system: true,
                        context: 'customers',
                    }),
                    create: expect.objectContaining({
                        account_id: 20001,
                        unique_name: 'customers_open',
                        is_system: true,
                    }),
                })
            );
        });

        it('should only sync credit-insurance system reports to credit-enabled accounts', async () => {
            prisma.report.findMany
                .mockResolvedValueOnce([
                    {
                        id: 1,
                        account_id: 10013,
                        unique_name: 'monthly_report',
                        name: 'Monthly Report',
                        description: 'desc',
                        report_config: {
                            tables: ['Customer', 'Invoice'],
                            fields: [
                                {
                                    table: 'Customer',
                                    field: 'InsurancePolicy.policy_number',
                                },
                            ],
                        },
                        is_public: false,
                        is_system: true,
                        is_default: false,
                        context: 'reports',
                        created_by: 'x',
                        modified_by: 'y',
                    },
                ])
                .mockResolvedValueOnce([]);

            prisma.account.findMany.mockResolvedValueOnce([
                { id: 20001, has_credit_insurance: false },
                { id: 20002, has_credit_insurance: true },
            ]);

            prisma.report.upsert.mockResolvedValue({ id: 999 });

            const result = await reportService.syncSystemReportsToAllAccounts(
                [1],
                'admin-user'
            );

            expect(prisma.report.upsert).toHaveBeenCalledTimes(1);
            expect(prisma.report.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        account_id_unique_name: {
                            account_id: 20002,
                            unique_name: 'monthly_report',
                        },
                    },
                })
            );
            expect(result).toEqual({
                syncedReports: 1,
                targetAccounts: 1,
                created: 1,
                updated: 0,
            });
        });
    });

    describe('copySystemReportsToNewAccount', () => {
        it('should skip credit-insurance reports for accounts without that product', async () => {
            prisma.account.findUnique.mockResolvedValueOnce({
                has_credit_insurance: false,
            });
            prisma.report.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    account_id: 10013,
                    unique_name: 'monthly_report',
                    name: 'Monthly Report',
                    description: 'desc',
                    report_config: {
                        tables: ['Customer', 'Invoice'],
                        fields: [
                            {
                                table: 'Customer',
                                field: 'InsurancePolicy.policy_number',
                            },
                        ],
                    },
                    is_public: false,
                    is_system: true,
                    is_default: false,
                    context: 'reports',
                    created_by: 'x',
                    modified_by: 'y',
                },
                {
                    id: 2,
                    account_id: 10013,
                    unique_name: 'customers_open',
                    name: 'Customers Open',
                    description: 'desc',
                    report_config: {
                        tables: ['Customer'],
                        fields: [{ table: 'Customer', field: 'name' }],
                    },
                    is_public: false,
                    is_system: true,
                    is_default: false,
                    context: 'customers',
                    created_by: 'x',
                    modified_by: 'y',
                },
            ]);
            prisma.report.findFirst.mockResolvedValue(null);
            prisma.report.upsert.mockResolvedValue({ id: 2 });

            await reportService.copySystemReportsToNewAccount(
                20001,
                'admin-user',
                prisma,
                true
            );

            expect(prisma.report.upsert).toHaveBeenCalledTimes(1);
            expect(prisma.report.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: {
                        account_id_unique_name: {
                            account_id: 20001,
                            unique_name: 'customers_open',
                        },
                    },
                    create: expect.objectContaining({
                        account_id: 20001,
                        unique_name: 'customers_open',
                        context: 'customers',
                    }),
                })
            );
        });
    });

    describe('syncSystemReportsToAccount', () => {
        it('should return without syncing credit-insurance reports for non-credit accounts', async () => {
            prisma.account.findUnique.mockResolvedValueOnce({
                has_credit_insurance: false,
            });
            prisma.report.findMany.mockResolvedValueOnce([
                {
                    id: 1,
                    account_id: 10013,
                    unique_name: 'monthly_report',
                    name: 'Monthly Report',
                    description: 'desc',
                    report_config: {
                        tables: ['Customer', 'Invoice'],
                        fields: [
                            {
                                table: 'Customer',
                                field: 'InsurancePolicy.policy_number',
                            },
                        ],
                    },
                    is_public: false,
                    is_system: true,
                    is_default: false,
                    context: 'reports',
                    created_by: 'x',
                    modified_by: 'y',
                },
            ]);

            const result = await reportService.syncSystemReportsToAccount(
                20001,
                undefined,
                'admin-user'
            );

            expect(prisma.report.upsert).not.toHaveBeenCalled();
            expect(result).toEqual({
                created: 0,
                updated: 0,
                syncedReports: 0,
            });
        });
    });
});
