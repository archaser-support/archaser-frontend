import { Box, Checkbox } from "@mui/material";
import { Theme } from "@mui/material/styles";
import { GridColDef, GridRenderCellParams } from "@mui/x-data-grid";

interface CreateCheckboxColumnOptions {
    selectedRows: number[];
    onSelectionChange: (id: number, checked: boolean) => void;
    onRangeSelection?: (rowIds: number[]) => void; // For shift+click range selection
    rows?: any[]; // All rows for range calculation
    enableMultiSelect?: boolean; // Enable shift+click
    theme: Theme;
}

// Module-level storage for latest values to avoid stale closures
// Use a single global store since there's typically only one checkbox column per grid
let globalLatestValues: {
    selectedRows: number[];
    onSelectionChange: (id: number, checked: boolean) => void;
    onRangeSelection?: (rowIds: number[]) => void;
    rows?: any[];
    enableMultiSelect?: boolean;
} | null = null;

// Track last clicked row index for shift+click range selection
let lastClickedRowIndexRef: number | null = null;

/**
 * Create a reusable checkbox column definition
 */
export function createCheckboxColumn(
    options: CreateCheckboxColumnOptions
): GridColDef {
    const { selectedRows, onSelectionChange, onRangeSelection, rows, enableMultiSelect, theme } = options;
    
    // Create a stable key based on selectedRows to force re-render when selection changes
    // Don't mutate the original array - create a copy for sorting
    const selectionKey = [...selectedRows].sort((a, b) => a - b).join(',');
    
    // Update global store with latest values - this ensures onChange handlers always read current state
    globalLatestValues = {
        selectedRows: [...selectedRows], // Create a copy to avoid reference issues
        onSelectionChange: onSelectionChange,
        onRangeSelection: onRangeSelection,
        rows: rows,
        enableMultiSelect: enableMultiSelect,
    };

    return {
        field: "checkbox",
        headerName: "",
        width: 60,
        minWidth: 60,
        maxWidth: 60,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        resizable: false,
        renderCell: (params: GridRenderCellParams) => {
            // Read selection state from global store or closure
            // Priority: globalStore > closure
            const globalStoreSelectedRows = globalLatestValues?.selectedRows;
            const closureSelectedRows = selectedRows;
            const latestSelectedRows = globalStoreSelectedRows || closureSelectedRows;
            
            const isChecked = latestSelectedRows.includes(params.row.id);
            
            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        width: "100%",
                        cursor: "default",
                        // CRITICAL: Override parent's pointerEvents: "none" to allow checkbox to receive clicks
                        pointerEvents: "auto",
                    }}
                >
                    <Checkbox
                        checked={isChecked}
                        onChange={(e, checked) => {
                            // Read current selection state from global store or closure
                            const globalStoreSelectedRows = globalLatestValues?.selectedRows;
                            const closureSelectedRows = selectedRows;
                            const latestSelectedRows = globalStoreSelectedRows || closureSelectedRows;
                            const currentOnSelectionChange = globalLatestValues?.onSelectionChange || onSelectionChange;
                            const currentOnRangeSelection = globalLatestValues?.onRangeSelection || onRangeSelection;
                            const currentRows = globalLatestValues?.rows || rows;
                            const isMultiSelectEnabled = globalLatestValues?.enableMultiSelect || enableMultiSelect;
                            
                            // Check if shift key is pressed for range selection
                            const isShiftPressed = (e.nativeEvent as MouseEvent)?.shiftKey || false;
                            
                            e.stopPropagation();
                            
                            // Handle shift+click range selection
                            if (isShiftPressed && isMultiSelectEnabled && currentRows && lastClickedRowIndexRef !== null && currentOnRangeSelection) {
                                // Find current row index
                                const currentRowIndex = currentRows.findIndex(r => r.id === params.row.id);
                                
                                if (currentRowIndex !== -1) {
                                    // Calculate range
                                    const startIndex = Math.min(lastClickedRowIndexRef, currentRowIndex);
                                    const endIndex = Math.max(lastClickedRowIndexRef, currentRowIndex);
                                    
                                    // Get all row IDs in the range
                                    const rangeIds: number[] = [];
                                    for (let i = startIndex; i <= endIndex; i++) {
                                        if (i < currentRows.length && currentRows[i]?.id !== undefined) {
                                            rangeIds.push(Number(currentRows[i].id));
                                        }
                                    }
                                    
                                    // Call range selection handler
                                    currentOnRangeSelection(rangeIds);
                                    
                                    // Update last clicked index
                                    lastClickedRowIndexRef = currentRowIndex;
                                    return;
                                }
                            }
                            
                            // Normal single selection
                            // If there's a range selection (multiple rows selected) and we're clicking without shift,
                            // clear the selection and select only this checkbox
                            const hasRangeSelection = latestSelectedRows.length > 1;
                            const shouldClearRange = hasRangeSelection && !isShiftPressed;
                            
                            // If we need to clear range and select only this checkbox, use range selection handler
                            if (shouldClearRange && currentOnRangeSelection && checked) {
                                currentOnRangeSelection([params.row.id]);
                            } else {
                                // Normal toggle behavior
                                currentOnSelectionChange(params.row.id, checked);
                            }
                            
                            // Update last clicked row index for future shift+click
                            if (currentRows) {
                                const currentRowIndex = currentRows.findIndex(r => r.id === params.row.id);
                                if (currentRowIndex !== -1) {
                                    lastClickedRowIndexRef = currentRowIndex;
                                }
                            }
                        }}
                        onClick={(e) => {
                            // Stop propagation on the checkbox itself to prevent row selection
                            e.stopPropagation();
                        }}
                        onMouseDown={(e) => {
                            // Stop propagation on mousedown to prevent row selection
                            e.stopPropagation();
                        }}
                    sx={{
                        padding: 0,
                        color: theme.palette.primary.main,
                        "&.Mui-checked": {
                            color: theme.palette.primary.main,
                        },
                        "&.MuiCheckbox-indeterminate": {
                            color: theme.palette.primary.main,
                        },
                        "& .MuiSvgIcon-root": {
                            fontSize: theme.spacing(2.5),
                        },
                        "&:hover": {
                            backgroundColor: theme.palette.action.hover,
                        },
                    }}
                />
            </Box>
            );
        },
    };
}
