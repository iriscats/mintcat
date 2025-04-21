import {readText} from "@tauri-apps/plugin-clipboard-manager";

export class ClipboardApi {

    private static lastClipboardText = "";

    public static setLastClipboardText(text: string) {
        this.lastClipboardText = text;
    }

    public static async setClipboardWatcher(callback: (text: string) => void) {
        try {
            this.lastClipboardText = await readText();
            setInterval(async () => {
                try {
                    const text = await readText();
                    if (text !== this.lastClipboardText) {
                        this.lastClipboardText = text;
                        callback(text)
                    }
                } catch (err) {
                    console.warn('无法读取剪切板:', err);
                }
            }, 1000);
        } catch (err) {
            console.warn('无法读取剪切板:', err);
        }
    }

}