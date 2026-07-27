import { Config } from "next-i18n-router/dist/types";

const i18nConfig: Config = {
    defaultLocale: "en",
    locales: ["en", "he"],
    prefixDefault: true,
    localeDetector: false,
};

export default i18nConfig;
