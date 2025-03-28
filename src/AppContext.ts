import {createContext} from "react";
import {AppViewModel} from "./vm/AppViewModel.ts";
import {HomeViewModel} from "./vm/HomeViewModel.ts";

export const AppContext
    = createContext<AppViewModel>(await AppViewModel.getInstance());

export const ModListPageContext
    = createContext<HomeViewModel>(await HomeViewModel.getInstance());


