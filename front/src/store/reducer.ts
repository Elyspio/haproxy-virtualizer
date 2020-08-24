import {combineReducers} from "redux";

import {reducer as themeReducer, ThemeState} from "./module/theme/reducer";
import {ConfigTheme, reducer as haproxyReducer} from "./module/haproxy/reducer";

export interface RootState {
    theme: ThemeState;
    haproxy: ConfigTheme
}

export const rootReducer = combineReducers<RootState | undefined>({
    theme: themeReducer,
    haproxy: haproxyReducer
});
