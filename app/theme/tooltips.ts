import type { CSSProperties } from "react";

function rtlDirection(isRTL: boolean): CSSProperties["direction"] {
    return isRTL ? "rtl" : "ltr";
}

function rtlTextAlign(isRTL: boolean): CSSProperties["textAlign"] {
    return isRTL ? "right" : "left";
}

export const customTooltip = {
    container: {
        background: "white",
        border: "1px solid #DCE3EB",
        borderRadius: "4px",
        padding: "8px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        fontSize: "12px",
        fontFamily: "inherit",
    },
    header: {
        fontWeight: 700,
        color: "#2F3B52",
        marginBottom: "6px",
        borderBottom: "1px solid #DCE3EB",
        paddingBottom: "4px",
    },
    row: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "4px",
        gap: "16px",
    },
    label: {
        fontWeight: 600,
        color: "#2F3B52",
    },
    value: {
        fontWeight: 500,
    },
};

export const rtlTooltip = {
    container: (isRTL: boolean): CSSProperties => ({
        maxWidth: 320,
        padding: "12px 16px",
        direction: rtlDirection(isRTL),
        textAlign: rtlTextAlign(isRTL),
    }),
    header: (isRTL: boolean): CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "12px",
        direction: rtlDirection(isRTL),
        justifyContent: isRTL ? "flex-end" : "flex-start",
    }),
    section: (isRTL: boolean): CSSProperties => ({
        marginBottom: "12px",
        direction: rtlDirection(isRTL),
        textAlign: rtlTextAlign(isRTL),
    }),
    label: (isRTL: boolean): CSSProperties => ({
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "4px",
        direction: rtlDirection(isRTL),
        justifyContent: isRTL ? "flex-end" : "flex-start",
    }),
    text: (isRTL: boolean): CSSProperties => ({
        direction: rtlDirection(isRTL),
        textAlign: rtlTextAlign(isRTL),
    }),
};
