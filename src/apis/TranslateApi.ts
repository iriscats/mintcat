export class TranslateApi {

    public static async translate(text: string) {
        try {
            const res = await fetch("https://api.v1st.net/https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=en&tl=zh-CN&q=" + text, {
                method: "GET",
            });
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



