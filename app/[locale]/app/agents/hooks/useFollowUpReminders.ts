"use client";
import { apiFetch } from "@/utils/apiFetch";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const REMINDER_WINDOW_MINUTES = 10;
/** Overdue window: include follow-ups due in the last 24 hours so yesterday's overdue still show in the reminder */
const REMINDER_OVERDUE_MINUTES = 24 * 60;
const POLL_INTERVAL_ACTIVE_MS = 30 * 1000;
const POLL_INTERVAL_IDLE_MS = 2 * 60 * 1000;
const NEXT_DUE_THRESHOLD_MS = 15 * 60 * 1000;
const SNOOZE_MINUTES = 5;

export interface FollowUpReminderItem {
    customerCollectionPeriodId: number;
    customerId: number;
    customerName: string;
    followUpTime: string;
    isOverdue: boolean;
    /** Content of the activity that scheduled this follow-up (e.g. call notes). */
    activityContent: string | null;
    /** Title of the activity that scheduled this follow-up. */
    activityTitle: string | null;
    /** Params for interpolating activity title placeholders (e.g. userId, time). */
    activityTitleParams: Record<string, unknown> | null;
    /** Agent (user) who created the follow-up activity, if available. */
    agentId?: string | null;
    agentName?: string | null;
}

interface DismissedItem {
    customerCollectionPeriodId: number;
    followUpTime: string;
    snoozedUntil?: string;
}

function getCustomerDisplayName(agent: {
    Customer?: {
        Person?: { first_name: string | null; last_name: string | null };
        Company?: { name: string | null };
    };
}): string {
    const c = agent.Customer;
    if (!c) return "";
    if (c.Person?.first_name != null || c.Person?.last_name != null) {
        return [c.Person?.first_name, c.Person?.last_name].filter(Boolean).join(" ") || "";
    }
    if (c.Company?.name != null) return c.Company.name;
    return "";
}

function buildReminderKey(periodId: number, followUpTime: string): string {
    return `${periodId}:${followUpTime}`;
}

export interface UseFollowUpRemindersOptions {
    /** When false, no polling or fetching. Default true. */
    enabled?: boolean;
}

export function useFollowUpReminders(options?: UseFollowUpRemindersOptions) {
    const enabled = options?.enabled !== false;
    const [queue, setQueue] = useState<FollowUpReminderItem[]>([]);
    const [dismissedSet, setDismissedSet] = useState<Set<string>>(new Set());
    const [visible, setVisible] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollIntervalMsRef = useRef(POLL_INTERVAL_ACTIVE_MS);
    const lastPollHadItemsRef = useRef(false);
    const nextDueTimeRef = useRef<number | null>(null);

    const fetchDismissed = useCallback(async (): Promise<DismissedItem[]> => {
        try {
            const res = await apiFetch("/api/agents/follow-up-reminder/dismissed", {
                credentials: "include",
            });
            if (!res.ok) return [];
            const data = await res.json();
            return data.dismissed ?? [];
        } catch {
            return [];
        }
    }, []);

    const fetchReminderWindow = useCallback(async (): Promise<FollowUpReminderItem[]> => {
        try {
            const params = new URLSearchParams({
                page: "1",
                limit: "100",
                reminderWindowMinutes: String(REMINDER_WINDOW_MINUTES),
                reminderOverdueMinutes: String(REMINDER_OVERDUE_MINUTES),
            });
            const res = await apiFetch(`/api/system/agents/follow-up?${params}`,
                { credentials: "include" }
            );
            if (!res.ok) return [];
            const data = await res.json();
            const agents = data.agents ?? [];
            const now = Date.now();
            return agents.map((a: any) => {
                const followUpTime =
                    typeof a.follow_up_time === "string"
                        ? a.follow_up_time
                        : new Date(a.follow_up_time).toISOString();
                const followUpMs = new Date(followUpTime).getTime();
                const isOverdue = followUpMs < now;
                const activityList = a.Activity ?? a.activity ?? [];
                const followUpActivity = Array.isArray(activityList) ? activityList[0] : null;
                const rawContent = followUpActivity?.content;
                const rawTitle = followUpActivity?.title;
                const rawTitleParams = followUpActivity?.title_params;
                const createdByUser = followUpActivity?.User_Activity_created_byToUser;
                const agentId: string | null = createdByUser?.id ?? null;
                const agentName: string | null =
                    createdByUser?.name ||
                    [createdByUser?.first_name, createdByUser?.last_name]
                        .filter(Boolean)
                        .join(" ") ||
                    null;
                const titleParams =
                    rawTitleParams &&
                    typeof rawTitleParams === "object" &&
                    !Array.isArray(rawTitleParams)
                        ? (rawTitleParams as Record<string, unknown>)
                        : null;
                return {
                    customerCollectionPeriodId: Number(a.id),
                    customerId: Number(a.Customer?.id ?? 0),
                    customerName: getCustomerDisplayName(a),
                    followUpTime,
                    isOverdue,
                    activityContent:
                        typeof rawContent === "string" && rawContent.trim()
                            ? rawContent.trim()
                            : null,
                    activityTitle:
                        typeof rawTitle === "string" && rawTitle.trim()
                            ? rawTitle.trim()
                            : null,
                    activityTitleParams: titleParams,
                    agentId,
                    agentName,
                };
            });
        } catch {
            return [];
        }
    }, []);

    const runPoll = useCallback(async () => {
        if (!enabled || !visible) return;
        const [items, dismissed] = await Promise.all([
            fetchReminderWindow(),
            fetchDismissed(),
        ]);

        const dismissedKeys = new Set(
            dismissed.map((d) =>
                buildReminderKey(d.customerCollectionPeriodId, d.followUpTime)
            )
        );
        const toShow = items.filter(
            (item) =>
                !dismissedKeys.has(
                    buildReminderKey(item.customerCollectionPeriodId, item.followUpTime)
                )
        );
        setDismissedSet(dismissedKeys);
        setQueue((prev) => {
            const seen = new Set(
                prev.map((p) =>
                    buildReminderKey(p.customerCollectionPeriodId, p.followUpTime)
                )
            );
            const added = toShow.filter(
                (i) =>
                    !seen.has(
                        buildReminderKey(i.customerCollectionPeriodId, i.followUpTime)
                    )
            );
            if (added.length === 0) return prev;
            return [...prev, ...added];
        });

        const hadItems = toShow.length > 0;
        lastPollHadItemsRef.current = hadItems;
        if (toShow.length > 0) {
            const nextDue = Math.min(
                ...toShow.map((i) => new Date(i.followUpTime).getTime())
            );
            nextDueTimeRef.current = nextDue;
        } else {
            nextDueTimeRef.current = null;
        }
    }, [enabled, visible, fetchReminderWindow, fetchDismissed]);

    const pathname = usePathname();

    useEffect(() => {
        const onVisibilityChange = () => {
            const v = document.visibilityState === "visible";
            setVisible(v);
            if (v) {
                runPoll();
            }
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }, [runPoll]);

    // Refetch when route changes so reminder appears without full refresh (e.g. navigating to customers)
    useEffect(() => {
        if (pathname && visible && enabled) {
            runPoll();
        }
    }, [pathname, visible, enabled, runPoll]);

    useEffect(() => {
        if (!enabled || !visible) {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        let timeoutId: ReturnType<typeof setTimeout>;
        const scheduleNext = () => {
            const nextDue = nextDueTimeRef.current;
            const now = Date.now();
            const nextWithinThreshold =
                nextDue != null && nextDue - now <= NEXT_DUE_THRESHOLD_MS;
            const intervalMs =
                lastPollHadItemsRef.current || nextWithinThreshold
                    ? POLL_INTERVAL_ACTIVE_MS
                    : POLL_INTERVAL_IDLE_MS;
            pollIntervalMsRef.current = intervalMs;
            timeoutId = setTimeout(() => {
                runPoll().then(scheduleNext);
            }, intervalMs);
        };
        runPoll().then(scheduleNext);
        return () => clearTimeout(timeoutId);
    }, [enabled, visible, runPoll]);

    const currentReminder = queue[0] ?? null;
    const queueLength = queue.length;

    const dismiss = useCallback(
        async (item: FollowUpReminderItem) => {
            setQueue((prev) =>
                prev.filter(
                    (q) =>
                        q.customerCollectionPeriodId !== item.customerCollectionPeriodId ||
                        q.followUpTime !== item.followUpTime
                )
            );
            await apiFetch("/api/agents/follow-up-reminder/dismiss", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    customerCollectionPeriodId: item.customerCollectionPeriodId,
                    followUpTime: item.followUpTime,
                    customerId: item.customerId,
                    customerName: item.customerName,
                    action: "dismiss",
                }),
            });
        },
        []
    );

    const snooze = useCallback(
        async (item: FollowUpReminderItem) => {
            const snoozedUntil = new Date(Date.now() + SNOOZE_MINUTES * 60 * 1000).toISOString();
            setQueue((prev) =>
                prev.filter(
                    (q) =>
                        q.customerCollectionPeriodId !== item.customerCollectionPeriodId ||
                        q.followUpTime !== item.followUpTime
                )
            );
            await apiFetch("/api/agents/follow-up-reminder/dismiss", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    customerCollectionPeriodId: item.customerCollectionPeriodId,
                    followUpTime: item.followUpTime,
                    customerId: item.customerId,
                    customerName: item.customerName,
                    action: "snooze",
                    snoozedUntil,
                }),
            });
        },
        []
    );

    const markComplete = useCallback(
        async (item: FollowUpReminderItem) => {
            setQueue((prev) =>
                prev.filter(
                    (q) =>
                        q.customerCollectionPeriodId !== item.customerCollectionPeriodId ||
                        q.followUpTime !== item.followUpTime
                )
            );
            await apiFetch("/api/agents/follow-up-reminder/dismiss", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    customerCollectionPeriodId: item.customerCollectionPeriodId,
                    followUpTime: item.followUpTime,
                    customerId: item.customerId,
                    customerName: item.customerName,
                    action: "complete",
                }),
            });
        },
        []
    );

    const goToCustomer = useCallback((item: FollowUpReminderItem) => {
        if (typeof window !== "undefined" && item.customerId) {
            window.location.href = `/app/customers/${item.customerId}?activeTab=outstanding-activities-tab`;
        }
    }, []);

    return {
        currentReminder,
        queueLength,
        dismiss,
        snooze,
        markComplete,
        goToCustomer,
    };
}
