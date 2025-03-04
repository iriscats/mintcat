import {createContext} from "react";
import {ModListViewModel} from "./vm/ModPageVM.ts";

export const AppContext = createContext<any>({});

export const ModListPageContext
    = createContext<ModListViewModel>(await ModListViewModel.getInstance());


