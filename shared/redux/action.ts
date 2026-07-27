import api from "@/app/api";

import { ActionType } from "./actionTypes";

interface ThemeState {
    dataToggled?: string;
    dataNavStyle?: string;
    dataVerticalStyle?: {
        dir?: string;
    };
    iconOverlay?: string;
    [key: string]: any;
}

export const ThemeChanger = (value: any) => async (dispatch: any) => {
    dispatch({
        type: "ThemeChanger",
        payload: value,
    });
};

export const AddToCart =
    (id: string) =>
    async (dispatch: (arg0: { type: string; payload: string }) => void) => {
        dispatch({
            type: "ADD_TO_CART",
            payload: id,
        });
    };

export const ProductReduxData =
    (id: any) =>
    async (dispatch: (arg0: { type: string; payload: any }) => void) => {
        dispatch({
            type: "PRODUCT",
            payload: id,
        });
    };

// Add actions for customer
export const setCustomer = (customer: any) => (dispatch: any) => {
    dispatch({
        type: "SET_CUSTOMER",
        payload: customer,
    });
};

export const updateCustomer = (customerUpdates: any) => (dispatch: any) => {
    dispatch({
        type: "UPDATE_CUSTOMER",
        payload: customerUpdates,
    });
};

export const clearCustomer = () => (dispatch: any) => {
    dispatch({
        type: "CLEAR_CUSTOMER",
    });
};


export const setCountries = (countries: any[]) => (dispatch: any) => {
    dispatch({
        type: ActionType.SET_COUNTRIES,
        payload: countries,
    });
};

export const clearCountries = () => (dispatch: any) => {
    dispatch({
        type: ActionType.CLEAR_COUNTRIES,
    });
};

export const fetchCountriesFromApi = () => async (dispatch: any) => {
    try {
        const response = await api.get("/country");
        dispatch(setCountries(response.data));
    } catch (error) {
        console.error("Error fetching countries:", error);
        dispatch(setCountries([]));
    }
};

export const setStates = (states: any[]) => (dispatch: any) => {
    dispatch({
        type: "SET_STATES",
        payload: states,
    });
};

export const clearStates = () => (dispatch: any) => {
    dispatch({
        type: "CLEAR_STATES",
    });
};

export const fetchStatesFromApi =
    (countryId: string | number) => async (dispatch: any) => {
        try {
            const response = await api.get(
                `/system/states?country_id=${countryId}`
            );
            dispatch(setStates(response.data));
        } catch (error) {
            console.error("Error fetching states:", error);
            dispatch(setStates([]));
        }
    };
