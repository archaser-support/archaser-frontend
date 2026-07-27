import { useTranslation } from "react-i18next";

export const useRTL = () => {
    const { i18n } = useTranslation();
    const isRTL = i18n.language === "he";

    return {
        isRTL,
        direction: isRTL ? "rtl" : "ltr",
        textAlign: isRTL ? "right" : "left",
        flexDirection: isRTL ? "row-reverse" : "row",
        transitionDirection: isRTL ? "right" : "left",
    };
};
