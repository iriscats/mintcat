export class Setting {

    public version: string = "0.2.0";
    public modioOAuth: string = "";
    public modioUid: number = 0;
    public drgPakPath: string = "";
    public guiTheme: string = "Light";
    public language: string = "en";
    public cachePath: string = "";
    public configPath: string = "";

    public static fromJson(json_str: string): Setting {
        const json = JSON.parse(json_str);
        let setting = new Setting();
        setting.version = json.version;
        setting.modioOAuth = json.modio_oauth;
        setting.modioUid = json.modio_uid;
        setting.drgPakPath = json.drg_pak_path;
        setting.guiTheme = json.gui_theme;
        setting.language = json.language;
        setting.cachePath = json.cache_path;
        setting.configPath = json.config_path;
        return setting;
    }

    public toJson() {
        const setting = {
            "version": this.version,
            "modio_oauth": this.modioOAuth,
            "modio_uid": this.modioUid,
            "drg_pak_path": this.drgPakPath,
            "gui_theme": this.guiTheme,
            "language": this.language,
            "cache_path": this.cachePath,
            "config_path": this.configPath,
        }
        return JSON.stringify(setting, null, 4);
    }
}