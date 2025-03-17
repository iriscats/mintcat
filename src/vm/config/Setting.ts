export class Setting {

    public version: string = "0.2.0";
    public modioOAuth: string = "";
    public drgPakPath: string = "";
    public guiTheme: string = "";
    public language: string = "";
    public cachePath: string = "";
    public configPath: string = "";

    public static fromJson(json_str: string): Setting {
        const json = JSON.parse(json_str);
        let setting = new Setting();
        setting.version = json.version;
        setting.modioOAuth = json.modio_oauth;
        setting.drgPakPath = json.drg_pak_path;
        setting.guiTheme = json.gui_theme;
        setting.language = json.language;
        setting.cachePath = json.cache_path;
        setting.configPath = json.configPath;
        return setting;
    }

    public toJson() {
        const setting = {
            "version": this.version,
            "modio_oauth": this.modioOAuth,
            "drg_pak_path": this.drgPakPath,
            "gui_theme": this.guiTheme,
            "language": this.language,
            "cachePath": this.cachePath,
            "configPath": this.configPath,
        }
        return JSON.stringify(setting);
    }
}