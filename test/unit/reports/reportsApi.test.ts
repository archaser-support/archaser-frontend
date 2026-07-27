import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFetch = vi.fn();

describe("reportsApi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
    });

    it("GET /api/reports/metadata should return 200 and structure with tables", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                tables: [
                    { name: "Customer", label: "Customer", fields: [] },
                ],
            }),
        });

        const res = await fetch("/api/reports/metadata");
        const data = await res.json();

        expect(res.ok).toBe(true);
        expect(data).toHaveProperty("tables");
        expect(Array.isArray(data.tables)).toBe(true);
    });

    it("GET /api/reports?context=customers should return filtered list", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ reports: [{ id: 1, name: "Customers View" }] }),
        });

        const res = await fetch("/api/reports?context=customers");
        const data = await res.json();

        expect(res.ok).toBe(true);
        expect(data).toHaveProperty("reports");
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("context=customers"));
    });

    it("POST /api/reports/:id/execute with filter in operator and value array should be accepted", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ data: [], totalRecords: 0 }),
        });

        const res = await fetch("/api/reports/1/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                page: 1,
                limit: 20,
                filters: [{ table: "Customer", field: "status", operator: "in", value: ["a", "b"] }],
            }),
        });

        expect(res.ok).toBe(true);
        const call = mockFetch.mock.calls[0];
        expect(call[1].method).toBe("POST");
        const body = JSON.parse(call[1].body);
        expect(body.filters[0].operator).toBe("in");
        expect(body.filters[0].value).toEqual(["a", "b"]);
    });
});
