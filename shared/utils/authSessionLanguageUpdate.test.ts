import { describe, expect, it } from "vitest";

/**
 * Mirrors the JWT `trigger === "update"` language/locale/name/timezone
 * handling in lib/authOptions.ts — kept pure for a tight unit check.
 */
function applySessionUpdateToToken(
    token: Record<string, unknown>,
    source: Record<string, unknown>
): Record<string, unknown> {
    const next = { ...token };
    if ("language" in source && typeof source.language === "string" && source.language) {
        next.language = source.language;
    }
    if ("locale" in source) {
        next.locale =
            typeof source.locale === "string" ? source.locale : null;
    }
    if ("name" in source && typeof source.name === "string" && source.name) {
        next.name = source.name;
    }
    if ("timezone" in source) {
        next.timezone =
            typeof source.timezone === "string" ? source.timezone : null;
    }
    return next;
}

describe("authOptions JWT session update (language)", () => {
    it("persists language so RTL reload can read the new session value", () => {
        const token = applySessionUpdateToToken(
            { language: "English", locale: "en-US" },
            { language: "Hebrew", locale: "he-IL" }
        );
        expect(token.language).toBe("Hebrew");
        expect(token.locale).toBe("he-IL");
    });
});
