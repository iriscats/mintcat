const PROXY_MODIO_API_URL = "https://api.v1st.net/https://api.mod.io/";
const MODIO_API_URL = "https://api.mod.io/";
const MODIO_API_KEY = "";


class ModioApi {

    private static buildRequestHeader() {
    }

    private static buildRequestUrl(): string {
        //https://api.v1st.net/https://api.mod.io/v1/games/2475/mods?api_key=1a5a60521b97f65481a5ddb8f1b8486d&=10iron-will-recharge-10-minutes
        return PROXY_MODIO_API_URL + "v1/games/2475/mods?api_key=" + MODIO_API_KEY;
    }

    public static async getModByName(nameId: string): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl() + "&name_id=" + nameId);
        return resp.json();
    }

    public static async getModById(id: string): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl() + "&id=" + id);
        return resp.json();
    }

    public static async getModList(): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl());
        return resp.json();
    }

    public static async downloadMod(url: string): Promise<Response> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.arrayBuffer();

        // await window.__TAURI__.invoke('save_file', { fileData: Array.from(new Uint8Array(data)), filename });
    }

}

export default ModioApi;

