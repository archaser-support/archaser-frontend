/**
 * Minimal OData $filter evaluator for the Priority mock server.
 * Supports eq/ne/gt/ge/lt/le, and/or, parentheses, string/number/datetime literals.
 * Not a full OData parser — enough for dated-backfill and incremental filters.
 */

export type ODataFilterRecord = Record<string, unknown>;

type Token =
    | { kind: "ident"; value: string }
    | { kind: "string"; value: string }
    | { kind: "number"; value: number }
    | { kind: "datetime"; value: number }
    | { kind: "op"; value: string }
    | { kind: "lparen" }
    | { kind: "rparen" };

const COMPARISON_OPS = new Set(["eq", "ne", "gt", "ge", "lt", "le"]);

function tokenize(filter: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < filter.length) {
        const ch = filter[i];
        if (ch === " " || ch === "\t" || ch === "\n") {
            i += 1;
            continue;
        }
        if (ch === "(") {
            tokens.push({ kind: "lparen" });
            i += 1;
            continue;
        }
        if (ch === ")") {
            tokens.push({ kind: "rparen" });
            i += 1;
            continue;
        }
        if (ch === "'") {
            i += 1;
            let value = "";
            while (i < filter.length) {
                if (filter[i] === "'" && filter[i + 1] === "'") {
                    value += "'";
                    i += 2;
                    continue;
                }
                if (filter[i] === "'") {
                    i += 1;
                    break;
                }
                value += filter[i];
                i += 1;
            }
            tokens.push({ kind: "string", value });
            continue;
        }

        // datetime or number or ident/keyword
        if (/[0-9]/.test(ch) || (ch === "-" && /[0-9]/.test(filter[i + 1] ?? ""))) {
            const start = i;
            while (i < filter.length && !/[\s()]/.test(filter[i]!)) {
                i += 1;
            }
            const raw = filter.slice(start, i);
            if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
                const ms = Date.parse(raw);
                tokens.push({
                    kind: "datetime",
                    value: Number.isNaN(ms) ? NaN : ms,
                });
            } else {
                const num = Number(raw);
                tokens.push(
                    Number.isFinite(num)
                        ? { kind: "number", value: num }
                        : { kind: "ident", value: raw }
                );
            }
            continue;
        }

        if (/[A-Za-z_]/.test(ch)) {
            const start = i;
            while (i < filter.length && /[A-Za-z0-9_]/.test(filter[i]!)) {
                i += 1;
            }
            const value = filter.slice(start, i);
            if (
                COMPARISON_OPS.has(value) ||
                value === "and" ||
                value === "or"
            ) {
                tokens.push({ kind: "op", value });
            } else {
                tokens.push({ kind: "ident", value });
            }
            continue;
        }

        throw new Error(`Unexpected character in $filter at ${i}: ${ch}`);
    }

    return tokens;
}

class Parser {
    private pos = 0;

    constructor(private readonly tokens: Token[]) {}

    parse(): (row: ODataFilterRecord) => boolean {
        const expr = this.parseOr();
        if (this.pos !== this.tokens.length) {
            throw new Error("Unexpected trailing tokens in $filter");
        }
        return expr;
    }

    private peek(): Token | undefined {
        return this.tokens[this.pos];
    }

    private consume(): Token {
        const token = this.tokens[this.pos];
        if (!token) {
            throw new Error("Unexpected end of $filter");
        }
        this.pos += 1;
        return token;
    }

    private peekOp(value: string): boolean {
        const token = this.peek();
        return token?.kind === "op" && token.value === value;
    }

    private parseOr(): (row: ODataFilterRecord) => boolean {
        let left = this.parseAnd();
        while (this.peekOp("or")) {
            this.consume();
            const right = this.parseAnd();
            const prev = left;
            left = (row) => prev(row) || right(row);
        }
        return left;
    }

    private parseAnd(): (row: ODataFilterRecord) => boolean {
        let left = this.parsePrimary();
        while (this.peekOp("and")) {
            this.consume();
            const right = this.parsePrimary();
            const prev = left;
            left = (row) => prev(row) && right(row);
        }
        return left;
    }

    private parsePrimary(): (row: ODataFilterRecord) => boolean {
        if (this.peek()?.kind === "lparen") {
            this.consume();
            const inner = this.parseOr();
            const close = this.consume();
            if (close.kind !== "rparen") {
                throw new Error("Expected ')' in $filter");
            }
            return inner;
        }
        return this.parseComparison();
    }

    private parseComparison(): (row: ODataFilterRecord) => boolean {
        const fieldTok = this.consume();
        if (fieldTok.kind !== "ident") {
            throw new Error("Expected field name in $filter comparison");
        }
        const opTok = this.consume();
        if (opTok.kind !== "op" || !COMPARISON_OPS.has(opTok.value)) {
            throw new Error(`Expected comparison operator after ${fieldTok.value}`);
        }
        const valueTok = this.consume();
        const field = fieldTok.value;
        const op = opTok.value;

        return (row) => compare(row[field], op, valueTok);
    }
}

function asNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const asDate = Date.parse(value);
        if (!Number.isNaN(asDate) && /\d{4}-\d{2}-\d{2}/.test(value)) {
            return asDate;
        }
        const asNum = Number(value);
        if (Number.isFinite(asNum) && value.trim() !== "") {
            return asNum;
        }
    }
    return null;
}

function compare(left: unknown, op: string, valueTok: Token): boolean {
    if (valueTok.kind === "string") {
        const right = valueTok.value;
        const leftStr = left == null ? "" : String(left);
        switch (op) {
            case "eq":
                return leftStr === right;
            case "ne":
                return leftStr !== right;
            default:
                return false;
        }
    }

    const rightNum =
        valueTok.kind === "number" || valueTok.kind === "datetime"
            ? valueTok.value
            : null;
    const leftNum = asNumber(left);
    if (rightNum === null || leftNum === null || Number.isNaN(rightNum)) {
        if (op === "eq") {
            return left == null && valueTok.kind === "ident" && valueTok.value === "null";
        }
        return false;
    }

    switch (op) {
        case "eq":
            return leftNum === rightNum;
        case "ne":
            return leftNum !== rightNum;
        case "gt":
            return leftNum > rightNum;
        case "ge":
            return leftNum >= rightNum;
        case "lt":
            return leftNum < rightNum;
        case "le":
            return leftNum <= rightNum;
        default:
            return false;
    }
}

/**
 * Compile an OData $filter into a predicate.
 * Also accepts the incremental `UDATE ge …` form used by PriorityClient.
 */
export function compileODataFilter(
    filter: string | undefined
): ((row: ODataFilterRecord) => boolean) | null {
    if (!filter?.trim()) {
        return null;
    }
    const tokens = tokenize(filter.trim());
    return new Parser(tokens).parse();
}

export function applyODataFilter<T extends ODataFilterRecord>(
    rows: readonly T[],
    filter: string | undefined
): T[] {
    const predicate = compileODataFilter(filter);
    if (!predicate) {
        return [...rows];
    }
    return rows.filter((row) => predicate(row));
}
