import { NetworkApi } from "./NetworkApi";

export class TranslateApi {

    public static async translate(text: string) {
        try {
            const url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN&q=" + encodeURIComponent(text);
            const res = await NetworkApi.get(url);
            const array = await res.json();
            let translateText = "";
            for (const item of array[0]) {
                translateText += item[0];
            }
            return translateText;
        } catch (_) {
            return text;
        }
    }
}



