import {combineReducers} from "redux";

import {reducer as themeReducer, ThemeState} from "./module/theme/reducer";

export interface RootState {
    theme: ThemeState;
}

export const rootReducer = combineReducers<RootState | undefined>({
    theme: themeReducer,
});
