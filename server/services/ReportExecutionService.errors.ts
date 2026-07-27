/**
 * Custom error classes for ReportExecutionService
 */

export class ReportExecutionError extends Error {
    constructor(
        message: string,
        public readonly context: {
            reportId: number;
            accountId: number;
            stage: string;
            originalError?: Error;
            [key: string]: any;
        }
    ) {
        super(message);
        this.name = "ReportExecutionError";
        Object.setPrototypeOf(this, ReportExecutionError.prototype);
    }
}

export class ReportNotFoundError extends ReportExecutionError {
    constructor(reportId: number, accountId: number) {
        super(`Report ${reportId} not found`, {
            reportId,
            accountId,
            stage: "report_fetch",
        });
        this.name = "ReportNotFoundError";
    }
}

export class UnauthorizedReportError extends ReportExecutionError {
    constructor(reportId: number, accountId: number) {
        super(`Unauthorized to execute report ${reportId}`, {
            reportId,
            accountId,
            stage: "authorization",
        });
        this.name = "UnauthorizedReportError";
    }
}

export class CreditInsuranceProductDisabledForReportError extends ReportExecutionError {
    constructor(reportId: number, accountId: number) {
        super(
            "Credit insurance is not enabled for this account; this report cannot be run.",
            {
                reportId,
                accountId,
                stage: "credit_insurance_product",
            }
        );
        this.name = "CreditInsuranceProductDisabledForReportError";
    }
}

export class QueryBuildError extends ReportExecutionError {
    constructor(
        message: string,
        reportId: number,
        accountId: number,
        originalError?: Error
    ) {
        super(`Failed to build query: ${message}`, {
            reportId,
            accountId,
            stage: "query_building",
            originalError,
        });
        this.name = "QueryBuildError";
    }
}

export class DatabaseQueryError extends ReportExecutionError {
    constructor(
        message: string,
        reportId: number,
        accountId: number,
        originalError?: Error
    ) {
        super(`Database query failed: ${message}`, {
            reportId,
            accountId,
            stage: "database_query",
            originalError,
        });
        this.name = "DatabaseQueryError";
    }
}
