"use client";

import React, {
    forwardRef,
    useCallback,
    useImperativeHandle,
    useMemo,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import FormulaUpsertModal from "@/components/reports/FormulaUpsertModal";
import type { ReportConfig } from "@/server/services/ReportService";
import {
    findFormulasDependingOnField,
    getFormulaOperandReference,
    isFormulaOperandFieldType,
    resolveReportColumnOrder,
} from "@/shared/reportFormula/columnOrder";
import {
    getFormulaOutputKey,
    MAX_FORMULAS_PER_REPORT,
    type ReportFormula,
} from "@/shared/reportFormula/types";
import DeleteDialog from "@/shared/layout-components/modal/DeleteDialog";
import type { Field } from "@/utils/reportTableUtils";

interface FormulaColumnEditorProps {
    reportConfig: ReportConfig;
    onConfigChange: (patch: Partial<ReportConfig>) => void;
    tablesMetadata: Array<{
        name: string;
        label?: string;
        fields: Array<{
            name: string;
            type: string;
            label?: string;
            translationKey?: string;
            translationNamespace?: string;
        }>;
    }>;
}

export interface FormulaColumnEditorHandle {
    openAdd: () => void;
    openEdit: (formulaId: string) => void;
    requestDelete: (formulaId: string) => void;
}

export function getNumericOperandOptions(
    tableNames: string[],
    tablesMetadata: FormulaColumnEditorProps["tablesMetadata"],
    t?: (key: string, options?: Record<string, unknown>) => string
): Array<{ reference: string; label: string; outputKey: string }> {
    const options: Array<{ reference: string; label: string; outputKey: string }> =
        [];
    for (const tableName of tableNames) {
        const tableMeta = tablesMetadata.find((tm) => tm.name === tableName);
        if (!tableMeta) {
            continue;
        }
        for (const fieldMeta of tableMeta.fields) {
            if (!isFormulaOperandFieldType(fieldMeta.type)) {
                continue;
            }
            const reference = `${tableName}.${fieldMeta.name}`;
            let label = fieldMeta.label || `${tableName}.${fieldMeta.name}`;
            if (t && fieldMeta.translationKey && fieldMeta.translationNamespace) {
                const translated = t(`fields.${fieldMeta.translationKey}`, {
                    ns: fieldMeta.translationNamespace,
                    defaultValue: "",
                });
                if (translated && translated.trim() !== "") {
                    label = translated;
                }
            }
            options.push({
                reference,
                label,
                outputKey: reference,
            });
        }
    }
    return options;
}

const FormulaColumnEditor = forwardRef<
    FormulaColumnEditorHandle,
    FormulaColumnEditorProps
>(function FormulaColumnEditor(
    { reportConfig, onConfigChange, tablesMetadata },
    ref
) {
    const { t, i18n } = useTranslation(["reports", "common"]);
    const [modalOpen, setModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"add" | "edit">("add");
    const [editingFormula, setEditingFormula] = useState<ReportFormula | null>(
        null
    );
    const [formulaPendingDelete, setFormulaPendingDelete] =
        useState<ReportFormula | null>(null);

    const formulas = reportConfig.formulas || [];
    const selectedFields = reportConfig.fields || [];
    const reportTableNames = reportConfig.tables || [];
    const isGrouped =
        (reportConfig.grouping?.length ?? 0) > 0 ||
        selectedFields.some((f) => !!f.aggregation);

    const operandOptions = useMemo(
        () => getNumericOperandOptions(reportTableNames, tablesMetadata, t),
        [reportTableNames, tablesMetadata, t]
    );

    const TABLE_TRANSLATION_KEY: Record<string, string> = {
        Customer: "tables.customers",
        Invoice: "tables.invoices",
        Dispute: "tables.disputes",
        Activity: "tables.activities",
        Payment: "tables.payments",
        InvoicePayment: "tables.invoice_payments",
        CustomerCollectionPeriod: "tables.collection_periods",
        Contact: "tables.contacts",
        Company: "tables.companies",
    };

    const tableOptions = useMemo(() => {
        const tableNames = new Set(
            operandOptions.map((o) => o.reference.split(".")[0])
        );
        return tablesMetadata
            .filter((table) => tableNames.has(table.name))
            .map((table) => {
                const key = TABLE_TRANSLATION_KEY[table.name];
                const translated = key
                    ? t(key, { ns: "reports", defaultValue: "" })
                    : "";
                return {
                    name: table.name,
                    label:
                        translated && translated !== key
                            ? translated
                            : table.label || table.name,
                };
            });
    }, [operandOptions, tablesMetadata, t]);

    const defaultLabel = t("formulas.default_label", {
        n: formulas.length + 1,
        defaultValue: `Formula ${formulas.length + 1}`,
    });

    const closeModal = useCallback(() => {
        setModalOpen(false);
        setEditingFormula(null);
    }, []);

    const openAdd = useCallback(() => {
        if (formulas.length >= MAX_FORMULAS_PER_REPORT) {
            return;
        }
        setModalMode("add");
        setEditingFormula(null);
        setModalOpen(true);
    }, [formulas.length]);

    const openEdit = useCallback(
        (formulaId: string) => {
            const formula = formulas.find((entry) => entry.id === formulaId);
            if (!formula) {
                return;
            }
            setModalMode("edit");
            setEditingFormula(formula);
            setModalOpen(true);
        },
        [formulas]
    );

    const requestDelete = useCallback(
        (formulaId: string) => {
            const formula = formulas.find((entry) => entry.id === formulaId);
            if (formula) {
                setFormulaPendingDelete(formula);
            }
        },
        [formulas]
    );

    useImperativeHandle(
        ref,
        () => ({ openAdd, openEdit, requestDelete }),
        [openAdd, openEdit, requestDelete]
    );

    const handleSave = (formula: ReportFormula) => {
        const nextFormulas =
            modalMode === "add"
                ? [...formulas, formula]
                : formulas.map((f) => (f.id === formula.id ? formula : f));
        const columnOrder = resolveReportColumnOrder(
            selectedFields,
            nextFormulas,
            reportConfig.columnOrder
        );
        onConfigChange({ formulas: nextFormulas, columnOrder });
    };

    const removeFormula = (id: string) => {
        const nextFormulas = formulas.filter((f) => f.id !== id);
        const columnOrder = resolveReportColumnOrder(
            selectedFields,
            nextFormulas,
            reportConfig.columnOrder
        ).filter((k) => k !== getFormulaOutputKey(id));
        onConfigChange({ formulas: nextFormulas, columnOrder });
        if (editingFormula?.id === id) {
            closeModal();
        }
    };

    const handleConfirmDelete = () => {
        if (formulaPendingDelete) {
            removeFormula(formulaPendingDelete.id);
        }
        setFormulaPendingDelete(null);
    };

    return (
        <>
            <FormulaUpsertModal
                open={modalOpen}
                mode={modalMode}
                editingId={editingFormula?.id ?? null}
                initialFormula={editingFormula}
                defaultLabel={defaultLabel}
                existingFormulas={formulas}
                operandOptions={operandOptions}
                reportTableNames={reportTableNames}
                tableOptions={tableOptions}
                tablesMetadata={tablesMetadata}
                isGrouped={isGrouped}
                onClose={closeModal}
                onSave={handleSave}
            />

            <DeleteDialog
                isOpen={!!formulaPendingDelete}
                onClose={() => setFormulaPendingDelete(null)}
                onConfirm={handleConfirmDelete}
                title={t("formulas.delete_title", {
                    defaultValue: "Delete formula",
                })}
                description={
                    formulaPendingDelete
                        ? t("formulas.delete_confirm", {
                              label: formulaPendingDelete.label,
                              defaultValue: `Are you sure you want to delete "${formulaPendingDelete.label}"?`,
                          })
                        : ""
                }
                confirmLabel={t("actions.delete", { ns: "common" })}
                cancelLabel={t("actions.cancel", { ns: "common" })}
                type="delete"
                locale={i18n.language}
            />
        </>
    );
});

export function blockFieldRemovalForFormulas(
    field: Field,
    formulas: ReportFormula[] = []
): { blocked: boolean; dependentLabels: string[] } {
    const ref = getFormulaOperandReference(field);
    const dependents = findFormulasDependingOnField(formulas, ref);
    return {
        blocked: dependents.length > 0,
        dependentLabels: dependents.map((f) => f.label),
    };
}

export default FormulaColumnEditor;
