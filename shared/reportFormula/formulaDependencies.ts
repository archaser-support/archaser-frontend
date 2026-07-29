import {
    extractFieldReferences,
    getFormulaIdFromOperandReference,
    isFormulaOperandReference,
} from "@/shared/reportFormula/parser";
import type { ReportFormula } from "@/shared/reportFormula/types";

export function getDirectFormulaDependencyIds(expression: string): string[] {
    const ids: string[] = [];
    for (const ref of extractFieldReferences(expression)) {
        const id = getFormulaIdFromOperandReference(ref);
        if (id && !ids.includes(id)) {
            ids.push(id);
        }
    }
    return ids;
}

export function getDirectFieldReferences(expression: string): string[] {
    return extractFieldReferences(expression).filter(
        (ref) => !isFormulaOperandReference(ref)
    );
}

export function buildFormulaDependencyMap(
    formulas: ReportFormula[]
): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const formula of formulas) {
        map.set(formula.id, getDirectFormulaDependencyIds(formula.expression));
    }
    return map;
}

/**
 * Returns formulas that directly reference `formulaId` via `[formula:<id>]`.
 */
export function findFormulasDependingOnFormula(
    formulas: ReportFormula[],
    formulaId: string
): ReportFormula[] {
    const needle = formulaId.toLowerCase();
    return formulas.filter((formula) =>
        getDirectFormulaDependencyIds(formula.expression).some(
            (id) => id.toLowerCase() === needle
        )
    );
}

/**
 * True when `fromId` can reach `toId` by following formula→formula edges.
 */
export function formulaDependsOnFormula(
    dependencyMap: Map<string, string[]>,
    fromId: string,
    toId: string
): boolean {
    if (fromId === toId) {
        return true;
    }
    const visited = new Set<string>();
    const stack = [...(dependencyMap.get(fromId) || [])];
    while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === toId) {
            return true;
        }
        if (visited.has(current)) {
            continue;
        }
        visited.add(current);
        for (const next of dependencyMap.get(current) || []) {
            stack.push(next);
        }
    }
    return false;
}

/**
 * Whether inserting a reference to `candidateId` into `editingId`'s expression
 * would create a cycle (self-ref or mutual dependency).
 */
export function wouldCreateFormulaCycle(
    formulas: ReportFormula[],
    editingId: string | null,
    candidateId: string
): boolean {
    if (editingId && editingId === candidateId) {
        return true;
    }
    if (!editingId) {
        return false;
    }
    const dependencyMap = buildFormulaDependencyMap(formulas);
    // Cycle if the candidate already depends (transitively) on the formula being edited.
    return formulaDependsOnFormula(dependencyMap, candidateId, editingId);
}

export type FormulaGraphError =
    | { code: "unknown_formula"; formulaId: string; missingId: string }
    | { code: "self_reference"; formulaId: string }
    | { code: "cycle"; formulaId: string; path: string[] }
    | { code: "no_transitive_field"; formulaId: string };

/**
 * Detect cycles, missing formula ids, self-refs, and formulas that never
 * reach a real report field. Does not validate field allowlists.
 */
export function validateFormulaDependencyGraph(
    formulas: ReportFormula[]
): FormulaGraphError | null {
    const byId = new Map(formulas.map((f) => [f.id, f]));
    const dependencyMap = buildFormulaDependencyMap(formulas);

    for (const formula of formulas) {
        const deps = dependencyMap.get(formula.id) || [];
        for (const depId of deps) {
            if (depId === formula.id) {
                return { code: "self_reference", formulaId: formula.id };
            }
            if (!byId.has(depId)) {
                return {
                    code: "unknown_formula",
                    formulaId: formula.id,
                    missingId: depId,
                };
            }
        }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const path: string[] = [];

    const visit = (id: string): FormulaGraphError | null => {
        if (visited.has(id)) {
            return null;
        }
        if (visiting.has(id)) {
            const cycleStart = path.indexOf(id);
            return {
                code: "cycle",
                formulaId: id,
                path: [...path.slice(cycleStart), id],
            };
        }
        visiting.add(id);
        path.push(id);
        for (const depId of dependencyMap.get(id) || []) {
            const err = visit(depId);
            if (err) {
                return err;
            }
        }
        path.pop();
        visiting.delete(id);
        visited.add(id);
        return null;
    };

    for (const formula of formulas) {
        const err = visit(formula.id);
        if (err) {
            return err;
        }
    }

    const reachesField = new Map<string, boolean>();
    const computeReachesField = (id: string, stack: Set<string>): boolean => {
        if (reachesField.has(id)) {
            return reachesField.get(id)!;
        }
        if (stack.has(id)) {
            return false;
        }
        const formula = byId.get(id);
        if (!formula) {
            return false;
        }
        if (getDirectFieldReferences(formula.expression).length > 0) {
            reachesField.set(id, true);
            return true;
        }
        stack.add(id);
        let ok = false;
        for (const depId of dependencyMap.get(id) || []) {
            if (computeReachesField(depId, stack)) {
                ok = true;
                break;
            }
        }
        stack.delete(id);
        reachesField.set(id, ok);
        return ok;
    };

    for (const formula of formulas) {
        if (!computeReachesField(formula.id, new Set())) {
            return { code: "no_transitive_field", formulaId: formula.id };
        }
    }

    return null;
}

/**
 * Topological order: dependencies before dependents. Stable for unrelated nodes
 * (preserves relative input order among independent formulas).
 */
export function topologicalSortFormulas(
    formulas: ReportFormula[]
): ReportFormula[] {
    if (formulas.length <= 1) {
        return [...formulas];
    }

    const byId = new Map(formulas.map((f) => [f.id, f]));
    const dependencyMap = buildFormulaDependencyMap(formulas);
    const indegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();

    for (const formula of formulas) {
        indegree.set(formula.id, 0);
        dependents.set(formula.id, []);
    }

    for (const formula of formulas) {
        for (const depId of dependencyMap.get(formula.id) || []) {
            if (!byId.has(depId)) {
                continue;
            }
            indegree.set(formula.id, (indegree.get(formula.id) || 0) + 1);
            dependents.get(depId)!.push(formula.id);
        }
    }

    const queue: string[] = [];
    for (const formula of formulas) {
        if ((indegree.get(formula.id) || 0) === 0) {
            queue.push(formula.id);
        }
    }

    const ordered: ReportFormula[] = [];
    while (queue.length > 0) {
        const id = queue.shift()!;
        const formula = byId.get(id);
        if (formula) {
            ordered.push(formula);
        }
        for (const dependentId of dependents.get(id) || []) {
            const next = (indegree.get(dependentId) || 0) - 1;
            indegree.set(dependentId, next);
            if (next === 0) {
                queue.push(dependentId);
            }
        }
    }

    // Cycle fallback: append remaining in original order (validation should reject).
    if (ordered.length < formulas.length) {
        const seen = new Set(ordered.map((f) => f.id));
        for (const formula of formulas) {
            if (!seen.has(formula.id)) {
                ordered.push(formula);
            }
        }
    }

    return ordered;
}
