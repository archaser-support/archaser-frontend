import type { ConnectorAuthType, ImportType } from "@/types/db";
import type { ClearBeforeImportEntity } from "@/shared/services/billingConnectorClearBeforeImport";

export const ENTITY_OPTIONS: { value: ImportType; label: string }[] = [
    { value: "Customer", label: "Customers" },
    { value: "Contact", label: "Contacts" },
    { value: "Invoice", label: "Invoices" },
    { value: "Payment", label: "Payments" },
];

export const CLEAR_BEFORE_IMPORT_ENTITIES: readonly ClearBeforeImportEntity[] = [
    "Customer",
    "Contact",
    "Invoice",
    "Payment",
];

export function isClearBeforeImportEntity(
    value: ImportType
): value is ClearBeforeImportEntity {
    return (CLEAR_BEFORE_IMPORT_ENTITIES as readonly string[]).includes(value);
}

export function firstEnabledEntityTabIndex(enabledEntities: ImportType[]): number {
    const index = ENTITY_OPTIONS.findIndex((opt) =>
        enabledEntities.includes(opt.value)
    );
    return index >= 0 ? index : 0;
}

export const AUTH_TYPE_OPTIONS: { value: ConnectorAuthType; label: string }[] =
    [
        { value: "API_KEY", label: "API key (PAT)" },
        { value: "BASIC", label: "Basic (username / password)" },
        {
            value: "OAUTH2_CLIENT_CREDENTIALS",
            label: "OAuth2 client credentials",
        },
    ];

export type SchedulePresetValue =
    | "every_4h"
    | "every_6h"
    | "every_12h"
    | "daily"
    | "weekly"
    | "custom";

export const SCHEDULE_PRESET_OPTIONS: {
    value: SchedulePresetValue;
    label: string;
}[] = [
    { value: "every_4h", label: "Every 4 hours UTC" },
    { value: "every_6h", label: "Every 6 hours UTC" },
    { value: "every_12h", label: "Every 12 hours UTC" },
    { value: "daily", label: "Daily at a time (UTC)" },
    { value: "weekly", label: "Weekly on a day and time (UTC)" },
    { value: "custom", label: "Custom (Advanced)" },
];

export const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
];

export const DEFAULT_PAID_TOLERANCE = 0.2;
export const PAID_TOLERANCE_MIN = 0;
export const PAID_TOLERANCE_MAX = 10;

export function formatPaidTolerance(value: number | undefined | null): string {
    const n = Number(value);
    return (Number.isFinite(n) ? n : DEFAULT_PAID_TOLERANCE).toFixed(2);
}

export function parsePaidToleranceInput(raw: string): number | null {
    const trimmed = raw.trim();
    if (!trimmed) {
        return null;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
        return null;
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded < PAID_TOLERANCE_MIN || rounded > PAID_TOLERANCE_MAX) {
        return null;
    }
    return rounded;
}

export const NONE_EXTENSION_OPTION = {
    key: "",
    label: "None (standard account)",
} as const;

export type ExtensionKeyOption = { key: string; label: string };
