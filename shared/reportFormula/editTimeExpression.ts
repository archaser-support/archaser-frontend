import {
    getFormulaIdFromOperandReference,
    isFormulaOperandReference,
} from "@/shared/reportFormula/parser";
import type { ReportFormula } from "@/shared/reportFormula/types";

export type FormulaLabelSource = Pick<ReportFormula, "id" | "label">;

/**
 * Edit-time bracket token for a formula — labels may include spaces.
 * Persisted expressions must never use this form.
 */
export function buildEditTimeFormulaReference(label: string): string {
    return `[${label}]`;
}

/**
 * Replace each `[…]` token's inner content via `mapInner`.
 * Unclosed `[` leaves the remainder unchanged.
 */
export function mapBracketTokenInners(
    expression: string,
    mapInner: (inner: string) => string
): string {
    let out = "";
    let i = 0;
    while (i < expression.length) {
        if (expression[i] !== "[") {
            out += expression[i];
            i += 1;
            continue;
        }
        const end = expression.indexOf("]", i);
        if (end === -1) {
            out += expression.slice(i);
            break;
        }
        const inner = expression.slice(i + 1, end);
        out += `[${mapInner(inner)}]`;
        i = end + 1;
    }
    return out;
}

/**
 * Storage → edit-time: `[formula:<id>]` becomes `[Label]` for known formulas.
 * Unknown ids and field refs are left unchanged.
 */
export function expressionToEditTime(
    expression: string,
    formulas: FormulaLabelSource[]
): string {
    const labelById = new Map(
        formulas.map((f) => [f.id, f.label.trim()] as const)
    );
    return mapBracketTokenInners(expression, (inner) => {
        const id = getFormulaIdFromOperandReference(inner);
        if (!id) {
            return inner;
        }
        return labelById.get(id) ?? inner;
    });
}

export type ExpressionToStorageOptions = {
    /** Draft formula id (new or editing) so a typed self-label can convert. */
    draftId?: string | null;
    /** Draft label currently being edited. */
    draftLabel?: string | null;
};

/**
 * Edit-time → storage: formula labels become `[formula:<id>]`.
 * Allowed field references win over formula labels when both could match.
 * Tokens already in `[formula:<id>]` form are left unchanged.
 */
export function expressionToStorage(
    expression: string,
    formulas: FormulaLabelSource[],
    allowedFieldReferences: Set<string>,
    options: ExpressionToStorageOptions = {}
): string {
    const idByLabelLower = new Map<string, string>();
    for (const formula of formulas) {
        idByLabelLower.set(formula.label.trim().toLowerCase(), formula.id);
    }
    const draftLabel = options.draftLabel?.trim();
    const draftId = options.draftId?.trim();
    if (draftLabel && draftId) {
        idByLabelLower.set(draftLabel.toLowerCase(), draftId);
    }

    return mapBracketTokenInners(expression, (inner) => {
        if (isFormulaOperandReference(inner)) {
            return inner;
        }
        // Fields always win over formula labels.
        if (allowedFieldReferences.has(inner)) {
            return inner;
        }
        const formulaId = idByLabelLower.get(inner.toLowerCase());
        if (formulaId) {
            return `formula:${formulaId}`;
        }
        return inner;
    });
}

/**
 * True when `label` case-insensitively matches an allowed field canonical name.
 */
export function formulaLabelCollidesWithField(
    label: string,
    allowedFieldReferences: Set<string>
): string | null {
    const needle = label.trim().toLowerCase();
    if (!needle) {
        return null;
    }
    for (const ref of Array.from(allowedFieldReferences)) {
        if (ref.toLowerCase() === needle) {
            return ref;
        }
    }
    return null;
}
