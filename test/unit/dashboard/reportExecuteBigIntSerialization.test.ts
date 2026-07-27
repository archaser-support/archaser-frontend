import { describe, it, expect } from "vitest";

import { serializeBigInt } from "@/utils/serializeBigInt";

describe("serializeBigInt for report execute rows", () => {
    it("converts Activity BigInt ids so res.json can serialize", () => {
        const result = {
            data: [
                {
                    id: BigInt(1234567890123),
                    customer_id: 10,
                    title: "Call",
                },
            ],
            totalRecords: 1,
        };

        expect(() => JSON.stringify(result)).toThrow(/BigInt/);

        const serialized = serializeBigInt(result);
        expect(() => JSON.stringify(serialized)).not.toThrow();
        expect(serialized.data[0].id).toBe("1234567890123");
        expect(serialized.data[0].customer_id).toBe(10);
    });
});
