import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { fetcher } from "../api";

describe("fetcher", () => {
    // Mock the global `fetch` function
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should return JSON data when the response is successful", async () => {
        const mockData = { key: "value" };

        // Mock a successful fetch response
        (global.fetch as any).mockResolvedValueOnce({
            ok: true,
            json: vi.fn().mockResolvedValueOnce(mockData),
        });

        const result = await fetcher("https://api.example.com/data");

        expect(result).toEqual(mockData);
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.example.com/data"
        );
    });

    it("should throw an error when the response is not ok", async () => {
        // Mock a failed fetch response
        (global.fetch as any).mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        await expect(fetcher("https://api.example.com/data")).rejects.toThrow(
            "HTTP error! Status: 404"
        );

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.example.com/data"
        );
    });

    it("should throw an error if fetch itself fails", async () => {
        // Mock a fetch error
        (global.fetch as any).mockRejectedValueOnce(
            new Error("Network error")
        );

        await expect(fetcher("https://api.example.com/data")).rejects.toThrow(
            "Network error"
        );

        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(global.fetch).toHaveBeenCalledWith(
            "https://api.example.com/data"
        );
    });
});
