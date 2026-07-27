// Import the proper Country type
import { Country } from "@/types/country";
import { State } from "@/types/state";

import { ActionType } from "./actionTypes";

export type RootState = typeof initialState;

const initialState = {
    lang: "en",
    dir: "ltr",
    class: "light",
    dataMenuStyles: "dark",
    dataNavLayout: "vertical",
    dataHeaderStyles: "light",
    dataVerticalStyle: "overlay",
    dataToggled: "",
    dataNavStyle: "",
    horStyle: "",
    dataPageStyle: "regular",
    dataWidth: "fullwidth",
    dataMenuPosition: "fixed",
    dataHeaderPosition: "fixed",
    loader: "disable",
    iconOverlay: "",
    colorPrimaryRgb: "",
    colorPrimary: "",
    bodyBg: "",
    Light: "",
    darkBg: "",
    inputBorder: "",
    bgImg: "",
    iconText: "",
    body: "",

    countries: [] as Country[],
    customer: null,
    states: [] as State[],

    controlCenterIssues: {
        noContacts: { active: 0, inactive: 0 },
        invalidContacts: { active: 0, inactive: 0 },
        invoicesWithoutCustomer: { active: 0, inactive: 0 },
        orphanCreditInvoices: { active: 0, inactive: 0 },
    },

    requestCount: 0,
    requestApis: [] as string[],
};

export default function reducer(state = initialState, action: any) {
    const { type, payload } = action;

    switch (type) {
        case ActionType.ThemeChanger:
            state = payload;
            return state;

        case ActionType.SET_CUSTOMER:
            return {
                ...state,
                customer: payload,
            };

        case ActionType.CLEAR_CUSTOMER:
            return {
                ...state,
                customer: null,
            };
        case ActionType.SET_CONTROL_CENTER_ISSUES:
            return {
                ...state,
                controlCenterIssues: {
                    noContacts: payload.noContacts,
                    invalidContacts: payload.invalidContacts,
                    invoicesWithoutCustomer: payload.invoicesWithoutCustomer || payload.invoicesWithoutCustomer, // Backwards compatibility
                    orphanCreditInvoices: payload.orphanCreditInvoices,
                },
            };

        case ActionType.ADD_REQUEST_COUNT:
            return {
                ...state,
                requestCount: state.requestCount + 1,
            };

        case ActionType.SUBTRACT_REQUEST_COUNT:
            return {
                ...state,
                requestCount:
                    state.requestCount > 0 ? state.requestCount - 1 : 0,
            };

        case ActionType.RESET_REQUEST_COUNT:
            return {
                ...state,
                requestCount: 0,
            };

        case ActionType.ADD_REQUEST_API:
            return {
                ...state,
                requestApis: [...state.requestApis, payload],
            };

        case ActionType.REMOVE_REQUEST_API:
            return {
                ...state,
                requestApis: state.requestApis.filter((api) => api !== payload),
            };

        case ActionType.CLEAR_REQUEST_APIS:
            return {
                ...state,
                requestApis: [],
            };

        case ActionType.SET_COUNTRIES:
            return {
                ...state,
                countries: payload,
            };

        case ActionType.CLEAR_COUNTRIES:
            return {
                ...state,
                countries: [],
            };

        case "SET_STATES":
            return {
                ...state,
                states: payload,
            };

        case "CLEAR_STATES":
            return {
                ...state,
                states: [],
            };

        default:
            return state;
    }
}
