/** @vitest-environment node */
import { describe, expect, it } from "vitest";

import {
    isGenerateModalAttentionStatus,
    resolveGenerateModalAutoOpen,
} from "./generateModalAttention";

describe("isGenerateModalAttentionStatus", () => {
    it("treats running, paused, and failed as attention", () => {
        expect(isGenerateModalAttentionStatus("running")).toBe(true);
        expect(isGenerateModalAttentionStatus("paused")).toBe(true);
        expect(isGenerateModalAttentionStatus("failed")).toBe(true);
    });

    it("treats idle and complete as non-attention", () => {
        expect(isGenerateModalAttentionStatus("idle")).toBe(false);
        expect(isGenerateModalAttentionStatus("complete")).toBe(false);
        expect(isGenerateModalAttentionStatus(null)).toBe(false);
        expect(isGenerateModalAttentionStatus(undefined)).toBe(false);
    });
});

describe("resolveGenerateModalAutoOpen", () => {
    it("auto-opens on land when status needs attention", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "running",
                previousStatus: null,
                dismissed: false,
            })
        ).toEqual({ shouldOpen: true, nextDismissed: false });
    });

    it("does not auto-open on land when idle", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "idle",
                previousStatus: null,
                dismissed: false,
            })
        ).toEqual({ shouldOpen: false, nextDismissed: false });
    });

    it("stays closed after dismiss while the same attention status continues", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "running",
                previousStatus: "running",
                dismissed: true,
            })
        ).toEqual({ shouldOpen: false, nextDismissed: true });
    });

    it("re-opens on a new attention transition after dismiss", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "failed",
                previousStatus: "running",
                dismissed: true,
            })
        ).toEqual({ shouldOpen: true, nextDismissed: false });
    });

    it("re-opens when entering attention again after leaving (idle→running)", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "running",
                previousStatus: "idle",
                dismissed: true,
            })
        ).toEqual({ shouldOpen: true, nextDismissed: false });
    });

    it("clears dismiss when leaving attention", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "idle",
                previousStatus: "running",
                dismissed: true,
            })
        ).toEqual({ shouldOpen: false, nextDismissed: false });
    });

    it("does not re-trigger auto-open while the same attention status continues", () => {
        expect(
            resolveGenerateModalAutoOpen({
                status: "running",
                previousStatus: "running",
                dismissed: false,
            })
        ).toEqual({ shouldOpen: false, nextDismissed: false });
    });
});
