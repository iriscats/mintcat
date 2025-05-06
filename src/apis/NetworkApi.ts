import {retry} from "ts-retry";
import {t} from "i18next";

const PROXY_API_URL = "https://api.v1st.net/";

export class NetworkApi {

    static IS_PROXY = false;

    private static getUrl(path: string) {
        return NetworkApi.IS_PROXY ? PROXY_API_URL + path : path;
    }

    private static async fetchWithTimeout(url, options = {}, timeout = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        return fetch(url, {
            ...options,
            signal: controller.signal
        }).finally(() => clearTimeout(id));
    }

    private static async retryFetch(url: string, headers?: Record<string, string>) {
        let resp: Response;
        try {
            resp = await retry(
                async () => {
                    try {
                        return await NetworkApi.fetchWithTimeout(NetworkApi.getUrl(url), {
                            headers: headers,
                        });
                    } catch (e) {
                        NetworkApi.IS_PROXY = true;
                        throw e;
                    }
                },
                {delay: 10, maxTry: 2}
            );
        } catch (e) {
            throw Error(`${t("Network Error")}`);
        }
        return resp;
    }

    public static async get(url: string, headers?: Record<string, string>): Promise<Response> {
        return await NetworkApi.retryFetch(url, headers);
    }


}