import {createContext} from "react";
import {AppViewModel} from "./vm/AppViewModel.ts";
import {ModListViewModel} from "./vm/ModListVM.ts";

export const AppContext
    = createContext<AppViewModel>(await AppViewModel.getInstance());

export const ModListPageContext
    = createContext<ModListViewModel>(await ModListViewModel.getInstance());


