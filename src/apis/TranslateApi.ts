import { t } from "i18next";
import StatusBar from "@/components/StatusBar";
import { NetworkApi } from "./NetworkApi";

export class TranslateApi {

    public static async translate(text: string) {
        try {
            const url = "https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN&q=" + encodeURIComponent(text);
            const res = await NetworkApi.get(url, undefined, true);
            const array = await res.json();
            let translateText = "";
            for (const item of array[0]) {
                translateText += item[0];
            }
            return translateText;
        } catch (_) {
            await StatusBar.error(t("Translation failed"));
            return text;
        }
    }
}



