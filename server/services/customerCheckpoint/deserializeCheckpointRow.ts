const BIGINT_FIELD_NAMES = new Set(["activity_id"]);

const ISO_DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

function isIsoDateString(value: string): boolean {
    return ISO_DATE_PATTERN.test(value);
}

function deserializeValue(
    key: string,
    value: unknown,
    options: { bigintPrimaryKey?: boolean }
): unknown {
    if (typeof value !== "string") {
        return value;
    }

    if (options.bigintPrimaryKey && key === "id") {
        return BigInt(value);
    }

    if (BIGINT_FIELD_NAMES.has(key)) {
        return BigInt(value);
    }

    if (isIsoDateString(value)) {
        return new Date(value);
    }

    return value;
}

export function deserializeCheckpointRow(
    row: Record<string, unknown>,
    options: { bigintPrimaryKey?: boolean } = {}
): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
            key,
            deserializeValue(key, value, options),
        ])
    );
}

export function deserializeCheckpointRows(
    rows: Record<string, unknown>[],
    options: { bigintPrimaryKey?: boolean } = {}
): Record<string, unknown>[] {
    return rows.map((row) => deserializeCheckpointRow(row, options));
}
