import {configureStore} from "@reduxjs/toolkit";
import {TypedUseSelectorHook, useDispatch, useSelector} from "react-redux";
import {combineReducers} from "redux";
import {reducer as themeReducer} from "./module/theme/reducer";
import {reducer as haproxyReducer} from "./module/haproxy/reducer";

const store = configureStore({
    reducer: combineReducers({
        theme: themeReducer,
        haproxy: haproxyReducer
    })
});

export default store;
export type StoreState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export const useAppDispatch = () => useDispatch<AppDispatch>() // Export a hook that can be reused to resolve types
export const useAppSelector: TypedUseSelectorHook<StoreState> = useSelector
