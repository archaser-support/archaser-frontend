import { serializeBigInt } from "@/utils/serializeBigInt";

function serializeValue(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (typeof value === "bigint") {
        return value.toString();
    }
    if (
        value !== null &&
        typeof value === "object" &&
        typeof (value as { toJSON?: () => unknown }).toJSON === "function"
    ) {
        return (value as { toJSON: () => unknown }).toJSON();
    }
    return value;
}

export function serializeCheckpointRow<T extends Record<string, unknown>>(
    row: T
): Record<string, unknown> {
    return serializeBigInt(
        Object.fromEntries(
            Object.entries(row).map(([key, value]) => [key, serializeValue(value)])
        )
    ) as Record<string, unknown>;
}

export function serializeCheckpointRows<T extends Record<string, unknown>>(
    rows: T[]
): Record<string, unknown>[] {
    return rows.map((row) => serializeCheckpointRow(row));
}
