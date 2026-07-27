import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
    useParams: () => ({ locale: "en" }),
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    useSearchParams: () => new URLSearchParams(),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key: string) => key, i18n: { language: "en" } }),
}));
vi.mock("@/hooks/useSessionState", () => ({
    useSessionState: () => ({ session: { user: { account_id: 1 } } }),
}));
vi.mock("axios", () => ({ default: { get: vi.fn().mockResolvedValue({ data: {} }) } }));
vi.mock("@mui/icons-material", () => {
    const M = () => null;
    return { ArrowBack: M, ArrowForward: M, InfoOutlined: M, TrendingUp: M };
});
vi.mock("@/components/InternalPageWrapper", () => ({ default: ({ children }: any) => children }));
vi.mock("@/components/PageHeader", () => ({ default: () => null }));
vi.mock("@/components/reports/DragDropFieldSelector", () => ({ default: () => null }));
vi.mock("@/components/reports/FilterBuilder", () => ({ default: () => null }));
vi.mock("@/components/reports/GroupingBuilder", () => ({ default: () => null }));
vi.mock("@/shared/utils/viewConfigs", () => ({ getViewConfig: () => ({ tableName: "Customer", entityIdField: "id", entityNameField: "name", defaultSort: { field: "name", sort: "asc" } }) }));

// Mock heavy dependency so it is never loaded (avoids hang when running full report suite)
vi.mock("@/utils/reportFieldUtils", () => ({ getRTLTooltipProps: () => ({ arrow: true, enterDelay: 300 }) }));

import ReportBuilderPage from "@/app/[locale]/app/reports/builder/page";

describe("reportBuilderPage", () => {
    beforeEach(() => vi.clearAllMocks());

    it("should export a component", () => {
        expect(ReportBuilderPage).toBeDefined();
        expect(typeof ReportBuilderPage).toBe("function");
    });
});
