import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { DragStartEvent, DragEndEvent } from "@dnd-kit/core";
import { TableField, Table, isNumericField } from "@/utils/reportFieldUtils";
import {
    buildColumnListItems,
    insertKeyIntoColumnOrder,
    removeKeyFromColumnOrder,
    reorderColumnOrder,
    resolveReportColumnOrder,
    syncFieldsOrderFromColumnOrder,
    type ColumnListItem,
} from "@/shared/reportFormula/columnOrder";
import { isFormulaOutputKey, type ReportFormula } from "@/shared/reportFormula/types";
import {
    Field,
    getFieldOutputKey,
    resolveNextPaletteFieldCandidate,
} from "@/utils/reportTableUtils";

interface UnifiedColumnOrderConfig {
    columnOrder: string[];
    formulas: ReportFormula[];
    onColumnOrderChange: (order: string[], fields?: Field[]) => void;
}

interface UseDragDropFieldsProps {
    selectedFields: Field[];
    onFieldsChange: (fields: Field[]) => void;
    tables: Table[];
    getTableFields: (tableName: string) => TableField[];
    selectedFieldKeys: Set<string>;
    canAddFieldFromTable: (tableName: string) => boolean;
    unified?: UnifiedColumnOrderConfig;
}

function isLegacyCanvasItemId(id: string): boolean {
    return id.includes("-") && !isFormulaOutputKey(id);
}

function parseDropBetweenIndex(overId: string): number | null {
    if (!overId.startsWith("drop-between-")) {
        return null;
    }
    const index = parseInt(overId.replace("drop-between-", ""), 10);
    return Number.isNaN(index) ? null : index;
}

export const useDragDropFields = ({
    selectedFields,
    onFieldsChange,
    tables,
    getTableFields,
    selectedFieldKeys,
    canAddFieldFromTable,
    unified,
}: UseDragDropFieldsProps) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [draggedField, setDraggedField] = useState<{
        field: TableField;
        tableName: string;
        tableLabel: string;
    } | null>(null);
    const [draggedFormulaLabel, setDraggedFormulaLabel] = useState<string | null>(
        null
    );
    const [isOver, setIsOver] = useState(false);
    const [hoveredFieldId, setHoveredFieldId] = useState<string | null>(null);
    const [insertIndex, setInsertIndex] = useState<number | null>(null);
    const [dragStartX, setDragStartX] = useState<number | null>(null);
    const [currentMouseX, setCurrentMouseX] = useState<number | null>(null);
    const currentMouseXRef = useRef<number | null>(null);

    const columnListItems = useMemo<ColumnListItem[]>(() => {
        if (!unified) {
            return [];
        }
        return buildColumnListItems(
            selectedFields,
            unified.formulas,
            unified.columnOrder
        );
    }, [unified, selectedFields]);

    const resolvedColumnOrder = useMemo(() => {
        if (!unified) {
            return [];
        }
        return resolveReportColumnOrder(
            selectedFields,
            unified.formulas,
            unified.columnOrder
        );
    }, [unified, selectedFields]);

    const isUnified = !!unified;

    const isCanvasItemId = useCallback(
        (id: string) => {
            if (isUnified) {
                return (
                    isFormulaOutputKey(id) ||
                    columnListItems.some((item) => item.outputKey === id)
                );
            }
            return isLegacyCanvasItemId(id);
        },
        [isUnified, columnListItems]
    );

    useEffect(() => {
        if (activeId && dragStartX !== null) {
            const handleMouseMove = (e: MouseEvent) => {
                const x = e.clientX;
                currentMouseXRef.current = x;
                setCurrentMouseX(x);
            };

            window.addEventListener("mousemove", handleMouseMove);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                currentMouseXRef.current = null;
            };
        } else {
            setCurrentMouseX(null);
            currentMouseXRef.current = null;
        }
    }, [activeId, dragStartX]);

    const parseFieldId = useCallback((id: string) => {
        const firstDotIndex = id.indexOf(".");
        if (firstDotIndex === -1) return { tableName: id, fieldName: "" };
        return {
            tableName: id.substring(0, firstDotIndex),
            fieldName: id.substring(firstDotIndex + 1),
        };
    }, []);

    const findLegacyCanvasIndex = useCallback(
        (id: string) =>
            selectedFields.findIndex(
                (f, i) => `${f.table}.${f.field}-${i}` === id
            ),
        [selectedFields]
    );

    const findUnifiedCanvasIndex = useCallback(
        (id: string) =>
            columnListItems.findIndex((item) => item.outputKey === id),
        [columnListItems]
    );

    const setDragPreviewForCanvasItem = useCallback(
        (id: string) => {
            if (isUnified) {
                const item = columnListItems.find((entry) => entry.outputKey === id);
                if (!item) {
                    return;
                }
                if (item.kind === "formula") {
                    setDraggedFormulaLabel(item.formula.label);
                    setDraggedField(null);
                    return;
                }
                const { tableName, fieldName } = {
                    tableName: item.field.table,
                    fieldName: item.field.field,
                };
                const table = tables.find((t) => t.name === tableName);
                const field = getTableFields(tableName).find(
                    (f) => f.name === fieldName
                );
                if (table && field) {
                    setDraggedField({
                        field,
                        tableName,
                        tableLabel: table.label,
                    });
                    setDraggedFormulaLabel(null);
                }
                return;
            }

            const lastDashIndex = id.lastIndexOf("-");
            const idWithoutIndex = id.substring(0, lastDashIndex);
            const { tableName, fieldName } = parseFieldId(idWithoutIndex);
            const table = tables.find((t) => t.name === tableName);
            const field = getTableFields(tableName).find(
                (f) => f.name === fieldName
            );
            if (table && field) {
                setDraggedField({
                    field,
                    tableName,
                    tableLabel: table.label,
                });
                setDraggedFormulaLabel(null);
            }
        },
        [columnListItems, getTableFields, isUnified, parseFieldId, tables]
    );

    const handleDragStart = useCallback(
        (event: DragStartEvent) => {
            setActiveId(event.active.id as string);
            const activeIdStr = event.active.id as string;

            if (event.activatorEvent && "clientX" in event.activatorEvent) {
                const startX = (event.activatorEvent as MouseEvent).clientX;
                setDragStartX(startX);
                setCurrentMouseX(startX);
                currentMouseXRef.current = startX;
            } else {
                setDragStartX(null);
                setCurrentMouseX(null);
                currentMouseXRef.current = null;
            }

            if (isCanvasItemId(activeIdStr)) {
                setDragPreviewForCanvasItem(activeIdStr);
                return;
            }

            const { tableName, fieldName } = parseFieldId(activeIdStr);
            const table = tables.find((t) => t.name === tableName);
            const field = getTableFields(tableName).find(
                (f) => f.name === fieldName
            );
            if (table && field) {
                setDraggedField({
                    field,
                    tableName,
                    tableLabel: table.label,
                });
                setDraggedFormulaLabel(null);
            }
        },
        [
            getTableFields,
            isCanvasItemId,
            parseFieldId,
            setDragPreviewForCanvasItem,
            tables,
        ]
    );

    const resetDragState = useCallback(() => {
        setActiveId(null);
        setDraggedField(null);
        setDraggedFormulaLabel(null);
        setIsOver(false);
        setHoveredFieldId(null);
        setInsertIndex(null);
        setDragStartX(null);
        setCurrentMouseX(null);
        currentMouseXRef.current = null;
    }, []);

    const applyUnifiedColumnOrder = useCallback(
        (nextOrder: string[], nextFields?: Field[]) => {
            if (!unified) {
                return;
            }
            if (nextFields) {
                unified.onColumnOrderChange(nextOrder, nextFields);
                return;
            }
            const synced = syncFieldsOrderFromColumnOrder(
                selectedFields,
                nextOrder
            );
            unified.onColumnOrderChange(nextOrder, synced);
        },
        [selectedFields, unified]
    );

    const handleDragEnd = useCallback(
        (event: DragEndEvent) => {
            const { active, over } = event;
            const activeIdStr = active.id.toString();

            if (isCanvasItemId(activeIdStr)) {
                const isValidDropTarget =
                    over &&
                    (over.id === "fields-area" ||
                        over.id === "drop-before-first" ||
                        over.id === "drop-after-last" ||
                        (typeof over.id === "string" &&
                            (over.id.startsWith("drop-between-") ||
                                isCanvasItemId(over.id))));

                if (!isValidDropTarget) {
                    if (isUnified) {
                        const item = columnListItems.find(
                            (entry) => entry.outputKey === activeIdStr
                        );
                        if (item?.kind === "field") {
                            const nextFields = selectedFields.filter(
                                (_, i) => i !== item.fieldIndex
                            );
                            const nextOrder = removeKeyFromColumnOrder(
                                resolvedColumnOrder,
                                item.outputKey
                            );
                            unified!.onColumnOrderChange(nextOrder, nextFields);
                        }
                    } else if (isLegacyCanvasItemId(activeIdStr)) {
                        const activeIndex = findLegacyCanvasIndex(activeIdStr);
                        if (activeIndex !== -1) {
                            onFieldsChange(
                                selectedFields.filter((_, i) => i !== activeIndex)
                            );
                        }
                    }
                    resetDragState();
                    return;
                }
            }

            resetDragState();

            if (!over) {
                setInsertIndex(null);
                return;
            }

            const overId = String(over.id);
            let targetIndex: number | null = insertIndex;

            if (over.id === "drop-before-first") {
                targetIndex = 0;
            } else if (over.id === "drop-after-last") {
                targetIndex = isUnified
                    ? columnListItems.length
                    : selectedFields.length;
            } else if (
                typeof over.id === "string" &&
                over.id.startsWith("drop-between-")
            ) {
                const betweenIndex = parseDropBetweenIndex(over.id);
                if (betweenIndex !== null) {
                    targetIndex = betweenIndex;
                }
            }

            if (isCanvasItemId(activeIdStr)) {
                const activeIndex = isUnified
                    ? findUnifiedCanvasIndex(activeIdStr)
                    : findLegacyCanvasIndex(activeIdStr);

                if (activeIndex !== -1) {
                    if (targetIndex === null && isCanvasItemId(overId)) {
                        const overIndex = isUnified
                            ? findUnifiedCanvasIndex(overId)
                            : findLegacyCanvasIndex(overId);
                        if (overIndex !== -1) {
                            targetIndex =
                                overIndex >= activeIndex
                                    ? overIndex + 1
                                    : overIndex;
                        }
                    }

                    if (targetIndex !== null && targetIndex !== activeIndex) {
                        if (isUnified) {
                            const nextOrder = reorderColumnOrder(
                                resolvedColumnOrder,
                                activeIndex,
                                targetIndex
                            );
                            applyUnifiedColumnOrder(nextOrder);
                        } else {
                            const adjustedTarget =
                                targetIndex > activeIndex
                                    ? targetIndex - 1
                                    : targetIndex;
                            const newFields = [...selectedFields];
                            const [removed] = newFields.splice(activeIndex, 1);
                            newFields.splice(adjustedTarget, 0, removed);
                            onFieldsChange(newFields);
                        }
                        setInsertIndex(null);
                        return;
                    }
                }
            }

            if (!isCanvasItemId(activeIdStr)) {
                const firstDotIndex = activeIdStr.indexOf(".");
                if (firstDotIndex === -1) {
                    setInsertIndex(null);
                    return;
                }

                const tableName = activeIdStr.substring(0, firstDotIndex);
                const fieldName = activeIdStr.substring(firstDotIndex + 1);

                if (!canAddFieldFromTable(tableName)) {
                    setInsertIndex(null);
                    return;
                }

                const table = tables.find((t) => t.name === tableName);
                const field = getTableFields(tableName).find(
                    (f) => f.name === fieldName
                );
                if (table && field) {
                    const baseField: Field = {
                        table: tableName,
                        field: fieldName,
                    };
                    let newField: Field = baseField;
                    if (selectedFieldKeys.has(getFieldOutputKey(baseField))) {
                        if (!isNumericField(field.type)) {
                            setInsertIndex(null);
                            return;
                        }
                        const chosen = resolveNextPaletteFieldCandidate(
                            baseField,
                            field.type,
                            selectedFieldKeys
                        );
                        if (!chosen) {
                            setInsertIndex(null);
                            return;
                        }
                        newField = chosen;
                    }

                    const outputKey = getFieldOutputKey(newField);
                    if (isUnified) {
                        const nextFields = [...selectedFields, newField];
                        const insertAt =
                            targetIndex !== null && targetIndex >= 0
                                ? targetIndex
                                : resolvedColumnOrder.length;
                        const nextOrder = insertKeyIntoColumnOrder(
                            resolvedColumnOrder,
                            outputKey,
                            insertAt
                        );
                        applyUnifiedColumnOrder(nextOrder, nextFields);
                    } else if (targetIndex !== null && targetIndex >= 0) {
                        const newFields = [...selectedFields];
                        newFields.splice(targetIndex, 0, newField);
                        onFieldsChange(newFields);
                    } else {
                        onFieldsChange([...selectedFields, newField]);
                    }
                }
            }

            setInsertIndex(null);
        },
        [
            applyUnifiedColumnOrder,
            canAddFieldFromTable,
            columnListItems,
            findLegacyCanvasIndex,
            findUnifiedCanvasIndex,
            getTableFields,
            insertIndex,
            isCanvasItemId,
            isUnified,
            onFieldsChange,
            resetDragState,
            resolvedColumnOrder,
            selectedFieldKeys,
            selectedFields,
            tables,
            unified,
        ]
    );

    const computeInsertIndexFromHover = useCallback(
        (overId: string, overIndex: number) => {
            const overElement = document.querySelector(`[data-id="${overId}"]`);
            const currentX = currentMouseXRef.current;
            const startX = dragStartX;

            if (overElement && startX !== null && currentX !== null) {
                const dragDistance = currentX - startX;
                if (dragDistance < 0) {
                    return overIndex;
                }
                if (dragDistance > 0) {
                    return overIndex + 1;
                }
                const rect = overElement.getBoundingClientRect();
                const fieldCenterX = rect.left + rect.width / 2;
                return startX < fieldCenterX ? overIndex : overIndex + 1;
            }
            if (overElement && startX !== null) {
                const rect = overElement.getBoundingClientRect();
                const fieldCenterX = rect.left + rect.width / 2;
                return startX < fieldCenterX ? overIndex : overIndex + 1;
            }
            if (overElement && currentX !== null) {
                const rect = overElement.getBoundingClientRect();
                const fieldCenterX = rect.left + rect.width / 2;
                return currentX < fieldCenterX ? overIndex : overIndex + 1;
            }
            return overIndex + 1;
        },
        [dragStartX]
    );

    const handleDragOver = useCallback(
        (event: any) => {
            let newInsertIndex: number | null = null;

            if (event.over?.id === "fields-area") {
                setIsOver(true);
                setHoveredFieldId(null);
                newInsertIndex = null;
            } else if (event.over?.id && typeof event.over.id === "string") {
                if (event.over.id === "drop-before-first") {
                    setIsOver(false);
                    setHoveredFieldId(null);
                    newInsertIndex = 0;
                } else if (event.over.id === "drop-after-last") {
                    setIsOver(false);
                    setHoveredFieldId(null);
                    newInsertIndex = isUnified
                        ? columnListItems.length
                        : selectedFields.length;
                } else if (event.over.id.startsWith("drop-between-")) {
                    setIsOver(false);
                    setHoveredFieldId(null);
                    newInsertIndex = parseDropBetweenIndex(event.over.id);
                } else if (
                    isUnified &&
                    isCanvasItemId(event.over.id as string)
                ) {
                    setIsOver(false);
                    setHoveredFieldId(event.over.id as string);
                    const overIndex = findUnifiedCanvasIndex(
                        event.over.id as string
                    );
                    if (overIndex !== -1 && activeId) {
                        newInsertIndex = computeInsertIndexFromHover(
                            event.over.id as string,
                            overIndex
                        );
                    } else {
                        newInsertIndex = null;
                    }
                } else if (isLegacyCanvasItemId(event.over.id)) {
                    setIsOver(false);
                    setHoveredFieldId(event.over.id);
                    const overIndex = findLegacyCanvasIndex(event.over.id);
                    if (overIndex !== -1 && activeId) {
                        newInsertIndex = computeInsertIndexFromHover(
                            event.over.id,
                            overIndex
                        );
                    } else {
                        newInsertIndex = null;
                    }
                } else {
                    setIsOver(false);
                    setHoveredFieldId(null);
                    newInsertIndex = null;
                }
            } else {
                setIsOver(false);
                setHoveredFieldId(null);
                newInsertIndex = null;
            }

            setInsertIndex(newInsertIndex);
        },
        [
            activeId,
            columnListItems.length,
            computeInsertIndexFromHover,
            findLegacyCanvasIndex,
            findUnifiedCanvasIndex,
            isCanvasItemId,
            isUnified,
            selectedFields.length,
        ]
    );

    return {
        activeId,
        draggedField,
        draggedFormulaLabel,
        isOver,
        hoveredFieldId,
        insertIndex,
        columnListItems,
        resolvedColumnOrder,
        isUnified,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        resetDragState,
    };
};
