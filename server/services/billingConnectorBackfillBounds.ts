import type { ConnectorSyncMode, ImportType } from "@prisma/client";
import moment from "moment-timezone";

import {
    buildInvoicesOnOrAfterDateFilter,
    buildPaymentsOnOrAfterDateFilter,
    buildUnpaidOpenInvoicesBeforeDateFilter,
} from "@/server/integrations/priority/priorityDatedBackfillFilters";

/** PRD default when Account.time_zone is unset. */
export const DEFAULT_ACCOUNT_TIMEZONE = "Asia/Jerusalem";

const CALENDAR_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Inclusive lower bound for a calendar day in the account timezone,
 * as a UTC ISO string suitable for Priority OData date comparisons.
 */
export function calendarDateStartOfDayUtcIso(
    calendarDate: string,
    timeZone: string = DEFAULT_ACCOUNT_TIMEZONE
): string {
    const m = moment.tz(calendarDate, "YYYY-MM-DD", true, timeZone);
    if (!m.isValid()) {
        throw Object.assign(new Error(`Invalid calendar date: ${calendarDate}`), {
            statusCode: 400,
            code: "INVALID_BACKFILL_START_DATE",
        });
    }
    return m.startOf("day").toISOString();
}

/**
 * Normalize PUT input: undefined = omit, null/"" = clear, YYYY-MM-DD = set.
 * Stored as UTC midnight for the calendar day (@db.Date).
 */
export function normalizeBackfillStartDateInput(
    input: string | null | undefined
): Date | null | undefined {
    if (input === undefined) {
        return undefined;
    }
    if (input === null || input.trim() === "") {
        return null;
    }

    const trimmed = input.trim();
    const match = CALENDAR_DATE_RE.exec(trimmed);
    if (!match) {
        throw Object.assign(new Error("backfill_start_date must be YYYY-MM-DD"), {
            statusCode: 400,
            code: "INVALID_BACKFILL_START_DATE",
        });
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
        utc.getUTCFullYear() !== year ||
        utc.getUTCMonth() !== month - 1 ||
        utc.getUTCDate() !== day
    ) {
        throw Object.assign(new Error(`Invalid calendar date: ${trimmed}`), {
            statusCode: 400,
            code: "INVALID_BACKFILL_START_DATE",
        });
    }
    return utc;
}

export function formatBackfillStartDateForApi(
    value: Date | null | undefined
): string | null {
    if (!value) {
        return null;
    }
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function areBackfillOptionsLocked(
    backfillStartedAt: Date | null | undefined
): boolean {
    return backfillStartedAt != null;
}

export type BackfillStartDateChangeResult =
    | { ok: true; value: Date | null | undefined }
    | { ok: false; code: "BACKFILL_OPTIONS_LOCKED"; message: string };

function sameCalendarDay(
    a: Date | null | undefined,
    b: Date | null | undefined
): boolean {
    return formatBackfillStartDateForApi(a ?? null) ===
        formatBackfillStartDateForApi(b ?? null);
}

/**
 * Resolve whether a start-date mutation is allowed given lock state.
 * `value: undefined` means leave existing unchanged.
 */
export function resolveBackfillStartDateChange(params: {
    backfillStartedAt: Date | null | undefined;
    existingStartDate: Date | null | undefined;
    nextInput: string | null | undefined;
}): BackfillStartDateChangeResult {
    if (params.nextInput === undefined) {
        return { ok: true, value: undefined };
    }

    const normalized = normalizeBackfillStartDateInput(params.nextInput);

    if (!areBackfillOptionsLocked(params.backfillStartedAt)) {
        return { ok: true, value: normalized ?? null };
    }

    if (sameCalendarDay(params.existingStartDate, normalized ?? null)) {
        return { ok: true, value: params.existingStartDate ?? null };
    }

    return {
        ok: false,
        code: "BACKFILL_OPTIONS_LOCKED",
        message:
            "Backfill start date is locked after backfill has started. Reset backfill to change it.",
    };
}

export type IncludeOlderOpenChangeResult =
    | { ok: true; value: boolean | undefined }
    | { ok: false; code: "BACKFILL_OPTIONS_LOCKED"; message: string };

/**
 * Resolve include-older-open mutation under lock.
 * `value: undefined` means leave existing unchanged.
 * Default when creating with a start date is true (schema default).
 */
export function resolveIncludeOlderOpenInvoicesChange(params: {
    backfillStartedAt: Date | null | undefined;
    existingValue: boolean | undefined;
    nextInput: boolean | undefined;
}): IncludeOlderOpenChangeResult {
    if (params.nextInput === undefined) {
        return { ok: true, value: undefined };
    }

    const next = Boolean(params.nextInput);
    if (!areBackfillOptionsLocked(params.backfillStartedAt)) {
        return { ok: true, value: next };
    }

    const existing = params.existingValue ?? true;
    if (existing === next) {
        return { ok: true, value: existing };
    }

    return {
        ok: false,
        code: "BACKFILL_OPTIONS_LOCKED",
        message:
            "Include older open invoices is locked after backfill has started. Reset backfill to change it.",
    };
}

export type SkipReportingBreachChangeResult =
    | { ok: true; value: boolean | undefined }
    | { ok: false; code: "BACKFILL_OPTIONS_LOCKED"; message: string };

/**
 * Resolve skip-reporting-breach mutation under lock.
 * `value: undefined` means leave existing unchanged. Default off.
 */
export function resolveSkipReportingBreachOnBackfillChange(params: {
    backfillStartedAt: Date | null | undefined;
    existingValue: boolean | undefined;
    nextInput: boolean | undefined;
}): SkipReportingBreachChangeResult {
    if (params.nextInput === undefined) {
        return { ok: true, value: undefined };
    }

    const next = Boolean(params.nextInput);
    if (!areBackfillOptionsLocked(params.backfillStartedAt)) {
        return { ok: true, value: next };
    }

    const existing = params.existingValue ?? false;
    if (existing === next) {
        return { ok: true, value: existing };
    }

    return {
        ok: false,
        code: "BACKFILL_OPTIONS_LOCKED",
        message:
            "Skip reporting breach during backfill is locked after backfill has started. Reset backfill to change it.",
    };
}

/**
 * Skip reporting_breach only for connector backfill runs when the switch is on.
 * Incremental/scheduled sync and overnight cron ignore the switch.
 */
export function shouldSkipReportingBreachOnConnectorWrite(params: {
    syncMode: ConnectorSyncMode;
    skipReportingBreachOnBackfill: boolean;
}): boolean {
    return (
        params.syncMode === "BACKFILL" &&
        params.skipReportingBreachOnBackfill === true
    );
}

/**
 * OData $filter for dated backfill pulls (on/after window only).
 * Null = no cutover filter (full history, master data, or incremental).
 * Prefer {@link buildBackfillEntityPullPhases} when older-open may apply.
 */
export function buildDatedBackfillPullFilter(params: {
    entityType: ImportType;
    syncMode: ConnectorSyncMode;
    backfillStartDate: Date | null | undefined;
    timeZone?: string;
}): string | null {
    if (params.syncMode !== "BACKFILL" || !params.backfillStartDate) {
        return null;
    }
    if (params.entityType !== "Invoice" && params.entityType !== "Payment") {
        return null;
    }

    const calendarDate = formatBackfillStartDateForApi(params.backfillStartDate);
    if (!calendarDate) {
        return null;
    }

    const onOrAfterIso = calendarDateStartOfDayUtcIso(
        calendarDate,
        params.timeZone ?? DEFAULT_ACCOUNT_TIMEZONE
    );

    return params.entityType === "Invoice"
        ? buildInvoicesOnOrAfterDateFilter(onOrAfterIso)
        : buildPaymentsOnOrAfterDateFilter(onOrAfterIso);
}

export type BackfillPullPhaseId =
    | "full"
    | "older_open"
    | "related"
    | "dated";

export interface BackfillPullPhase {
    id: BackfillPullPhaseId;
    /**
     * Static OData $filter, null for full history, or `dynamic_related`
     * for payment→invoice link filters resolved after discovering open links.
     */
    filter: string | null | "dynamic_related";
}

export interface BackfillCursorState {
    phaseIndex: number;
    skip: number;
    /** Chunk index within `related` payment link filters. */
    chunk: number;
}

/**
 * Ordered ERP pull phases for one entity. Older-open / related may run before
 * the dated window; ingest still uses chronological entity order + invoice sort.
 */
export function buildBackfillEntityPullPhases(params: {
    entityType: ImportType;
    syncMode: ConnectorSyncMode;
    backfillStartDate: Date | null | undefined;
    includeOlderOpenInvoices?: boolean | null;
    timeZone?: string;
}): BackfillPullPhase[] {
    if (params.syncMode !== "BACKFILL") {
        return [{ id: "full", filter: null }];
    }

    if (
        !params.backfillStartDate ||
        (params.entityType !== "Invoice" && params.entityType !== "Payment")
    ) {
        return [{ id: "full", filter: null }];
    }

    const calendarDate = formatBackfillStartDateForApi(params.backfillStartDate);
    if (!calendarDate) {
        return [{ id: "full", filter: null }];
    }

    const onOrAfterIso = calendarDateStartOfDayUtcIso(
        calendarDate,
        params.timeZone ?? DEFAULT_ACCOUNT_TIMEZONE
    );
    const includeOlder = params.includeOlderOpenInvoices !== false;

    if (params.entityType === "Invoice") {
        const dated: BackfillPullPhase = {
            id: "dated",
            filter: buildInvoicesOnOrAfterDateFilter(onOrAfterIso),
        };
        if (!includeOlder) {
            return [dated];
        }
        return [
            {
                id: "older_open",
                filter: buildUnpaidOpenInvoicesBeforeDateFilter(onOrAfterIso),
            },
            dated,
        ];
    }

    const dated: BackfillPullPhase = {
        id: "dated",
        filter: buildPaymentsOnOrAfterDateFilter(onOrAfterIso),
    };
    if (!includeOlder) {
        return [dated];
    }
    return [{ id: "related", filter: "dynamic_related" }, dated];
}

export function encodeBackfillCursor(state: BackfillCursorState): string {
    return JSON.stringify({
        p: state.phaseIndex,
        s: state.skip,
        c: state.chunk,
    });
}

/**
 * Parse stored cursor. Supports legacy numeric skip strings from slice 02.
 */
export function parseBackfillCursor(
    raw: string | null | undefined,
    phaseCount: number
): BackfillCursorState {
    if (!raw) {
        return { phaseIndex: 0, skip: 0, chunk: 0 };
    }

    const asNumber = Number.parseInt(raw, 10);
    if (Number.isFinite(asNumber) && String(asNumber) === raw.trim()) {
        return {
            phaseIndex: 0,
            skip: Math.max(0, asNumber),
            chunk: 0,
        };
    }

    try {
        const parsed = JSON.parse(raw) as {
            p?: unknown;
            s?: unknown;
            c?: unknown;
        };
        const phaseIndex = Number(parsed.p);
        const skip = Number(parsed.s);
        const chunk = Number(parsed.c);
        return {
            phaseIndex:
                Number.isFinite(phaseIndex) &&
                phaseIndex >= 0 &&
                phaseIndex < Math.max(phaseCount, 1)
                    ? Math.floor(phaseIndex)
                    : 0,
            skip: Number.isFinite(skip) && skip > 0 ? Math.floor(skip) : 0,
            chunk: Number.isFinite(chunk) && chunk > 0 ? Math.floor(chunk) : 0,
        };
    } catch {
        return { phaseIndex: 0, skip: 0, chunk: 0 };
    }
}

/**
 * Snapshot of cutover options stored on sync-history executions (backfill runs).
 */
export interface CutoverOptionsSnapshot {
    backfill_start_date: string | null;
    include_older_open_invoices: boolean;
    skip_reporting_breach_on_backfill: boolean;
}

export function buildCutoverOptionsSnapshot(params: {
    backfillStartDate: Date | null | undefined;
    includeOlderOpenInvoices?: boolean | null;
    skipReportingBreachOnBackfill?: boolean | null;
}): CutoverOptionsSnapshot {
    return {
        backfill_start_date: formatBackfillStartDateForApi(
            params.backfillStartDate
        ),
        include_older_open_invoices: params.includeOlderOpenInvoices !== false,
        skip_reporting_breach_on_backfill:
            params.skipReportingBreachOnBackfill === true,
    };
}

/** Human-readable cutover flags for sync-history / support. */
export function formatCutoverOptionsSummary(
    snapshot: CutoverOptionsSnapshot | null | undefined
): string | null {
    if (!snapshot) {
        return null;
    }
    const parts: string[] = [];
    if (snapshot.backfill_start_date) {
        parts.push(`start ${snapshot.backfill_start_date}`);
        parts.push(
            `older-open ${snapshot.include_older_open_invoices ? "on" : "off"}`
        );
    } else {
        parts.push("full history");
    }
    parts.push(
        `skip-breach ${snapshot.skip_reporting_breach_on_backfill ? "on" : "off"}`
    );
    return parts.join(" · ");
}

export function extractInvoiceCustomerLinks(
    records: readonly Record<string, unknown>[]
): Array<{ ivnum: string; custname: string }> {
    const links: Array<{ ivnum: string; custname: string }> = [];
    const seen = new Set<string>();
    for (const row of records) {
        const ivnum = row.IVNUM;
        const custname = row.CUSTNAME;
        if (typeof ivnum !== "string" || !ivnum.trim()) {
            continue;
        }
        if (typeof custname !== "string" || !custname.trim()) {
            continue;
        }
        const key = `${ivnum}\0${custname}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        links.push({ ivnum: ivnum.trim(), custname: custname.trim() });
    }
    return links;
}
