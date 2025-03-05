import {createContext} from "react";
import {ModListViewModel} from "./vm/ModPageVM.ts";
import {AppViewModel} from "./vm/AppViewModel.ts";

export const AppContext
    = createContext<AppViewModel>(await AppViewModel.getInstance());

export const ModListPageContext
    = createContext<ModListViewModel>(await ModListViewModel.getInstance());


