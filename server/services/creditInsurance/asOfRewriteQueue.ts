import { Prisma } from "@prisma/client";

import { prisma as defaultPrisma } from "@/lib/prisma";
import { startOfTodayUtc } from "@/shared/creditInsurance/insurancePolicyLifecycle";

/** Full client (incl. `$transaction`), so enqueue can lock the pending row. */
type PrismaClientLike = typeof defaultPrisma;

/**
 * Minimal client surface the enqueue core needs. Both the full client and a
 * `$transaction` callback client (`Prisma.TransactionClient`) satisfy this, so
 * mutation seams already running in a transaction can enqueue **atomically** —
 * if their transaction rolls back, the queued rewrite rolls back with it.
 */
type RawCapableClient = {
    $queryRaw: PrismaClientLike["$queryRaw"];
    $executeRaw: PrismaClientLike["$executeRaw"];
};

/**
 * Coalesced as-of rewrite queue (PRD slice 3 + overnight drain reliability).
 *
 * Invoice/payment/policy/top-up changes enqueue a `{ accountId, customerIds,
 * fromDate, toDate }` window. To avoid a per-row job storm on bulk imports, all
 * pending work for an account is coalesced into a **single pending row** whose
 * date span is widened and whose customer set is unioned (empty = whole account).
 * The daily CPT cron drains pending rows and recomputes the affected historical
 * days via the as-of writers, checkpointing the last completed day so long
 * windows resume across nights.
 */

/** Age after which a stuck `processing` row is reclaimed to `pending` (above CPT cron timeout). */
export const REWRITE_QUEUE_STALE_PROCESSING_MS = 60 * 60 * 1000;

export type RewriteRange = {
    /** Empty = whole account (all customers). */
    customerIds: number[];
    fromDate: Date;
    toDate: Date;
};

function toDayStartUtc(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
}

function nextUtcDay(date: Date): Date {
    const next = toDayStartUtc(date);
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
}

/**
 * Resume day for a queued window: day after last completed checkpoint, or
 * `fromDate` when none. Never starts before `fromDate` (guards a stale
 * checkpoint after a backward-widened coalesce that should have been reset).
 */
export function resolveRewriteDrainStart(
    fromDate: Date,
    checkpointDate: Date | null | undefined
): Date {
    const from = toDayStartUtc(fromDate);
    if (!checkpointDate) {
        return from;
    }
    const resume = nextUtcDay(checkpointDate);
    return resume.getTime() < from.getTime() ? from : resume;
}

/**
 * When coalesce widens `fromDate` backward, clear the checkpoint so newly added
 * earlier days are not skipped. Otherwise keep the existing checkpoint.
 */
export function coalesceCheckpointDate(
    existingFromDate: Date,
    mergedFromDate: Date,
    existingCheckpoint: Date | null | undefined
): Date | null {
    const existingFrom = toDayStartUtc(existingFromDate);
    const mergedFrom = toDayStartUtc(mergedFromDate);
    if (mergedFrom.getTime() < existingFrom.getTime()) {
        return null;
    }
    return existingCheckpoint ? toDayStartUtc(existingCheckpoint) : null;
}

/** Pure stale check used by reclaim (and unit tests). */
export function isStaleProcessingUpdatedAt(
    updatedAt: Date,
    now: Date = new Date(),
    staleMs: number = REWRITE_QUEUE_STALE_PROCESSING_MS
): boolean {
    return now.getTime() - updatedAt.getTime() >= staleMs;
}

/**
 * Admin full-history backfill blocks overnight drain while `running` or
 * `paused` so the two writers do not race the same CPT/dashboard days.
 */
export function isAdminBackfillBlockingDrain(
    status: string | null | undefined
): boolean {
    return status === "running" || status === "paused";
}

function unionCustomerIds(a: number[], b: number[]): number[] {
    // Empty means "all customers" — the widest scope wins.
    if (a.length === 0 || b.length === 0) {
        return [];
    }
    return Array.from(new Set([...a, ...b])).sort((x, y) => x - y);
}

/**
 * Pure coalesce of two rewrite ranges for the same account: widen the date span
 * and union the customer sets (empty = all). Unit-tested.
 */
export function mergeRewriteRange(
    existing: RewriteRange,
    incoming: RewriteRange
): RewriteRange {
    const fromDate =
        incoming.fromDate < existing.fromDate
            ? incoming.fromDate
            : existing.fromDate;
    const toDate =
        incoming.toDate > existing.toDate ? incoming.toDate : existing.toDate;
    return {
        customerIds: unionCustomerIds(existing.customerIds, incoming.customerIds),
        fromDate: toDayStartUtc(fromDate),
        toDate: toDayStartUtc(toDate),
    };
}

function customerIdsSql(ids: number[]): Prisma.Sql {
    if (ids.length === 0) {
        return Prisma.sql`ARRAY[]::int[]`;
    }
    return Prisma.sql`ARRAY[${Prisma.join(ids)}]::int[]`;
}

type PendingRow = {
    id: bigint;
    from_date: Date;
    to_date: Date;
    customer_ids: number[];
    checkpoint_date: Date | null;
};

export type EnqueueAsOfRewriteInput = {
    accountId: number;
    /** Empty / omitted = whole account. */
    customerIds?: number[];
    fromDate: Date;
    toDate: Date;
};

/**
 * Coalesce core: lock the account's pending row (if any) and widen/union it, else
 * insert. Uses only `$queryRaw`/`$executeRaw` so it runs on either the full client
 * or an in-flight transaction client. Callers provide transactional wrapping.
 */
async function enqueueAsOfRewriteWithClient(
    client: RawCapableClient,
    input: EnqueueAsOfRewriteInput
): Promise<void> {
    const incoming: RewriteRange = {
        customerIds: (input.customerIds ?? []).filter((id) =>
            Number.isFinite(id)
        ),
        fromDate: toDayStartUtc(input.fromDate),
        toDate: toDayStartUtc(input.toDate),
    };
    if (incoming.toDate < incoming.fromDate) {
        return;
    }

    const existing = await client.$queryRaw<PendingRow[]>`
        SELECT id, from_date, to_date, customer_ids, checkpoint_date
        FROM "CreditAsOfRewriteQueue"
        WHERE account_id = ${input.accountId} AND status = 'pending'
        ORDER BY id ASC
        LIMIT 1
        FOR UPDATE
    `;

    if (existing.length === 0) {
        await client.$executeRaw`
            INSERT INTO "CreditAsOfRewriteQueue" (
                account_id, customer_ids, from_date, to_date, status
            ) VALUES (
                ${input.accountId},
                ${customerIdsSql(incoming.customerIds)},
                ${incoming.fromDate},
                ${incoming.toDate},
                'pending'
            )
        `;
        return;
    }

    const row = existing[0]!;
    const merged = mergeRewriteRange(
        {
            customerIds: row.customer_ids ?? [],
            fromDate: row.from_date,
            toDate: row.to_date,
        },
        incoming
    );
    const nextCheckpoint = coalesceCheckpointDate(
        row.from_date,
        merged.fromDate,
        row.checkpoint_date
    );
    await client.$executeRaw`
        UPDATE "CreditAsOfRewriteQueue"
        SET customer_ids = ${customerIdsSql(merged.customerIds)},
            from_date = ${merged.fromDate},
            to_date = ${merged.toDate},
            checkpoint_date = ${nextCheckpoint},
            updated_at = NOW()
        WHERE id = ${row.id}
    `;
}

/**
 * Enqueue a rewrite window, coalescing into the account's single pending row.
 * Opens its own transaction; use {@link enqueueAsOfRewriteInTransaction} from a
 * mutation that is already inside a transaction. Safe to call per mutation / per
 * import — never fans out.
 */
export async function enqueueAsOfRewrite(
    input: EnqueueAsOfRewriteInput,
    dbClient: PrismaClientLike = defaultPrisma
): Promise<void> {
    await dbClient.$transaction((tx) => enqueueAsOfRewriteWithClient(tx, input));
}

/**
 * Enqueue within an existing transaction (atomic with the caller's mutation).
 * Pass the transaction client the mutation is running on.
 */
export async function enqueueAsOfRewriteInTransaction(
    tx: RawCapableClient,
    input: EnqueueAsOfRewriteInput
): Promise<void> {
    await enqueueAsOfRewriteWithClient(tx, input);
}

/**
 * Enqueue a rewrite window at import-job completion. `fromDate` is the **minimum
 * successful** `invoice_date` / `payment_date` in the job (so a last-day-of-prior
 * -month batch rewrites from the right anchor); `toDate` is today. Imports never
 * block on the drain — this only writes the queue.
 */
export async function enqueueRewriteForImport(
    args: {
        accountId: number;
        importType: "Invoice" | "Payment";
        entityIds: number[];
        customerIds: number[];
    },
    dbClient: PrismaClientLike = defaultPrisma
): Promise<void> {
    const entityIds = args.entityIds.filter((id) => Number.isFinite(id));
    if (entityIds.length === 0) {
        return;
    }

    let minDate: Date | null = null;
    if (args.importType === "Invoice") {
        const agg = await dbClient.invoice.aggregate({
            where: { id: { in: entityIds } },
            _min: { invoice_date: true },
        });
        minDate = agg._min.invoice_date ?? null;
    } else {
        const agg = await dbClient.invoicePayment.aggregate({
            where: { id: { in: entityIds } },
            _min: { payment_date: true },
        });
        minDate = agg._min.payment_date ?? null;
    }

    if (!minDate) {
        return;
    }

    await enqueueAsOfRewrite(
        {
            accountId: args.accountId,
            customerIds: args.customerIds,
            fromDate: minDate,
            toDate: startOfTodayUtc(),
        },
        dbClient
    );
}

function enumerateUtcDays(fromDate: Date, toDate: Date): Date[] {
    const days: Date[] = [];
    const cursor = toDayStartUtc(fromDate);
    const end = toDayStartUtc(toDate);
    // Cap defensively so a corrupt row cannot loop forever.
    let guard = 0;
    while (cursor.getTime() <= end.getTime() && guard < 4000) {
        days.push(new Date(cursor.getTime()));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
        guard += 1;
    }
    return days;
}

export type DrainAsOfRewriteResult = {
    itemsProcessed: number;
    daysRewritten: number;
    failures: number;
    /** Queue rows left pending because admin as-of backfill is running/paused. */
    skippedForBackfill: number;
};

type DrainWriters = {
    syncCustomerPolicyTrendSnapshotForAccount: (
        accountId: number,
        options: { snapshotDate: Date; customerIds?: number[] }
    ) => Promise<unknown>;
    takeCreditDashboardDailySnapshotsForAccount: (
        accountId: number,
        options: { snapshotDate: Date }
    ) => Promise<unknown>;
};

/**
 * Drain pending rewrite items: for each, recompute CPT (touched customers only)
 * and CreditDashboardDailySnapshot (full account scopes) for every remaining day
 * in the window (after checkpoint). Invoked inside/right after the CPT daily
 * snapshot cron. Reclaims stale `processing` rows first so crashed drains heal.
 */
export async function drainAsOfRewriteQueue(options?: {
    maxItems?: number;
    dbClient?: PrismaClientLike;
    /** Injected clock for reclaim tests. */
    now?: Date;
    /** Optional writer overrides (unit tests). */
    writers?: Partial<DrainWriters>;
}): Promise<DrainAsOfRewriteResult> {
    const db = options?.dbClient ?? defaultPrisma;
    const maxItems = options?.maxItems ?? 25;
    const now = options?.now ?? new Date();
    const staleBefore = new Date(
        now.getTime() - REWRITE_QUEUE_STALE_PROCESSING_MS
    );

    // Reclaim timed-out / crashed claims before selecting new pending work.
    await db.$executeRaw`
        UPDATE "CreditAsOfRewriteQueue"
        SET status = 'pending', updated_at = ${now}
        WHERE status = 'processing'
          AND updated_at < ${staleBefore}
    `;

    const syncCpt =
        options?.writers?.syncCustomerPolicyTrendSnapshotForAccount ??
        (
            await import("./customerPolicyTrendService")
        ).syncCustomerPolicyTrendSnapshotForAccount;
    const takeDashboard =
        options?.writers?.takeCreditDashboardDailySnapshotsForAccount ??
        (
            await import("./creditDashboardSnapshotService")
        ).takeCreditDashboardDailySnapshotsForAccount;

    const pending = await db.$queryRaw<
        Array<PendingRow & { account_id: number }>
    >`
        SELECT id, account_id, from_date, to_date, customer_ids, checkpoint_date
        FROM "CreditAsOfRewriteQueue"
        WHERE status = 'pending'
        ORDER BY created_at ASC
        LIMIT ${maxItems}
    `;

    const blockingAccountIds = new Set<number>();
    if (pending.length > 0) {
        const accountIds = Array.from(
            new Set(pending.map((item) => item.account_id))
        );
        const blockingRows = await db.$queryRaw<Array<{ account_id: number }>>`
            SELECT account_id
            FROM "CreditAsOfBackfillJob"
            WHERE account_id IN (${Prisma.join(accountIds)})
              AND status IN ('running', 'paused')
        `;
        for (const row of blockingRows) {
            blockingAccountIds.add(row.account_id);
        }
    }

    let itemsProcessed = 0;
    let daysRewritten = 0;
    let failures = 0;
    let skippedForBackfill = 0;

    for (const item of pending) {
        if (blockingAccountIds.has(item.account_id)) {
            // Leave pending for a later drain once backfill finishes; not a hard failure.
            skippedForBackfill += 1;
            continue;
        }

        // Claim the item so a concurrent drain does not double-process it.
        const claimed = await db.$executeRaw`
            UPDATE "CreditAsOfRewriteQueue"
            SET status = 'processing', updated_at = ${now}
            WHERE id = ${item.id} AND status = 'pending'
        `;
        if (claimed === 0) {
            continue;
        }

        try {
            const customerIds = (item.customer_ids ?? []).filter((id) =>
                Number.isFinite(id)
            );
            const resumeFrom = resolveRewriteDrainStart(
                item.from_date,
                item.checkpoint_date
            );
            const days = enumerateUtcDays(resumeFrom, item.to_date);
            for (const day of days) {
                await syncCpt(item.account_id, {
                    snapshotDate: day,
                    customerIds:
                        customerIds.length > 0 ? customerIds : undefined,
                });
                await takeDashboard(item.account_id, { snapshotDate: day });
                // Persist last completed day so the next drain can resume.
                await db.$executeRaw`
                    UPDATE "CreditAsOfRewriteQueue"
                    SET checkpoint_date = ${day}, updated_at = ${now}
                    WHERE id = ${item.id}
                `;
                daysRewritten += 1;
            }
            await db.$executeRaw`
                UPDATE "CreditAsOfRewriteQueue"
                SET status = 'done', updated_at = ${now}
                WHERE id = ${item.id}
            `;
            itemsProcessed += 1;
        } catch (error) {
            failures += 1;
            const message =
                error instanceof Error ? error.message : String(error);
            await db.$executeRaw`
                UPDATE "CreditAsOfRewriteQueue"
                SET status = 'pending',
                    attempts = attempts + 1,
                    last_error = ${message.slice(0, 1000)},
                    updated_at = ${now}
                WHERE id = ${item.id}
            `;
        }
    }

    return { itemsProcessed, daysRewritten, failures, skippedForBackfill };
}
