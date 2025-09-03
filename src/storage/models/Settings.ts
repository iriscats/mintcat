import {load} from '@tauri-apps/plugin-store';

type StoreValue = string | number | boolean | object | null;

type StoreSchema = Record<string, StoreValue>;


export async function createStore<T extends StoreSchema>(
    defaultValues: T,
    storeName = 'settings.json'
): Promise<{
    [K in keyof T]: Promise<T[K]> | T[K];
}> {
    const store = await load(storeName, {autoSave: true});

    for (const key in defaultValues) {
        const existing = await store.get(key);
        if (existing === null || existing === undefined) {
            await store.set(key, defaultValues[key]);
        }
    }

    return new Proxy({} as any, {
        get(_, prop: string) {
            return store.get(prop);
        },
        set(_, prop: string, value) {
            store.set(prop, value);
            return true;
        },
    });
}


export const settings = await createStore({
    version: '0.5.0',
    language: 'en',
    gui_theme: 'Light',
    modio_uid: 0,
    modio_oauth: "",
    drg_pak_path: "",
    cache_path: "",
    config_path: "",
    ue4ss: 'UE4SS-Lite',
});
