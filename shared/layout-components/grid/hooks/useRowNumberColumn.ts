import { useMemo } from "react";
import { GridColDef } from "@mui/x-data-grid";

/**
 * Hook to create row number column definition
 */
export const useRowNumberColumn = (): GridColDef => {
    return useMemo(
        () => ({
            field: "__rowNumber",
            headerName: "#",
            width: 40,
            minWidth: 40,
            maxWidth: 40,
            sortable: false,
            resizable: false,
            disableColumnMenu: true,
            align: "center",
            headerAlign: "center",
        }),
        []
    );
};
