import { createSlice } from "@reduxjs/toolkit";

const initialState = {
    customer: null,
};

const customerSlice = createSlice({
    name: "customer",
    initialState,
    reducers: {
        setCustomer: (state, action) => {
            state.customer = action.payload;
            // Customer set
        },
        updateCustomer: (state, action) => {
            state.customer = { ...state.customer, ...action.payload };
            // Customer updated
        },
        clearCustomer: (state) => {
            state.customer = null;
        },
    },
});

export const { setAccount, updateAccount, clearCustomer } =
    customerSlice.actions;
export default customerSlice.reducer;
