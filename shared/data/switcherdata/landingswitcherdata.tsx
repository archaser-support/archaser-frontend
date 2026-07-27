import { useState } from "react";

import store from "@/shared/redux/store";

export function Dark(actionfunction: any) {
    const theme = store.getState();
    actionfunction({
        ...theme,
        class: "dark",
        dataHeaderStyles: "dark",
        dataMenuStyles: "dark",
    });
    localStorage.setItem("ynexdarktheme", "dark");
    localStorage.removeItem("ynexlighttheme");
}
export function Light(actionfunction: any) {
    const theme = store.getState();
    actionfunction({
        ...theme,
        class: "light",
        dataHeaderStyles: "light",
        bodyBg: "",
        darkBg: "",
        inputBorder: "",
        Light: "",
        dataMenuStyles: theme.dataNavLayout == "horizontal" ? "" : "dark",
    });
    localStorage.setItem("ynexlighttheme", "light");
    localStorage.removeItem("bodyBgRGB");
    localStorage.removeItem("primaryRGB");
    localStorage.removeItem("primaryRGB1");
    localStorage.removeItem("inputBorder");
    localStorage.removeItem("Light");
}

export function Ltr(actionfunction: any) {
    const theme = store.getState();
    actionfunction({
        ...theme,
        dir: "ltr",
    });
    localStorage.removeItem("ynexrtl");
}
export function Rtl(actionfunction: any) {
    const theme = store.getState();
    actionfunction({
        ...theme,
        dir: "rtl",
    });
    localStorage.setItem("ynexrtl", "rtl");
}

// Unified primary color function to replace the five redundant functions
export const setPrimaryColor = (
    actionfunction: any,
    colorConfig: {
        rgb: string;
        hex?: string;
        name?: string;
    }
) => {
    const theme = store.getState();
    actionfunction({
        ...theme,
        colorPrimaryRgb: colorConfig.rgb,
        colorPrimary: colorConfig.rgb,
        type: undefined,
    });
    localStorage.setItem("primaryRGB", colorConfig.rgb);
    localStorage.setItem("primaryRGB1", colorConfig.rgb);
};

// Predefined color configurations
export const PRIMARY_COLORS = {
    BLUE: { rgb: "58, 88, 146", name: "Blue" },
    TEAL: { rgb: "92, 144, 163", name: "Teal" },
    PURPLE: { rgb: "161, 90, 223", name: "Purple" },
    GREEN: { rgb: "78, 172, 76", name: "Green" },
    RED: { rgb: "223, 90, 90", name: "Red" },
} as const;

// Legacy function aliases for backward compatibility
export const primaryColor1 = (actionfunction: any) =>
    setPrimaryColor(actionfunction, PRIMARY_COLORS.BLUE);
export const primaryColor2 = (actionfunction: any) =>
    setPrimaryColor(actionfunction, PRIMARY_COLORS.TEAL);
export const primaryColor3 = (actionfunction: any) =>
    setPrimaryColor(actionfunction, PRIMARY_COLORS.PURPLE);
export const primaryColor4 = (actionfunction: any) =>
    setPrimaryColor(actionfunction, PRIMARY_COLORS.GREEN);
export const primaryColor5 = (actionfunction: any) =>
    setPrimaryColor(actionfunction, PRIMARY_COLORS.RED);

const ColorPicker = (
    props: React.JSX.IntrinsicAttributes &
        React.ClassAttributes<HTMLInputElement> &
        React.InputHTMLAttributes<HTMLInputElement>
) => {
    return (
        <div className="color-picker-input">
            <input type="color" {...props} />
        </div>
    );
};

function hexToRgb(hex: string) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
        ? {
              r: parseInt(result[1], 16),
              g: parseInt(result[2], 16),
              b: parseInt(result[3], 16),
          }
        : null;
}
//themeprimarycolor
const Themeprimarycolor = ({ theme, actionfunction }: any) => {
    const [state, updateState] = useState("#FFFFFF");
    const handleInput = (e: any) => {
        const { r, g, b }: any = hexToRgb(e.target.value);
        updateState(e.target.value);
        actionfunction({
            ...theme,
            colorPrimaryRgb: `${r} ${g} ${b}`,
            colorPrimary: `${r} ${g} ${b}`,
        });
        localStorage.setItem("dynamiccolor", `${r} ${g} ${b}`);
    };

    return (
        <div className="Themeprimarycolor">
            <ColorPicker onChange={handleInput} value={state} />
        </div>
    );
};

export default Themeprimarycolor;

export const LandingpageReset = (actionfunction: any) => {
    const theme = store.getState();
    actionfunction({
        ...theme,
        lang: "en",
        dir: "ltr",
        class: "light",
        dataHeaderStyles: "light",
        colorPrimaryRgb: "",
        colorPrimary: "",
        bodyBg: "",
        darkBg: "",
        inputBorder: "",
        Light: "",
    });
    localStorage.clear();
};

export const LocalStorageBackup1 = (actionfunction: any) => {
    localStorage.ynexdarktheme ? Dark(actionfunction) : "";
    localStorage.ynexlighttheme ? Light(actionfunction) : "";
    localStorage.ynexrtl ? Rtl(actionfunction) : "";

    // Theme Primary: Colors: Start
    switch (localStorage.primaryRGB) {
        case "58, 88, 146":
            primaryColor1(actionfunction);

            break;
        case "92, 144, 1633":
            primaryColor2(actionfunction);

            break;
        case "161, 90, 223":
            primaryColor3(actionfunction);

            break;
        case "78, 172, 76":
            primaryColor4(actionfunction);

            break;
        case "223, 90, 90":
            primaryColor5(actionfunction);

            break;
        default:
            break;
    }
    // Theme Primary: Colors: End
};
