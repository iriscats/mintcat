import {ModListViewModel} from "./ModListVM.ts";
import {IntegrateApi} from "../apis/IntegrateApi.ts";

export class AppViewModel {

    private constructor() {
    }

    public async installMods() {
        const viewModel = await ModListViewModel.getInstance();
        const installModList = [];
        for (const item of viewModel.ModList.Mods) {
            if (item.enabled) {
                installModList.push({
                    modio_id: item.id,
                    name: item.nameId,
                    pak_path: item.cachePath,
                });
            }
        }
        await IntegrateApi.Install(JSON.stringify(installModList));
    }

    public static async getInstance(): Promise<AppViewModel> {
        const vm = new AppViewModel();


        return vm;
    }

}