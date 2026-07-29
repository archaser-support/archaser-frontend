import { extractFieldReferences } from "@/shared/reportFormula/parser";
import type { ReportFormula } from "@/shared/reportFormula/types";

/** Formulas whose expression references the given operand key (case-insensitive). */
export function findFormulasReferencingOperand(
    formulas: ReportFormula[],
    operandReference: string
): ReportFormula[] {
    const needle = operandReference.toLowerCase();
    return formulas.filter((f) =>
        extractFieldReferences(f.expression).some(
            (ref) => ref.toLowerCase() === needle
        )
    );
}
