import { getNestedValue } from "../helpers";

describe("getNestedValue", () => {
    it("should return the nested value for a valid path", () => {
        const obj = {
            a: {
                b: {
                    c: "nested value",
                },
            },
        };

        const result = getNestedValue(obj, "a.b.c");
        expect(result).toBe("nested value");
    });

    it("should return undefined for an invalid path", () => {
        const obj = {
            a: {
                b: {
                    c: "nested value",
                },
            },
        };

        const result = getNestedValue(obj, "a.b.d");
        expect(result).toBeUndefined();
    });

    it("should return the root object if the path is empty", () => {
        const obj = {
            a: {
                b: {
                    c: "nested value",
                },
            },
        };

        const result = getNestedValue(obj, "");
        expect(result).toBeUndefined();
    });

    it("should handle non-existent intermediate keys gracefully", () => {
        const obj = {
            a: {
                b: {
                    c: "nested value",
                },
            },
        };

        const result = getNestedValue(obj, "a.x.c");
        expect(result).toBeUndefined();
    });

    it("should return undefined if the object is null or undefined", () => {
        const result = getNestedValue(null, "a.b.c");
        expect(result).toBeUndefined();

        const result2 = getNestedValue(undefined, "a.b.c");
        expect(result2).toBeUndefined();
    });

    it("should handle arrays in the path", () => {
        const obj = {
            a: {
                b: [{ c: "first" }, { c: "second" }],
            },
        };

        const result = getNestedValue(obj, "a.b.1.c");
        expect(result).toBe("second");
    });
});
