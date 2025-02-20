import {ModInfo} from "../vm/modio/ModInfo.ts";

const PROXY_MODIO_API_URL = "https://api.v1st.net/https://api.mod.io/";
const MODIO_API_URL = "https://api.mod.io/";
const MODIO_API_KEY = "";
const GAME_ID = 2475;

class ModioApi {

    private static buildRequestHeader() {
    }

    private static parseModLinks(link: string) {
        let regex = new RegExp('^https://mod\.io/g/drg/m/([^/#]+)(?:#(\\d+)(?:/(\\d+))?)?$');
        let match = link.match(regex);
        if (match !== null) {
            let nameId = match[1];
            let modId = match[2];
            let modifyId = match[3];

            console.log(`name_id: ${nameId}, mod_id: ${modId}, modify_id: ${modifyId}`);
            return {nameId, modId, modifyId};
        }
    }

    private static buildRequestUrl(): string {
        return `${PROXY_MODIO_API_URL}v1/games/${GAME_ID}/mods?api_key=${MODIO_API_KEY}`;
    }

    public static async getModInfoByLink(url: string): Promise<ModInfo> {
        const result = ModioApi.parseModLinks(url);
        if (result === undefined) {
            return Promise.reject("Invalid mod link");
        }
        const resp = await fetch(this.buildRequestUrl() + "&name_id=" + result.nameId);
        const data = await resp.json();
        if (data !== undefined && data.result_total === 1) {
            return data["data"][0];
        } else {
            return Promise.reject("Mod not found");
        }
    }

    public static async getModInfoByName(nameId: string): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl() + "&name_id=" + nameId);
        return resp.json();
    }

    public static async getModInfoById(id: string): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl() + "&id=" + id);
        return resp.json();
    }

    public static async getModList(): Promise<Response> {
        const resp = await fetch(this.buildRequestUrl());
        return resp.json();
    }

    public static async downloadModPak(url: string): Promise<ArrayBuffer> {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await response.arrayBuffer();

        return data;
        // await window.__TAURI__.invoke('save_file', { fileData: Array.from(new Uint8Array(data)), filename });
    }

    public static async downloadModList(url: string) {

        return Promise.resolve({
            "id": 4559377,
            "game_id": 2475,
            "status": 1,
            "visible": 1,
            "submitted_by": {
                "id": 13558511,
                "name_id": "dr-prof-artist",
                "username": "Dr._Prof._Artist",
                "display_name_portal": null,
                "date_online": 1734408780,
                "date_joined": 1663109433,
                "avatar": {
                    "filename": "c8afe1a9c88b540b17d67899667e2de.jpg",
                    "original": "https://image.modcdn.io/members/343a/13558511/c8afe1a9c88b540b17d67899667e2de.jpg",
                    "thumb_50x50": "https://thumb.modcdn.io/members/343a/13558511/crop_50x50/c8afe1a9c88b540b17d67899667e2de.jpg",
                    "thumb_100x100": "https://thumb.modcdn.io/members/343a/13558511/crop_100x100/c8afe1a9c88b540b17d67899667e2de.jpg"
                },
                "timezone": "",
                "language": "",
                "profile_url": "https://mod.io/u/dr-prof-artist"
            },
            "date_added": 1734314930,
            "date_updated": 1734314991,
            "date_live": 1734314991,
            "maturity_option": 0,
            "community_options": 1025,
            "credit_options": 722,
            "monetization_options": 0,
            "stock": 0,
            "price": 0,
            "tax": 0,
            "logo": {
                "filename": "caveleechinsanity.png",
                "original": "https://image.modcdn.io/mods/174a/4559377/caveleechinsanity.png",
                "thumb_320x180": "https://thumb.modcdn.io/mods/174a/4559377/crop_320x180/caveleechinsanity.png",
                "thumb_640x360": "https://thumb.modcdn.io/mods/174a/4559377/crop_640x360/caveleechinsanity.png",
                "thumb_1280x720": "https://thumb.modcdn.io/mods/174a/4559377/crop_1280x720/caveleechinsanity.png"
            },
            "homepage_url": null,
            "name": "Cave Leech Insanity",
            "name_id": "cave-leech-insanity",
            "summary": "This mod adds the Virtual Insanity intro, when the leech comes after you, along with the Family Guy version when it grabs you.",
            "description": "<p>This mod adds the Virtual Insanity intro, when the leech comes after you, along with the Family Guy version when it grabs you.</p>",
            "description_plaintext": "This mod adds the Virtual Insanity intro, when the leech comes after you, along with the Family Guy version when it grabs you.\n",
            "metadata_blob": null,
            "profile_url": "https://mod.io/g/drg/m/cave-leech-insanity",
            "media": {
                "youtube": [
                    "https://www.youtube.com/watch?v=IF4k7qYsAg8"
                ],
                "sketchfab": [],
                "images": [
                    {
                        "filename": "caveleechinsanity.1.png",
                        "original": "https://image.modcdn.io/mods/174a/4559377/caveleechinsanity.1.png",
                        "thumb_320x180": "https://thumb.modcdn.io/mods/174a/4559377/crop_320x180/caveleechinsanity.1.png",
                        "thumb_1280x720": "https://thumb.modcdn.io/mods/174a/4559377/crop_1280x720/caveleechinsanity.1.png"
                    }
                ]
            },
            "modfile": {
                "id": 5870151,
                "mod_id": 4559377,
                "date_added": 1734314989,
                "date_updated": 0,
                "date_scanned": 1734314994,
                "virus_status": 1,
                "virus_positive": 0,
                "virustotal_hash": null,
                "filesize": 1989618,
                "filesize_uncompressed": 2060742,
                "filehash": {
                    "md5": "bb9ef0f1a5a3d2d0d3393fd24ec11095"
                },
                "filename": "cave_leech_insanity_p-3eum.zip",
                "version": "1.0.0",
                "changelog": null,
                "metadata_blob": null,
                "download": {
                    "binary_url": "https://g-2475.modapi.io/v1/games/2475/mods/4559377/files/5870151/download/330245ebee0779b5e4ca65167470b8bb",
                    "date_expires": 1734516348
                },
                "platforms": []
            },
            "dependencies": false,
            "platforms": [],
            "metadata_kvp": [],
            "tags": [
                {
                    "name": "1.39",
                    "name_localized": "1.39",
                    "date_added": 0
                },
                {
                    "name": "Audio",
                    "name_localized": "Audio",
                    "date_added": 0
                },
                {
                    "name": "Auto-Verified",
                    "name_localized": "Auto-Verified",
                    "date_added": 0
                },
                {
                    "name": "[AimedForVerified]",
                    "name_localized": "[AimedForVerified]",
                    "date_added": 0
                },
                {
                    "name": "Optional",
                    "name_localized": "Optional",
                    "date_added": 0
                }
            ],
            "stats": {
                "mod_id": 4559377,
                "popularity_rank_position": 782,
                "popularity_rank_total_mods": 6739,
                "downloads_today": 5,
                "downloads_total": 17,
                "subscribers_total": 21,
                "ratings_total": 5,
                "ratings_positive": 5,
                "ratings_negative": 0,
                "ratings_percentage_positive": 100,
                "ratings_weighted_aggregate": 0.57,
                "ratings_display_text": "Positive",
                "date_expires": 1734598841
            }
        });
    }

    public static async getModioApi() {
        `/games/${GAME_ID}/mods/events`
    }

}

export default ModioApi;

