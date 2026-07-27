import { Autocomplete, TextField, Box, Typography, Theme } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useQuery } from "@tanstack/react-query";
import React, { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";

import api from "@/app/api";
import { currencies } from "@/shared/data/common/currencies";
import { TimeZoneLabels } from "@/utils/timezones";

// Centralized curated list of common locales
export const availableLocales: string[] = [
    "en-US",
    "en-GB",
    "he-IL",
    "fr-FR",
    "de-DE",
    "es-ES",
    "pt-PT",
    "pt-BR",
    "ru-RU",
    "zh-CN",
    "zh-TW",
    "ja-JP",
    "ko-KR",
    "ar-SA",
    "hi-IN",
    "it-IT",
    "nl-NL",
    "sv-SE",
    "no-NO",
    "da-DK",
    "fi-FI",
    "pl-PL",
    "tr-TR",
    "th-TH",
    "cs-CZ",
    "hu-HU",
    "ro-RO",
    "vi-VN",
    "uk-UA",
    "id-ID",
];

// Utility functions for RTL/LTR handling
const getRTLProps = (isHebrew: boolean) => ({
    dir: isHebrew ? "rtl" : "ltr",
    ...(isHebrew && { "data-hebrew": true, "data-rtl": true }),
});

const getRTLStyles = (isHebrew: boolean) => ({
    direction: (isHebrew ? "rtl" : "ltr") as "rtl" | "ltr",
    textAlign: (isHebrew ? "right" : "left") as "right" | "left",
});

// Common styling for autocomplete options
const getOptionStyles = (isHebrew: boolean) => ({
    ...getRTLStyles(isHebrew),
    display: "flex",
    alignItems: "center",
    minHeight: "48px",
    padding: "8px 16px",
});

// Common styling for text fields
const getTextFieldStyles = (theme: Theme) => ({
    mb: theme.spacing(1),
});

interface StateType {
    id: number;
    name: string;
    country_id: number;
}

interface CountryType {
    id: number;
    name: string;
    emoji: string | null;
    iso2: string | null;
    iso3: string | null;
    numeric_code: string | null;
    phonecode: string | null;
    capital: string | null;
    currency: string | null;
    currency_name: string | null;
    currency_symbol: string | null;
    tld: string | null;
    native: string | null;
    region: string | null;
    subregion: string | null;
    timezones: string | null;
    translations: string | null;
    latitude: string | null;
    longitude: string | null;
    emojiU: string | null;
    wikiDataId: string | null;
}


interface CountryProps {
    value: CountryType | null;
    onChange: (value: CountryType | null) => void;
    label?: string;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    required?: boolean;
}

interface StateProps {
    value: StateType | null;
    onChange: (value: StateType | null) => void;
    countryId?: number;
    label?: string;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
}

interface LocaleProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
}

interface CurrencyProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
    error?: boolean;
    helperText?: string;
    size?: "small" | "medium";
}

interface LanguageProps {
    value: string | null;
    onChange: (value: string | null) => void;
    label?: string;
    disabled?: boolean;
    availableLanguages?: string[];
}

interface TimezoneProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    disabled?: boolean;
    availableTimezones?: string[];
}


const StateSelect: React.FC<StateProps> = ({
    countryId,
    value,
    onChange,
    label,
    disabled,
    error,
    helperText,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const {
        data: states = [],
        isLoading,
    } = useQuery<StateType[]>({
        queryKey: ["states", countryId?.toString()],
        queryFn: async () => {
            if (!countryId) return [];
            try {
                const response = await api.get<StateType[]>("/state", {
                    params: { country_id: countryId },
                });
                return response.data;
            } catch (error) {
                return [];
            }
        },
        enabled: !!countryId,
    });

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: StateType) => {
        const { key, ...otherProps } = props;
        return (
            <li key={key} {...otherProps} style={getOptionStyles(isHebrew)}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ...getRTLStyles(isHebrew),
                        width: "100%",
                    }}
                >
                    <Typography sx={getRTLStyles(isHebrew)}>
                        {option.name}
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew]);

    const isDisabled = disabled || !countryId;

    return (
        <Autocomplete<StateType>
            value={value}
            onChange={(_, newValue) => onChange?.(newValue)}
            options={states}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.id === value?.id}
            disabled={isDisabled}
            loading={isLoading}
            {...getRTLProps(isHebrew)}
            sx={{
                width: "100%",
                mb: '0 !important',
                ...(isDisabled && {
                    "& .MuiInputBase-root": {
                        backgroundColor: theme.palette.action.disabledBackground,
                        cursor: "not-allowed",
                    },
                    "& .MuiInputBase-input": {
                        cursor: "not-allowed",
                        color: theme.palette.action.disabled,
                    },
                }),
            }}
            selectOnFocus
            clearOnBlur={false}
            handleHomeEndKeys
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    error={!!error}
                    helperText={error ? helperText : ""}
                    fullWidth
                    {...getRTLProps(isHebrew)}
                    sx={getTextFieldStyles(theme)}
                />
            )}
        />
    );
};

export const LocaleSelect: React.FC<LocaleProps> = ({
    value,
    onChange,
    label,
    disabled,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const getLocaleEmoji = useCallback((locale: string) => {
        try {
            const regionCode = locale.split("-")[1];
            if (!regionCode) return "🏳️";
            const codePoints = regionCode
                .toUpperCase()
                .split("")
                .map((char) => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        } catch (error) {
            return "🏳️";
        }
    }, []);

    const getDisplayName = useCallback((
        locale: string,
        type: "language" | "region",
        code: string
    ) => {
        try {
            if (!locale || !code) return code || "";
            return new Intl.DisplayNames([locale], { type }).of(code) || code;
        } catch (error) {
            return code || "";
        }
    }, []);

    const getOptionLabel = useCallback((option: string) => {
        try {
            if (!option || !option.includes("-")) return option || "";
            const [langCode, regionCode] = option.split("-");
            if (!langCode || !regionCode) return option;

            const language = getDisplayName(option, "language", langCode);
            const region = getDisplayName(option, "region", regionCode);
            return `${getLocaleEmoji(option)} ${language} (${region})`;
        } catch (error) {
            return option || "";
        }
    }, [getDisplayName, getLocaleEmoji]);

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: string) => {
        const { key, ...otherProps } = props;
        return (
            <li key={key} {...otherProps} style={getOptionStyles(isHebrew)}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ...getRTLStyles(isHebrew),
                        width: "100%",
                    }}
                >
                    <Typography sx={getRTLStyles(isHebrew)}>
                        {getOptionLabel(option)}
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew, getOptionLabel]);

    return (
        <Autocomplete
            value={value || ""}
            onChange={(_, newValue) => onChange?.(newValue || "")}
            options={availableLocales}
            disabled={disabled}
            {...getRTLProps(isHebrew)}
            getOptionLabel={getOptionLabel}
            sx={{
                width: "100%",
                mb: '0 !important'
            }}
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    {...getRTLProps(isHebrew)}
                    sx={getTextFieldStyles(theme)}
                />
            )}
        />
    );
};

export const CountrySelect: React.FC<CountryProps> = ({
    value,
    onChange,
    label,
    disabled,
    error,
    helperText,
    required,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const { data: countries = [] } = useQuery<CountryType[]>({
        queryKey: ["countries"],
        queryFn: async () => {
            const response = await api.get<CountryType[]>("/country");
            return response.data;
        },
    });

    // Function to generate emoji from country code
    const generateCountryEmoji = useCallback((countryCode: string | null) => {
        if (!countryCode) return "🏳️";
        try {
            const codePoints = countryCode
                .toUpperCase()
                .split("")
                .map((char) => 127397 + char.charCodeAt(0));
            return String.fromCodePoint(...codePoints);
        } catch (error) {
            return "🏳️";
        }
    }, []);

    // Function to get emoji for a country
    const getCountryEmoji = useCallback((country: CountryType) => {
        if (country.emoji) return country.emoji;
        if (country.iso2) return generateCountryEmoji(country.iso2);
        return "🏳️";
    }, [generateCountryEmoji]);

    const getOptionLabel = useCallback((option: CountryType) =>
        isHebrew
            ? `${option.name} ${getCountryEmoji(option)}`
            : `${getCountryEmoji(option)} ${option.name}`
        , [getCountryEmoji, isHebrew]);

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: CountryType) => {
        const { key, ...otherProps } = props;
        return (
            <li
                key={key}
                {...otherProps}
                style={{
                    ...getOptionStyles(isHebrew),
                    textAlign: isHebrew ? "right" : "left",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        width: "100%",
                        flexDirection: isHebrew ? "row-reverse" : "row",
                        justifyContent: isHebrew ? "flex-end" : "flex-start",
                    }}
                >
                    <Typography
                        sx={{
                            ...getRTLStyles(isHebrew),
                            textAlign: isHebrew ? "right" : "left",
                        }}
                    >
                        {option.name}
                    </Typography>
                    <Typography
                        sx={{
                            ...getRTLStyles(isHebrew),
                            textAlign: "center",
                        }}
                    >
                        {getCountryEmoji(option)}
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew, getCountryEmoji]);

    const dropdownProps = useMemo(() => ({
        dir: isHebrew ? "rtl" : "ltr"
    }), [isHebrew]);

    return (
        <Autocomplete<CountryType>
            value={value}
            onChange={(_, newValue) => onChange?.(newValue)}
            options={countries}
            getOptionLabel={getOptionLabel}
            disabled={disabled}
            {...getRTLProps(isHebrew)}
            {...dropdownProps}
            sx={{
                width: "100%",
                mb: '0 !important'
            }}
            selectOnFocus
            clearOnBlur={false}
            handleHomeEndKeys
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    error={error}
                    helperText={helperText}
                    required={required}
                    {...getRTLProps(isHebrew)}
                    {...dropdownProps}
                    sx={getTextFieldStyles(theme)}
                />
            )}
            isOptionEqualToValue={(option, value) =>
                option.id === value?.id
            }
        />
    );
};

export const CurrencySelect: React.FC<CurrencyProps> = ({
    value,
    onChange,
    label,
    disabled,
    error,
    helperText,
    size = "medium",
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const currencyOptions = useMemo(() =>
        currencies.map((currency) => currency.code), []
    );

    const getOptionLabel = useCallback((option: string) => {
        const currency = currencies.find((c) => c.code === option);
        return currency
            ? `${currency.code} - ${currency.name} (${currency.symbol})`
            : option;
    }, []);

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: string) => {
        const { key, ...otherProps } = props;
        const currency = currencies.find((c) => c.code === option);
        return (
            <li key={key} {...otherProps} style={getOptionStyles(isHebrew)}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ...getRTLStyles(isHebrew),
                        width: "100%",
                    }}
                >
                    <Typography sx={getRTLStyles(isHebrew)}>
                        {currency?.code} - {currency?.name} ({currency?.symbol})
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew]);

    return (
        <Autocomplete
            value={value}
            onChange={(_, newValue) => onChange?.(newValue || "")}
            options={currencyOptions}
            disabled={disabled}
            size={size}
            {...getRTLProps(isHebrew)}
            getOptionLabel={getOptionLabel}
            sx={{
                width: "100%",
                mb: '0 !important',
                "& .MuiInputLabel-root": {
                    textAlign: isHebrew ? "right" : "left",
                    left: isHebrew ? "auto" : 0,
                    right: isHebrew ? 0 : "auto",
                    transformOrigin: isHebrew ? "top right" : "top left",
                },
                "& .MuiAutocomplete-inputRoot": {
                    direction: isHebrew ? "rtl" : "ltr",
                },
                "& .MuiAutocomplete-input": {
                    textAlign: isHebrew ? "right" : "left",
                },
            }}
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    size={size}
                    error={error}
                    helperText={helperText}
                    {...getRTLProps(isHebrew)}
                    sx={{
                        ...getTextFieldStyles(theme),
                        "& .MuiInputBase-root": {
                            direction: isHebrew ? "rtl" : "ltr",
                        },
                        "& .MuiInputBase-input": {
                            textAlign: isHebrew ? "right" : "left",
                            direction: isHebrew ? "rtl" : "ltr",
                        },
                        "& .MuiInputBase-input::placeholder": {
                            textAlign: isHebrew ? "right" : "left",
                            direction: isHebrew ? "rtl" : "ltr",
                            opacity: 1,
                        },
                        "& .MuiInputLabel-root": {
                            textAlign: isHebrew ? "right" : "left",
                        },
                    }}
                />
            )}
        />
    );
};

// Language flag component for reuse
export const LanguageFlag: React.FC<{ language: string }> = ({ language }) => {
    const getFlagEmoji = useCallback((lang: string) => {
        switch (lang.toLowerCase()) {
            case "english":
                return "🇺🇸";
            case "hebrew":
                return "🇮🇱";
            case "arabic":
                return "🇸🇦";
            case "spanish":
                return "🇪🇸";
            case "french":
                return "🇫🇷";
            case "german":
                return "🇩🇪";
            case "italian":
                return "🇮🇹";
            case "portuguese":
                return "🇵🇹";
            case "russian":
                return "🇷🇺";
            case "chinese":
                return "🇨🇳";
            case "japanese":
                return "🇯🇵";
            case "korean":
                return "🇰🇷";
            default:
                return "🌐";
        }
    }, []);

    return (
        <Box
            component="span"
            sx={{
                fontSize: "1.2rem",
                lineHeight: 1,
                display: "inline-block",
                width: "1.2rem",
                height: "1.2rem",
                textAlign: "center",
            }}
        >
            {getFlagEmoji(language)}
        </Box>
    );
};

export const LanguageSelect: React.FC<LanguageProps> = ({
    value,
    onChange,
    label,
    disabled,
    availableLanguages = [
        "English",
        "Hebrew",
        "German",
        "Spanish",
        "French",
        "Italian",
        "Portuguese",
    ],
}) => {
    const theme = useTheme();
    const { t, i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const getTranslatedLanguageName = useCallback((language: string) => {
        const languageKey = language.toLowerCase();
        return t(`common.languages.${languageKey}`, language);
    }, [t]);

    const getOptionLabel = useCallback((option: string) =>
        getTranslatedLanguageName(option)
        , [getTranslatedLanguageName]);

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: string) => {
        const { key, ...otherProps } = props;
        return (
            <li key={key} {...otherProps} style={getOptionStyles(isHebrew)}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ...getRTLStyles(isHebrew),
                        width: "100%",
                    }}
                >
                    <LanguageFlag language={option} />
                    <Typography sx={getRTLStyles(isHebrew)}>
                        {getTranslatedLanguageName(option)}
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew, getTranslatedLanguageName]);

    return (
        <Autocomplete
            value={value || null}
            onChange={(_, newValue) => onChange?.(newValue || null)}
            options={availableLanguages}
            disabled={disabled}
            {...getRTLProps(isHebrew)}
            getOptionLabel={getOptionLabel}
            sx={{
                width: "100%",
                mb: '0 !important'
            }}
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    {...getRTLProps(isHebrew)}
                    sx={getTextFieldStyles(theme)}
                />
            )}
        />
    );
};

// Timezone flag component for reuse
export const TimezoneFlag: React.FC<{ timezone: string }> = ({ timezone }) => {
    const getTimezoneEmoji = useCallback((tz: string) => {
        const region = tz.split("/")[0];
        switch (region.toLowerCase()) {
            case "america":
                return "🇺🇸";
            case "europe":
                return "🇪🇺";
            case "asia":
                return "🌏";
            case "africa":
                return "🌍";
            case "australia":
            case "australia/sydney":
            case "australia/melbourne":
                return "🇦🇺";
            case "pacific":
                return "🌊";
            case "atlantic":
                return "🌊";
            case "indian":
                return "🇮🇳";
            case "antarctica":
                return "🇦🇶";
            default:
                return "🕐";
        }
    }, []);

    return (
        <Box
            component="span"
            sx={{
                fontSize: "1.2rem",
                lineHeight: 1,
                display: "inline-block",
                width: "1.2rem",
                height: "1.2rem",
                textAlign: "center",
            }}
        >
            {getTimezoneEmoji(timezone)}
        </Box>
    );
};

export const TimezoneSelect: React.FC<TimezoneProps> = ({
    value,
    onChange,
    label,
    disabled,
    availableTimezones,
}) => {
    const theme = useTheme();
    const { i18n } = useTranslation(["common"]);
    const isHebrew = i18n.language === "he";

    const timezoneOptions = useMemo(() =>
        availableTimezones || Object.keys(TimeZoneLabels),
        [availableTimezones]
    );

    const getTimezoneDisplayName = useCallback((timezone: string) => {
        return TimeZoneLabels[timezone] || timezone;
    }, []);

    const getOptionLabel = useCallback((option: string) =>
        getTimezoneDisplayName(option)
        , [getTimezoneDisplayName]);

    const renderOption = useCallback((props: React.HTMLAttributes<HTMLLIElement> & { key?: React.Key }, option: string) => {
        const { key, ...otherProps } = props;
        return (
            <li key={key} {...otherProps} style={getOptionStyles(isHebrew)}>
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        ...getRTLStyles(isHebrew),
                        width: "100%",
                    }}
                >
                    <Typography sx={getRTLStyles(isHebrew)}>
                        {getTimezoneDisplayName(option)}
                    </Typography>
                </Box>
            </li>
        );
    }, [isHebrew, getTimezoneDisplayName]);

    return (
        <Autocomplete
            value={value || ""}
            onChange={(_, newValue) => onChange?.(newValue || "")}
            options={timezoneOptions}
            disabled={disabled}
            {...getRTLProps(isHebrew)}
            getOptionLabel={getOptionLabel}
            sx={{
                width: "100%",
                mb: '0 !important'
            }}
            renderOption={renderOption}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label={label}
                    variant="outlined"
                    fullWidth
                    {...getRTLProps(isHebrew)}
                    sx={getTextFieldStyles(theme)}
                />
            )}
        />
    );
};


export { StateSelect };
