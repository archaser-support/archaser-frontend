import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";

import type { RootState } from "../reducer";
import store from "../store";

// Infer the `AppDispatch` type from the store itself
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
