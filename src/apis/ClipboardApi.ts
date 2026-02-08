import {readText} from "@tauri-apps/plugin-clipboard-manager";

export class ClipboardApi {

    private static isHook = false;

    private static lastClipboardText = "";

    private static intervalId: ReturnType<typeof setInterval> | null = null;

    private static watcherCallback: ((text: string) => void) | null = null;

    /**
     * 安全读取剪切板文本，当剪切板为空或内容非文本格式时返回空字符串而不抛异常
     */
    private static async safeReadText(): Promise<string> {
        try {
            return await readText();
        } catch {
            // 剪切板为空或内容非文本格式（如图片），属于正常情况，静默处理
            return "";
        }
    }

    public static setLastClipboardText(text: string) {
        this.lastClipboardText = text;
    }

    public static async setClipboardWatcher(callback: (text: string) => void) {
        this.watcherCallback = callback;

        if (this.isHook) {
            return;
        }
        this.isHook = true;

        this.lastClipboardText = await this.safeReadText();
        this.intervalId = setInterval(async () => {
            const text = await this.safeReadText();
            if (text && text !== this.lastClipboardText) {
                this.lastClipboardText = text;
                callback(text);
            }
        }, 1000);
    }

    public static stopClipboardWatcher() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isHook = false;
    }

    public static async restartClipboardWatcher() {
        if (this.watcherCallback) {
            await this.setClipboardWatcher(this.watcherCallback);
        }
    }

}