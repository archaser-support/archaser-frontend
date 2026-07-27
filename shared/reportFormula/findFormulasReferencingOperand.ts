import type { ReportFormula } from "@/shared/reportFormula/types";

/** Formulas whose expression references the given operand key (case-insensitive). */
export function findFormulasReferencingOperand(
    formulas: ReportFormula[],
    operandReference: string
): ReportFormula[] {
    const needle = operandReference.toLowerCase();
    return formulas.filter((f) =>
        (f.expression.match(/\[([^\]]+)\]/g) || []).some(
            (token) => token.slice(1, -1).toLowerCase() === needle
        )
    );
}
