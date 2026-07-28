/**
 * Helper classes for ReportExecutionService
 */

import { AGGREGATIONS } from "./ReportExecutionService.constants";
import { AggregationType } from "./ReportExecutionService.types";

/**
 * Calculates aggregation values from arrays of numbers
 */
export class AggregationCalculator {
    static calculate(
        values: number[],
        aggregation: AggregationType
    ): number | null {
        if (values.length === 0) return null;

        const numValues = values.filter((v) => !isNaN(v));
        if (numValues.length === 0) return null;

        switch (aggregation) {
            case AGGREGATIONS.SUM:
                return numValues.reduce((sum, val) => sum + val, 0);
            case AGGREGATIONS.AVG:
                return (
                    numValues.reduce((sum, val) => sum + val, 0) /
                    numValues.length
                );
            case AGGREGATIONS.COUNT:
                return numValues.length;
            case AGGREGATIONS.MIN:
                return Math.min(...numValues);
            case AGGREGATIONS.MAX:
                return Math.max(...numValues);
            default:
                return null;
        }
    }

    static getSQLFunction(aggregation: AggregationType, field: string): string {
        switch (aggregation) {
            case AGGREGATIONS.SUM:
                return `SUM(${field})`;
            case AGGREGATIONS.AVG:
                return `AVG(${field})`;
            case AGGREGATIONS.COUNT:
                return `COUNT(${field})`;
            case AGGREGATIONS.MIN:
                return `MIN(${field})`;
            case AGGREGATIONS.MAX:
                return `MAX(${field})`;
            default:
                return `MIN(${field})`;
        }
    }
}

/**
 * Handles special field mappings (e.g., Customer.name -> Company.name)
 */
export class SpecialFieldHandler {
    private static readonly CUSTOMER_COMPANY_FIELDS = [
        "name",
        "company_number",
    ];

    static isCustomerCompanyField(field: string): boolean {
        return this.CUSTOMER_COMPANY_FIELDS.includes(field);
    }

    static extractCustomerName(row: any, field: string): any {
        // For name field, try Company first, then Person as fallback
        if (field === "name") {
            // Try Company name first
            if (row.Company?.name) {
                return row.Company.name;
            }
            // Fallback to Person name if Company is null (handles data inconsistencies)
            if (row.Person) {
                const firstName = row.Person.first_name || "";
                const lastName = row.Person.last_name || "";
                const fullName = row.Person.full_name;
                const personName =
                    fullName || `${firstName} ${lastName}`.trim();
                if (personName) {
                    return personName;
                }
            }
            // Final fallback: use customer_number if available
            if (row.customer_number) {
                return row.customer_number;
            }
            return null;
        }
        return row.Company?.[field] ?? null;
    }

    static shouldMapToCompany(table: string, field: string): boolean {
        return table === "Customer" && this.isCustomerCompanyField(field);
    }

    static extractCustomerNameFromRelation(
        relationData: any,
        field: string
    ): any {
        if (!relationData) {
            return null;
        }
        // Mirror extractCustomerName: Company first, then Person for name
        if (field === "name") {
            if (relationData.Company?.name) {
                return relationData.Company.name;
            }
            if (relationData.Person) {
                const firstName = relationData.Person.first_name || "";
                const lastName = relationData.Person.last_name || "";
                const fullName = relationData.Person.full_name;
                const personName =
                    fullName || `${firstName} ${lastName}`.trim();
                if (personName) {
                    return personName;
                }
            }
            return relationData.customer_number ?? null;
        }
        return relationData.Company?.[field] ?? null;
    }

    /**
     * Extract parent customer name from ParentCustomer relation
     */
    static extractParentCustomerName(row: any): string | null {
        const parentCustomer = row.ParentCustomer;
        if (!parentCustomer) {
            return null;
        }

        if (parentCustomer.type === "Person") {
            const firstName = parentCustomer.Person?.first_name || "";
            const lastName = parentCustomer.Person?.last_name || "";
            const fullName = parentCustomer.Person?.full_name;
            const name = fullName || `${firstName} ${lastName}`.trim() || "";
            // Only return name if we have one - don't fall back to customer_number
            return name ?? null;
        } else {
            // Only return company name - don't fall back to customer_number
            return parentCustomer.Company?.name ?? null;
        }
    }
}

/**
 * Normalizes and validates filter operators
 */
export class FilterOperatorNormalizer {
    private static readonly operatorMap: Record<string, string> = {
        "=": "equals",
        "!=": "not_equals",
        ">": "greater_than",
        ">=": "greater_than_or_equal",
        "<": "less_than",
        "<=": "less_than_or_equal",
        // Handle alternative operator names from frontend
        "less_or_equal": "less_than_or_equal",
        "greater_or_equal": "greater_than_or_equal",
        "less_or_equals": "less_than_or_equal",
        "greater_or_equals": "greater_than_or_equal",
    };

    static normalize(operator: string): string {
        return this.operatorMap[operator] || operator;
    }

    static isValid(operator: string): boolean {
        const normalized = this.normalize(operator);
        return [
            "equals",
            "not_equals",
            "greater_than",
            "greater_than_or_equal",
            "less_than",
            "less_than_or_equal",
            "contains",
            "in",
            "between",
            "is_empty",
            "is_not_empty",
        ].includes(normalized);
    }
}

/**
 * Filter condition builder for ReportExecutionService
 */
export class FilterConditionBuilder {
    /**
     * Build Prisma condition from filter operator and value
     * @param isDateOnly - true for @db.Date columns; use equals with YYYY-MM-DD to avoid timezone mismatch
     */
    static buildCondition(
        operator: string,
        value: any,
        isDate: boolean,
        isDateOnly = false
    ): any {
        const normalizedOp = FilterOperatorNormalizer.normalize(operator);

        let condition: any;
        switch (normalizedOp) {
            case "equals":
                condition = this.buildEqualsCondition(value, isDate, isDateOnly);
                break;
            case "not_equals":
                // For not_equals, we need special handling with OR conditions
                // This is handled at a higher level in ReportQueryBuilder
                // Return a marker that indicates this needs special handling
                condition = { __needsOrCondition: true, value, isDate };
                break;
            case "greater_than":
                condition = {
                    gt: this.normalizeDateValue(value, isDate, isDateOnly),
                };
                break;
            case "greater_than_or_equal":
                condition = {
                    gte: this.normalizeDateValue(value, isDate, isDateOnly),
                };
                break;
            case "less_than":
                condition = {
                    lt: this.normalizeDateValue(value, isDate, isDateOnly),
                };
                break;
            case "less_than_or_equal":
                condition = {
                    lte: this.normalizeDateValue(value, isDate, isDateOnly),
                };
                break;
            case "contains":
                condition = { contains: value, mode: "insensitive" };
                break;
            case "in":
                condition = { in: Array.isArray(value) ? value : [value] };
                break;
            case "between":
                condition = this.buildBetweenCondition(value, isDate);
                break;
            case "is_empty":
                // Prisma nullable scalars (Float, Int, String, DateTime) use equals: null
                condition = { equals: null };
                break;
            case "is_not_empty":
                // Prisma nullable scalars reject `{ not: { equals: null } }`
                condition = { not: null };
                break;
            default:
                condition = null;
        }

        return condition;
    }

    /** Convert date strings to Date objects for Prisma (expects ISO-8601 DateTime). */
    private static normalizeDateValue(
        value: any,
        isDate: boolean,
        isDateOnly = false
    ): any {
        if (!isDate || value == null) return value;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return new Date(value + "T00:00:00.000Z");
        }
        if (typeof value === "string" && value.includes("T")) {
            return new Date(value);
        }
        return value;
    }

    private static buildEqualsCondition(value: any, isDate: boolean, isDateOnly = false): any {
        if (
            isDate &&
            typeof value === "string" &&
            /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            // For @db.Date columns: use equals with a Date at midnight UTC.
            // Prisma requires ISO-8601 DateTime, not YYYY-MM-DD. Appending T00:00:00.000Z
            // ensures Prisma accepts it; PostgreSQL DATE compares the date part.
            if (isDateOnly) {
                return { equals: new Date(value + "T00:00:00.000Z") };
            }
            // Date-only string for TIMESTAMPTZ - create date range for the day
            const dateStart = new Date(value + "T00:00:00.000Z");
            const dateEnd = new Date(value + "T23:59:59.999Z");
            return { gte: dateStart, lte: dateEnd };
        } else if (isDate && typeof value === "string" && value.includes("T")) {
            // ISO datetime string - convert to Date object
            return { equals: new Date(value) };
        } else {
            return { equals: value };
        }
    }

    private static buildBetweenCondition(value: any, isDate: boolean): any {
        if (Array.isArray(value) && value.length === 2) {
            const startValue =
                isDate &&
                    typeof value[0] === "string" &&
                    /^\d{4}-\d{2}-\d{2}$/.test(value[0])
                    ? new Date(value[0] + "T00:00:00.000Z")
                    : value[0];
            const endValue =
                isDate &&
                    typeof value[1] === "string" &&
                    /^\d{4}-\d{2}-\d{2}$/.test(value[1])
                    ? new Date(value[1] + "T23:59:59.999Z")
                    : value[1];

            // Validate that both values are not empty - required for "between" operator
            if (
                startValue === "" ||
                startValue === null ||
                startValue === undefined ||
                endValue === "" ||
                endValue === null ||
                endValue === undefined
            ) {
                return null; // Skip filter if either value is empty
            }

            return { gte: startValue, lte: endValue };
        }
        return null;
    }
}
