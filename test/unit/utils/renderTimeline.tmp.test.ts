/**
 * Throwaway: renders the live API response captured in /tmp/timeline-response.json
 * through the real locale catalogs, to confirm nothing reaches the DOM as a raw
 * uuid or an unresolved {{...}} token.
 */
import fs from "node:fs";

import { describe, expect, it } from "vitest";

import {
    resolveI18nPlaceholders,
    translateStoredI18nKey,
} from "@/shared/utils/resolveI18nPlaceholders";

const LOCALE = "he";
const NAMESPACES = [
    "activities",
    "disputes",
    "users",
    "customers",
    "common",
    "portal",
];

const catalog: Record<string, Record<string, unknown>> = {};
for (const ns of NAMESPACES) {
    catalog[ns] = JSON.parse(
        fs.readFileSync(`${process.cwd()}/locales/${LOCALE}/${ns}.json`, "utf8")
    );
}

function lookup(ns: string, key: string): string | undefined {
    let node: unknown = catalog[ns];
    for (const part of key.split(".")) {
        if (!node || typeof node !== "object") return undefined;
        node = (node as Record<string, unknown>)[part];
    }
    return typeof node === "string" ? node : undefined;
}

/** Minimal i18next stand-in: nested lookup plus {{param}} interpolation. */
const t = (key: string, options?: Record<string, unknown>) => {
    const ns = String(options?.ns || "activities");
    const template = lookup(ns, key);
    if (template === undefined) {
        return options?.defaultValue === "___NOT_FOUND___"
            ? "___NOT_FOUND___"
            : key;
    }
    return template.replace(/\{\{(\w+)\}\}/g, (m, p: string) =>
        options?.[p] != null ? String(options[p]) : m
    );
};

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe("live timeline rendering", () => {
    const body = JSON.parse(
        fs.readFileSync("/tmp/timeline-response.json", "utf8")
    );

    it("renders every row without raw ids or leftover tokens", () => {
        for (const activity of body.activities) {
            const params = activity.title_params || undefined;
            const title = activity.title
                ? translateStoredI18nKey(String(activity.title), t, params)
                : "";
            const content = activity.description ?? activity.content ?? "";
            const rendered = resolveI18nPlaceholders(String(content), t, params);

            const values = [
                ...rendered.matchAll(/activity-value">([^<]*)<\/span>/g),
            ].map((m) => m[1].trim());
            const labels = [
                ...rendered.matchAll(/activity-label-primary">([^<]*)<\/span>/g),
            ].map((m) => m[1].trim());

            console.log(`\n#${activity.id} [${activity.type}] ${title}`);
            labels.forEach((label, i) =>
                console.log(`    ${label} ${values[i] ?? ""}`)
            );

            expect(title, `title of #${activity.id}`).not.toMatch(/\{\{|\}\}/);
            expect(title, `title of #${activity.id}`).not.toMatch(UUID_RE);
            for (const value of [...values, ...labels]) {
                expect(value, `field of #${activity.id}`).not.toMatch(
                    /\{\{|\}\}/
                );
                expect(value, `field of #${activity.id}`).not.toMatch(UUID_RE);
            }
        }
    });
});
