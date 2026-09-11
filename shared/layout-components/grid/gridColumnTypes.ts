import type { ReactNode } from "react";

/**
 * Local grid column/sort/cell types used by EndlessScrollDataGrid.
 * Shapes match existing call sites (legacy valueGetter params object).
 */

export type GridSortDirection = "asc" | "desc" | null | undefined;

export interface GridSortItem {
    field: string;
    sort: GridSortDirection;
}

export type GridSortModel = GridSortItem[];

export type GridAlignment = "left" | "right" | "center";

/** Params passed to renderCell (and our partial casts). */
export interface GridRenderCellParams<R = any, V = any> {
    row: R;
    value?: V;
    field: string;
    id?: string | number;
}

/** Legacy valueGetter params used across column generators. */
export interface GridValueGetterParams<R = any, V = any> {
    row: R;
    value: V;
    field: string;
}

export interface GridColDef<R = any, V = any> {
    field: string;
    headerName?: string;
    description?: string;
    width?: number;
    flex?: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    resizable?: boolean;
    hideable?: boolean;
    editable?: boolean;
    filterable?: boolean;
    type?: string;
    align?: GridAlignment;
    headerAlign?: GridAlignment;
    disableColumnMenu?: boolean;
    disableExport?: boolean;
    hideSortIcons?: boolean;
    /** Legacy visibility flag from older MUI column defs. */
    hide?: boolean;
    valueGetter?: (params: GridValueGetterParams<R, V>) => any;
    valueFormatter?: (params: any) => any;
    sortComparator?: (v1: V, v2: V) => number;
    renderCell?: (params: GridRenderCellParams<R, V>) => ReactNode;
    renderHeader?: (params: any) => ReactNode;
}
