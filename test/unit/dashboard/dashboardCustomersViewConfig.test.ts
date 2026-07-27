import { describe, it, expect } from "vitest";

import { getViewConfig } from "@/shared/utils/viewConfigs";
import { DASHBOARD_CUSTOMERS_CONTEXT } from "@/shared/dashboard/dashboardCustomerChartFilters";

describe("viewConfigs dashboard_customers", () => {
    it("registers Customer table context with link handlers", () => {
        const config = getViewConfig(DASHBOARD_CUSTOMERS_CONTEXT);
        expect(config).toBeDefined();
        expect(config?.tableName).toBe("Customer");
        expect(config?.entityNameField).toBe("name");
        expect(config?.linkHandlers?.customer).toBeTypeOf("function");
    });
});
