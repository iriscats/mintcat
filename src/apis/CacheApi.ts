import {writeFile, size} from "@tauri-apps/plugin-fs";

const CACHE_PATH = "/Users/bytedance/Desktop/data/";

class CacheApi {

    public constructor() {
    }

    public static getModCachePath(modName: string): string {
        return `${CACHE_PATH}${modName}.zip`;
    }

    public static async saveCacheFile(modName: string, data: Uint8Array): Promise<any> {
        const fileName = CacheApi.getModCachePath(modName);
        try {
            await writeFile(fileName, data);
            return fileName;
        } catch (error) {
            console.error(`Failed to write file ${modName}: ${error}`);
        }
    }

    public static async checkCacheFile(modName: string, fileSize: number): Promise<boolean> {
        const fileName = CacheApi.getModCachePath(modName);
        try {
            const _fileSize = await size(fileName);
            console.log(fileSize, _fileSize);
            if (_fileSize === fileSize) {
                return true;
            }
        } catch (error) {
            console.error(error);
        }
        return false;
    }

    public async loadModCache() {
        return Promise.resolve({
            "version": "0.0.0",
            "cache": {
                "modio": {
                    "type": "ModioCache",
                    "mod_id_map": {
                        "ammo-percentage-indicator": 2613099,
                        "u393": 4442796,
                        "boss-hp-bar-for-big-enemies": 3074337,
                        "frozen-impact-particles-fps-fix": 2285617,
                        "aichis-beer-selector": 2965513,
                        "mod-hub": 1792770,
                        "custom-difficulty": 1861561,
                        "low-poly-model-enemies": 4189145,
                        "more-fov": 1150682,
                        "drglib": 1034237,
                        "sandbox-utilities": 1897251,
                        "displays-deep-scan-crystal-on-the-terrain-scanner": 4078277,
                        "monster-quantity-display": 3363051,
                        "brighter-objects": 1179441
                    },
                    "modfile_blobs": {
                        "4904179": "1711e29ae8ad1d851ac53078505fd50fbe3d90394f6356b5cd4bc047b09149d5",
                        "2854478": "97d33c39bc06c6bff88f3c7bbcea23fbaedfa797ef28685d3d589bcb174a951d",
                        "4497737": "3767a79bd08b24ed53638adf5cdfffc2d071bac0484cde75c27d871fca6dafe8",
                        "5576368": "24099733efe4581c9a9deefc569f92dbd3856b00e53d7728d17c056d1f461281",
                        "5740904": "5ae8013d2f272e98715e9302d7aca0bfda4b1ed499d4fb807c4fd78f49bffd2e",
                        "5711902": "dc75da1cedfee4c9ca4d5158528d3f232de8b2a00aa208cd499bd74fee9003ea",
                        "5356742": "8ee3a02f6ae31dbd3235e13c0be51677df1d5f5f495cde4477c31007b44e010e",
                        "5377680": "b861aac8064faaba4b03ec297d91a56601cab0f4e34df3080956ba0288868c07",
                        "5233422": "ca497a140eb528c5a313292aaded53f0fdf39dc2b830d31f842e36f4ea9a4d2a",
                        "4916540": "8e4c6aaa7c9782a9838a8c4e0bc2546c76d1b6e95abacb4308dd611982bfa74b",
                        "3797254": "500eed7060b1cccf398ea8cab45235c3a0c03a3a6350f0e9957b1d97e00af382",
                        "3179770": "8cdf64420f8d15b0d03fc894fd33b93926a49a6dcd3171aff4a413e5a3f67f2f",
                        "2519105": "54cf266473104a59c9d0504c9920cc7906999c2eb635dc143f5bead40ba4cc4a",
                        "3716174": "3b89b4a9d445ddaaa96201fba28822b255095271678b719144fdca9eaf06e15a"
                    },
                    "dependencies": {
                        "2613099": [],
                        "4078277": [],
                        "4189145": [],
                        "4442796": [],
                        "1179441": [],
                        "1792770": [],
                        "3074337": [],
                        "1861561": [],
                        "1897251": [
                            1034237
                        ],
                        "3363051": [],
                        "2965513": [
                            1792770
                        ],
                        "1150682": [],
                        "1034237": [],
                        "2285617": []
                    },
                    "mods": {
                        "1179441": {
                            "name_id": "brighter-objects",
                            "name": "Brighter Objects",
                            "latest_modfile": 5711902,
                            "modfiles": [
                                {
                                    "id": 1507310,
                                    "date_added": 1632934338,
                                    "version": "1.0",
                                    "changelog": "The two mods \"Brighter Secondary Objects\" and \"Brighter Embedded Enor and Gold\" were merged into one mod."
                                },
                                {
                                    "id": 1849698,
                                    "date_added": 1636030106,
                                    "version": "1.1",
                                    "changelog": "• Fixed: Update 35 (Season 01) caused the mod to crash.\n\n• The rock the fossil is embedded (part of the fossil which is collectable) now also lights. Not just the center of the fossil (blue part)."
                                },
                                {
                                    "id": 2024426,
                                    "date_added": 1639442427,
                                    "version": "1.2",
                                    "changelog": "Added: The shimmer brightness of the primary objective Morkite got increased."
                                },
                                {
                                    "id": 2035292,
                                    "date_added": 1639786915,
                                    "version": "1.2.1",
                                    "changelog": "Morkite shimmer adjustments."
                                },
                                {
                                    "id": 2046917,
                                    "date_added": 1640021475,
                                    "version": "1.3",
                                    "changelog": "Adjustments:\n• BooloCap: Now much better visible from sides.\n• Fossils: Front light power got reduced a bit but light from sides got increased. Now better visible from all sides. Also, it looks more beautiful in darkness.\n\nAdded:\n• The brightness of the resource chunks from Nitra, Gold, Morkite, Croppa and Dystrum got increased."
                                },
                                {
                                    "id": 2056098,
                                    "date_added": 1640209727,
                                    "version": "1.4",
                                    "changelog": "Added:\n• The brightness of the primary objective Oil Shale got increased.\n• The brightness of the secondary objective Hollomite got increased.\n• The brightness of the minerals Croppa, Bismor, Magnite and Umanite got increased.\n• The brightness of the resource chunk from Red Sugar got increased."
                                },
                                {
                                    "id": 2061016,
                                    "date_added": 1640299753,
                                    "version": "1.5",
                                    "changelog": "Added:\nThe flashing light brightness of the primary objective Alien Egg got increased."
                                },
                                {
                                    "id": 2088868,
                                    "date_added": 1640790198,
                                    "version": "1.6",
                                    "changelog": "• Adjusted Gunk Seed (on ground) brightness. It is now better visible from the sides but less intense when viewed from above.\n• Increased brightness from Yeast Cone to be better visible from sides."
                                },
                                {
                                    "id": 2394059,
                                    "date_added": 1647982970,
                                    "version": "1.7",
                                    "changelog": "• Fossil color and light method changed. Better recognizable in the light and better looking.\n• Ebonut shell glows now (only first hit). Increases visibility from sides.\n• Gunk Seed Hanger complete surface glows now. Increases visibility from sides. Lowered the extreme light from below."
                                },
                                {
                                    "id": 2438478,
                                    "date_added": 1649163689,
                                    "version": "1.7.1",
                                    "changelog": "Fixed crash caused by the Easter event:\nAlien Egg adjustments temporary removed."
                                },
                                {
                                    "id": 2501830,
                                    "date_added": 1650654130,
                                    "version": "1.8",
                                    "changelog": "• The brightness of the Alien Egg itself got increased.\n• Enor wall debris brightness and density increased. Now better recognizable in the light.\n• Compressed Gold wall debris density increased and brightness adjustments."
                                },
                                {
                                    "id": 2517520,
                                    "date_added": 1651092399,
                                    "version": "1.9",
                                    "changelog": "• Compatibility update for Season 02 (Update 36).\n• Increased the chunk brightness of Phazyonite and Enor.\n• Changed the chunk light color of Phazyonite, Morkite, Hollomite, Magnite and Bismor to better fitting colors."
                                },
                                {
                                    "id": 2519075,
                                    "date_added": 1651149356,
                                    "version": "1.9.1",
                                    "changelog": "Crash/Blackscreen fix."
                                },
                                {
                                    "id": 2533533,
                                    "date_added": 1651506397,
                                    "version": "1.9.2.1",
                                    "changelog": "Season 02: Patch 1 - Crash fix"
                                },
                                {
                                    "id": 2540763,
                                    "date_added": 1651762109,
                                    "version": "1.9.3",
                                    "changelog": "Season 02: Patch 2 - Crash fix"
                                },
                                {
                                    "id": 3068989,
                                    "date_added": 1667484304,
                                    "version": "1.10",
                                    "changelog": "- Season 03 - Crash fix\n- Jadiz chunk glow brightness increased.\n- Mini-M.U.L.E. leg sphere redesigned for better visibility."
                                },
                                {
                                    "id": 3112465,
                                    "date_added": 1667928021,
                                    "version": "1.10.1",
                                    "changelog": "Season 03: Patch 2 - Crash fix"
                                },
                                {
                                    "id": 3120800,
                                    "date_added": 1668084598,
                                    "version": "1.10.2",
                                    "changelog": "Season 03: Patch 3 - Crash fix"
                                },
                                {
                                    "id": 3121208,
                                    "date_added": 1668094048,
                                    "version": "1.10.3",
                                    "changelog": "Season 03: Hotfix 3.1 - Crash fix"
                                },
                                {
                                    "id": 3125448,
                                    "date_added": 1668173376,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 3150454,
                                    "date_added": 1668525620,
                                    "version": "1.10.4",
                                    "changelog": "Season 03: Patch 4 - Crash fix"
                                },
                                {
                                    "id": 3213294,
                                    "date_added": 1669641949,
                                    "version": "1.10.5",
                                    "changelog": "Bug fix: Yeast cone was not loaded correctly."
                                },
                                {
                                    "id": 3251326,
                                    "date_added": 1670509250,
                                    "version": "1.10.6",
                                    "changelog": "Season 03: Patch 9 - Crash fix"
                                },
                                {
                                    "id": 3279155,
                                    "date_added": 1671127853,
                                    "version": "1.10.7",
                                    "changelog": "Season 03: Patch 10 - Crash fix"
                                },
                                {
                                    "id": 3401256,
                                    "date_added": 1673358213,
                                    "version": "1.10.8",
                                    "changelog": "Season 03: Patch 11 - Crash fix"
                                },
                                {
                                    "id": 3588762,
                                    "date_added": 1677765251,
                                    "version": "1.10.9",
                                    "changelog": "Season 03: Patch 14 - Crash fix"
                                },
                                {
                                    "id": 3589113,
                                    "date_added": 1677775902,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 3661112,
                                    "date_added": 1679582158,
                                    "version": "1.10.10",
                                    "changelog": "Season 03: Patch 15 - Crash fix"
                                },
                                {
                                    "id": 3930532,
                                    "date_added": 1686777843,
                                    "version": "1.10.11",
                                    "changelog": "Season 04 - Crash fix"
                                },
                                {
                                    "id": 5236732,
                                    "date_added": 1718356168,
                                    "version": "1.10.12.1",
                                    "changelog": "Season 05 - Crash fix"
                                },
                                {
                                    "id": 5319177,
                                    "date_added": 1720292462,
                                    "version": "1.11",
                                    "changelog": "Added:\n• Resource Bag\n• Bha Barnacle\n• Glyphid Egg\n• Core Stone (shell)"
                                },
                                {
                                    "id": 5711902,
                                    "date_added": 1729948824,
                                    "version": "1.12",
                                    "changelog": "Added:\n• User Interface\n• Light modes: \"Soft\" and \"Intense\"\n\nSoft mode support:\n⋄ Alien Egg\n⋄ Alien Fossil\n⋄ Boolo Cap\n⋄ Ebonut\n⋄ Gunk Seed\n⋄ Enor\n⋄ Compressed Gold"
                                }
                            ],
                            "tags": [
                                "1.39",
                                "Visual",
                                "QoL",
                                "Verified"
                            ]
                        },
                        "1792770": {
                            "name_id": "mod-hub",
                            "name": "Mod Hub",
                            "latest_modfile": 4904179,
                            "modfiles": [
                                {
                                    "id": 4904179,
                                    "date_added": 1709786271,
                                    "version": "1.2.5",
                                    "changelog": "- Removed the enemy cap settings.\n- Fixed the player cap feature self-activating in non-approved modded lobbies."
                                }
                            ],
                            "tags": [
                                "Optional",
                                "Verified",
                                "Framework",
                                "1.39"
                            ]
                        },
                        "4078277": {
                            "name_id": "displays-deep-scan-crystal-on-the-terrain-scanner",
                            "name": "Displays Deep Scan Crystal on the terrain scanner",
                            "latest_modfile": 5576368,
                            "modfiles": [
                                {
                                    "id": 5236192,
                                    "date_added": 1718337120,
                                    "version": "1.0.0",
                                    "changelog": null
                                },
                                {
                                    "id": 5306611,
                                    "date_added": 1719989158,
                                    "version": "1.1.0",
                                    "changelog": "Fix the crash caused by the S05.04.01 update"
                                },
                                {
                                    "id": 5576368,
                                    "date_added": 1726486088,
                                    "version": "2.0.0",
                                    "changelog": "- (hopefully) fixed the client disconnect issue\n- Add a wider range of blue light to the crystal"
                                }
                            ],
                            "tags": [
                                "1.39",
                                "QoL",
                                "Optional",
                                "Visual",
                                "Sandbox"
                            ]
                        },
                        "2285617": {
                            "name_id": "frozen-impact-particles-fps-fix",
                            "name": "Frozen Impact Particles FPS Fix",
                            "latest_modfile": 2854478,
                            "modfiles": [
                                {
                                    "id": 2854478,
                                    "date_added": 1660695922,
                                    "version": "1.0.0",
                                    "changelog": "• Initial release."
                                }
                            ],
                            "tags": [
                                "1.39",
                                "Verified",
                                "QoL",
                                "1.37",
                                "Visual",
                                "Optional",
                                "1.38"
                            ]
                        },
                        "4442796": {
                            "name_id": "u393",
                            "name": "去粒子除武器泥土U39",
                            "latest_modfile": 5740904,
                            "modfiles": [
                                {
                                    "id": 5711000,
                                    "date_added": 1729924583,
                                    "version": "1.39.1",
                                    "changelog": null
                                },
                                {
                                    "id": 5719423,
                                    "date_added": 1730106250,
                                    "version": "1.39.1.1",
                                    "changelog": "保留Crawler死亡毒云特效（Puddle）"
                                },
                                {
                                    "id": 5740904,
                                    "date_added": 1730705293,
                                    "version": "1.39.1.2",
                                    "changelog": "保留了暴君拍地板的特效"
                                }
                            ],
                            "tags": [
                                "Optional",
                                "1.39",
                                "Visual",
                                "Verified"
                            ]
                        },
                        "4189145": {
                            "name_id": "low-poly-model-enemies",
                            "name": "Low-poly model Enemies",
                            "latest_modfile": 5377680,
                            "modfiles": [
                                {
                                    "id": 5377680,
                                    "date_added": 1721611262,
                                    "version": "0.0.1",
                                    "changelog": "beta"
                                }
                            ],
                            "tags": [
                                "1.39",
                                "Auto-Verified",
                                "Visual",
                                "QoL"
                            ]
                        },
                        "3363051": {
                            "name_id": "monster-quantity-display",
                            "name": "Enemy count monitor/怪物数量显示",
                            "latest_modfile": 4497737,
                            "modfiles": [
                                {
                                    "id": 4497737,
                                    "date_added": 1699537574,
                                    "version": "3.45",
                                    "changelog": null
                                }
                            ],
                            "tags": [
                                "Verified",
                                "1.37",
                                "Tools",
                                "1.38"
                            ]
                        },
                        "1897251": {
                            "name_id": "sandbox-utilities",
                            "name": "Sandbox Utilities",
                            "latest_modfile": 4916540,
                            "modfiles": [
                                {
                                    "id": 2367061,
                                    "date_added": 1647203569,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2368328,
                                    "date_added": 1647269161,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2389532,
                                    "date_added": 1647819856,
                                    "version": null,
                                    "changelog": "- Add button to enable drop pod call button on the mule"
                                },
                                {
                                    "id": 2412441,
                                    "date_added": 1648453718,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2443053,
                                    "date_added": 1649308018,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2454510,
                                    "date_added": 1649574680,
                                    "version": null,
                                    "changelog": "- Remove printed warnings when selecting EnemyDescriptors\n- Sort EnemyDescriptors\n- Add option to spawn enemies on ping"
                                },
                                {
                                    "id": 2518774,
                                    "date_added": 1651130888,
                                    "version": null,
                                    "changelog": "- Update for U36"
                                },
                                {
                                    "id": 2579331,
                                    "date_added": 1652870928,
                                    "version": null,
                                    "changelog": "- Fix spawn enemy combo box being reset when switching menus\n- Fix player sometimes dying when switch class while having low HP\n- Add invulnerability toggle\n- Add toggle to disable spawned enemy AI (can get re-enabled by things like cryo thaw unfortunately)\n- Add heal function to resupply button\n- Disable some buttons that would crash the game if pressed at the wrong time\n- Add experimental free camera (bound to period key)"
                                },
                                {
                                    "id": 2581655,
                                    "date_added": 1652952290,
                                    "version": null,
                                    "changelog": "- Allow spawning enemies as client\n- Allow changing class/loadout as client\n- Allow resupplying as client\n- Allow toggling invulnerability as client\n- Allow killing all enemies as client"
                                },
                                {
                                    "id": 2582522,
                                    "date_added": 1652986252,
                                    "version": null,
                                    "changelog": "- Fix spawn on ping breaking after changing class"
                                },
                                {
                                    "id": 2584079,
                                    "date_added": 1653036777,
                                    "version": null,
                                    "changelog": "- Add keybinds for free cam movement\n- Add keybind to resupply/heal\n- Force mission success when drop pod is called manually"
                                },
                                {
                                    "id": 2584094,
                                    "date_added": 1653037911,
                                    "version": null,
                                    "changelog": "- Fix free cam point light being visible when disabled"
                                },
                                {
                                    "id": 2650079,
                                    "date_added": 1654830194,
                                    "version": null,
                                    "changelog": "- Add keybind to teleport player to free cam location\n- Increase free cam light range"
                                },
                                {
                                    "id": 2761116,
                                    "date_added": 1658040086,
                                    "version": null,
                                    "changelog": "- Add sandbox mission type\n- Add DRGLib watchers to show speed/velocity of the player and last marked enemy\n- All full bright option which adds global light, disables fog, and increases render distance of terrain\n- Fix key binds not working before Mod Hub is opened"
                                },
                                {
                                    "id": 2779505,
                                    "date_added": 1658537973,
                                    "version": null,
                                    "changelog": "- Remove AssetRegistry.bin"
                                },
                                {
                                    "id": 2845443,
                                    "date_added": 1660420428,
                                    "version": null,
                                    "changelog": "- Update common lib\n- Make \"Open equipment terminal\" menu button function outside of the space rig\n- Add very WIP creative menu for spawning actors and carving terrain"
                                },
                                {
                                    "id": 2850802,
                                    "date_added": 1660579752,
                                    "version": null,
                                    "changelog": "- Lazy load assets for creative menu"
                                },
                                {
                                    "id": 3059095,
                                    "date_added": 1667165692,
                                    "version": null,
                                    "changelog": "- Add room viewer\n- Fix lingering status overlays upon player character getting recreated\n- Add settings page for free cam pan sensitivity and FOV\n- Add keybinds for panning moving camera\n- Make all key binds configurable via DRGLib menu\n- Add equipment terminal button to loadout page\n\nCreative tab:\n- Allow setting character state\n- Allow setting scene component mobility\n- Rework setting actor and component transforms\n- Fix selected component being reset when reconstructing menu"
                                },
                                {
                                    "id": 3149454,
                                    "date_added": 1668484882,
                                    "version": null,
                                    "changelog": "- Add watcher for marked actor status effects"
                                },
                                {
                                    "id": 3176370,
                                    "date_added": 1669005889,
                                    "version": null,
                                    "changelog": "- Make enemy descriptor combobox searchable\n- Fix -sandbox CLI flag crashing\n\nInspector tool:\n- Add ability to set static mesh\n- Add ability to set materials"
                                },
                                {
                                    "id": 3176455,
                                    "date_added": 1669009724,
                                    "version": null,
                                    "changelog": "- Fix searchable combobox using wrong font"
                                },
                                {
                                    "id": 3182489,
                                    "date_added": 1669158940,
                                    "version": null,
                                    "changelog": "- Allow spawning groups of multiple types of enemies as well as elite enemies"
                                },
                                {
                                    "id": 3739356,
                                    "date_added": 1681504186,
                                    "version": null,
                                    "changelog": "- Creative Inspector: powerful pop-out windows system by AssemblyStorm with detailed material manipulation\n- Creative Inspector: now with collision channels viewing/editing\n- Creative SplineCarver: new tool by Michaelis, make smooth circular tunnels or architectural \"worms\" out of any material\n- Freecam teleporting (comma) preserves angle\n- Added a shortcut to toggle fullbright\n- Many more things"
                                },
                                {
                                    "id": 4200967,
                                    "date_added": 1692685372,
                                    "version": null,
                                    "changelog": "- Add Scripted and Normal wave timers to debug watchers\n- Remove AssetRegistry.bin\n- Fix create tools being active when they shouldn't be"
                                },
                                {
                                    "id": 4916540,
                                    "date_added": 1710096172,
                                    "version": null,
                                    "changelog": "- Implement workaround for Mod Hub introducing breaking API changes in 1.2.5"
                                }
                            ],
                            "tags": [
                                "Sandbox",
                                "1.36",
                                "1.37",
                                "Tools",
                                "1.38",
                                "RequiredByAll"
                            ]
                        },
                        "1034237": {
                            "name_id": "drglib",
                            "name": "DRGLib",
                            "latest_modfile": 3716174,
                            "modfiles": [
                                {
                                    "id": 1312216,
                                    "date_added": 1625700495,
                                    "version": "1.0.0",
                                    "changelog": "Modified settings menu to simplify page logic"
                                },
                                {
                                    "id": 1312669,
                                    "date_added": 1625713939,
                                    "version": "1.0.1",
                                    "changelog": "- Fixed a glitch with the settings menu having a second page\n - added a version indicator to the settings menu"
                                },
                                {
                                    "id": 1315088,
                                    "date_added": 1625799038,
                                    "version": "1.1.0",
                                    "changelog": "Added input handling functions\nAdded version splash to the settings menu and startup notification"
                                },
                                {
                                    "id": 1325498,
                                    "date_added": 1626145807,
                                    "version": "1.1.1",
                                    "changelog": "- Fixed issue where the settings UI was below normal game HUD elements"
                                },
                                {
                                    "id": 1338879,
                                    "date_added": 1626635152,
                                    "version": "2.0.0",
                                    "changelog": "- Modified internal structure to allow easier development\n- Added subtitle to settings UI\n- Settings UI now scales properly when mod names are too W I D E"
                                },
                                {
                                    "id": 1348992,
                                    "date_added": 1626980887,
                                    "version": "2.1.0",
                                    "changelog": "- Added support for page categories\n- Added 2 widget templates"
                                },
                                {
                                    "id": 1354124,
                                    "date_added": 1627162269,
                                    "version": "2.1.1",
                                    "changelog": "- Fixed bug where notification setting would not save properly"
                                },
                                {
                                    "id": 1396303,
                                    "date_added": 1628610795,
                                    "version": "2.2.0",
                                    "changelog": "- Implemented logging system\n- Implemented system to print messages to screen\n- Reduced default checkbox size to 16x16\n- Added a warning system when including DRGLib files"
                                },
                                {
                                    "id": 1459539,
                                    "date_added": 1630856388,
                                    "version": "2.3.0",
                                    "changelog": "Updated the fonts used in the settings menu\n\nAdded a bunch of UI templates:\n\n- A checkbox\n- A button\n- A combobox\n- A textbox\n- A warning popup\n- A spinbox\n- A custom tooltip"
                                },
                                {
                                    "id": 1969449,
                                    "date_added": 1638135126,
                                    "version": "3.0.0",
                                    "changelog": "Changelogs are for nerds also I forgot what I changed."
                                },
                                {
                                    "id": 1973447,
                                    "date_added": 1638226319,
                                    "version": "3.1.0",
                                    "changelog": "Fixed a bug where the settings window would randomly disappear\nAdded a function to check whether DRGLib is ready"
                                },
                                {
                                    "id": 1973497,
                                    "date_added": 1638226797,
                                    "version": "3.1.1",
                                    "changelog": "Fixed a bug where startup was delayed by 10 seconds\n\n(Remember to remove your test nodes kids...)"
                                },
                                {
                                    "id": 2005369,
                                    "date_added": 1638988835,
                                    "version": "3.2.0",
                                    "changelog": "Fixed a bug where the settings page wasn't visible in a mission\nAdded node \"WidgetsAreReady\""
                                },
                                {
                                    "id": 2016399,
                                    "date_added": 1639262370,
                                    "version": "3.3.0",
                                    "changelog": "- Updated color picker to allow opacity\n- Updated DRGLib Settings menu to use proper widget templates\n- Updated checkbox to minimum size 32x32\n\n- I should really figure out how to merge this and the dev branch. Now I've got a few features in each that I should really combine"
                                },
                                {
                                    "id": 2048574,
                                    "date_added": 1640046546,
                                    "version": "3.3.1",
                                    "changelog": "- Fixed DRGLib window hiding behind game widgets\n    - As a side effect, this means all windows will stay open while using the pause menu, just hide themselves\n- Fixed bug where PageOpened was called multiple times, thanks @dr. Turtle#1 !"
                                },
                                {
                                    "id": 2053118,
                                    "date_added": 1640145125,
                                    "version": "3.3.2",
                                    "changelog": "- Fixed a bug where backfill on sliders wouldn't update properly"
                                },
                                {
                                    "id": 2070348,
                                    "date_added": 1640480123,
                                    "version": "3.3.3",
                                    "changelog": "Modified window behavior to prevent reconstruction of widgets"
                                },
                                {
                                    "id": 2152160,
                                    "date_added": 1642107062,
                                    "version": "3.4.0",
                                    "changelog": "New features:\n - Widget \"IntSlider\"\n   - A slider that snaps to specific values. Works best with 10 or fewer options\n - Widget \"TreeView\"\n   - A tree view widget that helps simplify making a nice looking treeview\n - Overhauled logging system\n   - Logs now save on every line\n   - Can save logs from previous sessions\n   - Can more reliably detect a new session to restart the log\n - Converted many nodes to \"Pure\" functions\n   - I would have done this sooner but I worried it would break compatibility. Turns out it just works, so that's nice\n- Implemented array sorting functions\n  - As of now you can sort an array of objects using a custom compare function\n  - You can also sort strings\n   \n   \n Bug fixes:\n - Fixed bug where DRGLib would often fail to load as a client\n - Fixed bug where DRGLib would often fail to load when entering spacerig after a mission"
                                },
                                {
                                    "id": 2152960,
                                    "date_added": 1642118430,
                                    "version": "3.4.1",
                                    "changelog": "Updated sorting functions to use interface calls instead of messages"
                                },
                                {
                                    "id": 2153943,
                                    "date_added": 1642137668,
                                    "version": "3.4.2",
                                    "changelog": "Added a GetValue node to LIB_WT_Combobox\n\nDefinitely shoulda been there the whole time. Whoops"
                                },
                                {
                                    "id": 2182953,
                                    "date_added": 1642732700,
                                    "version": "3.5.0",
                                    "changelog": "- Improved window ducking behavior\n  - Windows should now properly duck out of the way of the game's pause menu and similar Windows\n- Added RemoveItem to LIB_WT_TreeView\n- Added GetSelectedIndex and SetSelectedIndex to LIB_WT_Combobox\n- Added node AddRawLogEntry"
                                },
                                {
                                    "id": 2211351,
                                    "date_added": 1643421652,
                                    "version": "3.6.0",
                                    "changelog": "|- New features: \n|  - Added LIB_WT_ImageButton\n|  - Added LIB_DEB_A_DebugWatch\n|    - Allows for tracking variables/functions in real time (When set up for them)\n|    - Includes a robust system to switch which variables you want to watch\n|    - Open by pressing \"F3\" by default\n|  - Added LIB_I_CustomTreeViewWidget to allow a treeview to spawn a widget for each entry, not just those with held objects\n|    - There has been an event dispatcher named \"GenericCustomWidgetGenerated\", to allow for passing data to these generated widgets\n|    - Renamed \"CustomWidget\" to \"UniqueWidget\" on AddItem. This will cause minor compatibility issues, but shouldn't be mod-breaking\n|  - Added a \"Popup\" flag on draggablewindows, meaning they close themselves on losing focus\n\n|- Changes:\n|   - Improved automation Bats\n|   - Modified LIB_WC_TreeViewEntry so that custom widgets fill all available space\n|   - DraggableWindows in the background now go \"Dormant\" with a slight dark overlay. I'm not super happy with how this works but it was necessary for the popup window behavior\n|   - Fixed LIB_WT_WarningPopup behavior\n|     - Turns out it ignored the timer, whoops!"
                                },
                                {
                                    "id": 2221094,
                                    "date_added": 1643589520,
                                    "version": "3.7.0",
                                    "changelog": "|- Added function \"TimeSpanToString\"\n|- Added function \"QuickSortFloatArray\"\n|- Added description to entries in the debug HUD watch selection page\n|- Moved DRGLib settings page to avoid confusion by stacking it with the category\n|- Modified logging behavior\n|  - Logs will now always save with a date/time name, instead of the most recent log being saved to \"ActiveLog\"\n|  - Log entries now have a timestamp\n|- Added function \"GetDRGLibVersion\""
                                },
                                {
                                    "id": 2225919,
                                    "date_added": 1643745268,
                                    "version": "3.7.1",
                                    "changelog": "- Added new debug page to help track down an interesting bug\n- Added new watches to Default profile"
                                },
                                {
                                    "id": 2228032,
                                    "date_added": 1643809604,
                                    "version": "3.7.2",
                                    "changelog": "Reupload of 3.7.2 because I had an epic version control fail"
                                },
                                {
                                    "id": 2228216,
                                    "date_added": 1643817069,
                                    "version": "3.7.3",
                                    "changelog": "Added experimental feature to spawn failed actors from other mods"
                                },
                                {
                                    "id": 2228247,
                                    "date_added": 1643818292,
                                    "version": "3.7.4",
                                    "changelog": "Fixed failsafe window not popping up on starting mission properly"
                                },
                                {
                                    "id": 2228909,
                                    "date_added": 1643833943,
                                    "version": "3.7.5",
                                    "changelog": "- Modified behavior of failsafe popup, is now a proper popup window\n- Fixed Fixed TimeSpanToString and IntToStringWithLeadingZeroes for negative values"
                                },
                                {
                                    "id": 2228933,
                                    "date_added": 1643834296,
                                    "version": "3.7.6",
                                    "changelog": "Make sure you test your updates before posting them, kids"
                                },
                                {
                                    "id": 2228962,
                                    "date_added": 1643834747,
                                    "version": "3.7.7",
                                    "changelog": "You know what I should really do? Follow my own advice"
                                },
                                {
                                    "id": 2405563,
                                    "date_added": 1648316873,
                                    "version": "4.0.0",
                                    "changelog": "THIS UPDATE WILL BREAK MOST DRGLIB-DEPENDENT MODS\n\nFeature/broad changes: \n|- Removed settings page support and all related objects\n|  - If ya want a settings page use ModHub\n|- Moved all settings to ModHub\n|- Added LIB_WT_ExpandableArea\n|- Updated all widget templates to use a base class\n|  - This includes a \"Color Modifier\" system that allows defining colors based on the foreground color\n|- Added macro \"WaitForWidgetsReady\"\n|- Added interface \"LIB_I_DRGLib\"\n|  - When added to an actor this interface will inform said actor when DRGLib is ready\n|  - The DRGLibStartupComplete event is guaranteed to only be called once per actor\n|- Increased setup speed.\n|  - DRGLib will now be ready in the same frame as when it is spawned, assuming I understand UE execution order correctly\n|  - NOTE: DRGLib is one of the (Usually **the**) first mod(s) spawned by the game. As of yet I have not found a satisfactory way to call DRGLibStartupComplete without waiting one frame. If you require instant response (You don't, but hypothetically you might) then call \"UpdateInformedActors\" off of a LIB_A_Main reference\n|- Brought Compile warnings for DRGLib blueprints to 0\n|  - Unfortunately as a consequence of using the header dumps compile warnings are still ridiculously high\n|- Removed startup notification\n|  - With no bindings to show, not much call for it\n|\n|Tags for comprehensive changelist:\n|[N] Changed in a non-compatibility breaking way\n|[B]Changed in a compatibility breaking way\n|[-] Removed (Will obviously break compatibility)\n|[+] Added\n|\n|\"Comprehensive\" changelist:\n|(Many changes were purely internal and should not have any relevance to anyone, or appreciably affect behavior. It's enough work doing this much :P)\n|- [N] LIB_F_DRG\n|  - Fixed bug where \"GetLocalPlayerController\" would get controller from previous scene\n|  - Switched test widget from \"WidgetsAreReady\"\n|- [N] LIB_DEB_O_ValueHolder\n|  - Switched RequestNewValue to stop using a pass-by-ref object\n|    - Prevents compile errors\n|- [N] LIB_W_DraggableWindow\n|  - Removed overlay button. Popup windows now use the focus path to determine when to self-close\n|    - This means that windows in the background should no longer require a second click for children to function\n|- [N] LIB_A_WindowManager\n|  - Keeps track of ModHub when determining input state on closing last window\n|  - Keeps LIB_A_WindowHolder non-hittestable unless actively dragging a window. This should prevent further issues with widgets underneath the window layer\n|  - Places LIB_A_WindowHolder on layer 10001 to make sure windows appear over modHub (Thanks Gold...)\n|  - Uses input mode UIOnly when first window is placed onscreen, instead of Game and UI\n|- [N] LIB_A_InputManager\n|  - No longer loads all saved custom inputs. Will only load after calling AddCustomAction in \"LIB_F_Input\"\n|    - This is to avoid a large list of inputs when mods not using them are disabled\n| - Now stores a list of active custom inputs in self, instead of reading directly from save\n|- [N] LIB_F_Input\n|  - Updated implementation to work with new LIB_A_InputManager\n|- [N] LIB_O_InputSave\n|  - No longer saves full custom input, only saves name+override key\n|    - This is so that the modder can change overlap behavior at a later date and won't get stuck with weird input saves\n|- [N] LIB_E_LogSeverity\n|  - Added level \"InfoNoPrint\"\n|    - This is so that the print manager can log attempted prints without getting stuck in a loop\n|- [N] LIB_F_Main\n|  - Fixed bug where DateTimeToString would break when using milliseconds\n|- [+] LIB_I_DRGLib\n|  - currently includes single function; this function is called when DRGLib finishes setup\n|    - Due to current spawn logic, DRGLib is spawned before every other mod. The startup function is called after a 1 frame delay\n| - If you require a spawn-frame usage of a DRGLib function (You probably don't), then call UpdateInformedActors on a LIB_A_Main reference\n|- [+] LIB_M_BasicActorMacros\n|  - Contains WaitForWidgetsReady, which requires an actor context for delays to work properly\n|- [N] LIB_A_ModInfo\n|  - Calls \"UpdateInformedActors\" on LIB_A_Main after spawning mods through failsafe, to ensure that DRGLib dependent mods work\n|- [-] LIB_W_ModInfoPage\n|- [N] LIB_A_PrintManager\n|  - When attempting to print before the widget is ready, will save failed attempt to log\n|- [-] LIB_A_SettingsManager\n|  - RIP all settings stuff. Use ModHub\n|- [-] LIB_E_ListObjectType\n|- [-] LIB_F_SettingsFunctions\n|- [-] LIB_I_SettingsPage\n|- [-] LIB_O_PageListViewDataHolder\n|- [-] LIB_O_SettingsManagerSave\n|- [-] LIB_W_LiterallyJustALeftAlignedImage\n|- [-] LIB_W_Notification\n|- [-] LIB_W_PageHost\n|- [-] LIB_W_PageList\n|- [-] LIB_W_UIMainSettingsPage\n|- [N] LIB_F_Sort\n|  - Fixed bug where CompareString prioritized capital letters\n|- [B]LIB_WT_Button\n|  - Rebased to LIB_WT_Base\n|  - [B]Removed variable ButtonColor\n|  - [B]Switched ButtonText to text instead of string\n|- [B]LIB_WT_CheckBox\n|  - Rebased to LIB_WT_Base\n|  - [B]Removed variable CheckboxColor\n|- [B]LIB_WT_ColorPicker\n|  - Rebased to LIB_WT_Base\n|  - [B]Renamed function \"ChangeSelectedColor\" to \"SetSelectedColor\"\n|  - [B]Renamed function \"UpdateColorPreview\" to \"UpdateDisplayedValue\"\n|  - [+] Added event dispatcher OnChangesConfirmed\n|- [B]LIB_WT_ComboBox\n|  - [B]Removed variable ComboBoxColor\n|  - [B]Switched DefaultOptions to being read only\n|  - Gave it a spit polish. Actually looks ok now\n|- [+] LIB_WT_ExpandableArea\n|  - It's pretty cool :)\n|- [B]LIB_WT_ImageButton\n|  - [B]Switched variable \"Image\" from a Slate brush to a texture2D\n|- [B]LIB_WT_InputKeySelector\n|  - [B]Removed variable KeySelectorColor\n|  - [+] Added variable \"DefaultAction\"\n|    - The IKS will now automatically create a DRGLib managed input action if one is not found on initialization\n|- [B]LIB_WT_IntSlider\n|  - [B]Removed variable SliderColor\n|  - Fixed bug where slider would call OnValueChanged every time mouse moved, instead of only when the value changed\n|  - [B]Removed function UpdateSliderColor\n|- [+] LIB_W_WidgetTemplateBase\n|  - Of note is the function \"UpdateWidgetStyle\". Each widget template overrides this function to ensure a standardized method of updating. At a later date this may be expanded to UI-wide styles; I dunno\n|- [B]LIB_WT_Slider\n|  - [B]Removed variable SliderColor\n|  - [B]Renamed function SetFillPercent to SetPercent\n|- [B]LIB_WT_Spinbox\n|  - [B]Removed variable SpinboxColor\n|  - [N] Min and Max value are no longer read only\n|  - Now scales dragging based on how quickly your mouse is moving\n|- [B]LIB_WT_Textbox\n|  - [B]Removed variable TextBoxColor\n|- [B]LIB_WT_TreeView\n|  - [B]Removed UniqueWidget from AddItem\n|  - A custom widget is now generated for each list widget, not each inserted object\n|  \n|  *whew*, that was a lot. I should make more comprehensive commit messages so I don't gotta look through and remember what I did lol\n|"
                                },
                                {
                                    "id": 2407536,
                                    "date_added": 1648344634,
                                    "version": "4.0.1",
                                    "changelog": "|- [N] Corrected bug where log output text was editable\n|- [-] Removed unused object LIB_W_LodDisplayPage\n|- [N] Unbound LIB_WT_Combobox's OnWidgetGenerated binding\n|  - This is to resolve a crash that could occasionally occur\n|  - This does mean that LIB_WT_Combobox will not currently use the FontSize variable. A proper fix is forthcoming"
                                },
                                {
                                    "id": 2410434,
                                    "date_added": 1648408002,
                                    "version": "4.0.2",
                                    "changelog": "|- [N] Fixed bug where AddActionMapping wouldn't properly overwrite input.ini\n|- [I]Reorganized testing setup\n|  - TestMap is now inside TestMod folder\n|  - TestMod reorganized to be a bit more modular\n|  - TestInit now spawns InitCave instead of InitSpacerig actors\n|"
                                },
                                {
                                    "id": 2417943,
                                    "date_added": 1648651879,
                                    "version": "4.1.0",
                                    "changelog": "|- [+] Added function \"GetModVersion\"\n|- [N] LIB_WT_WarningPopup\n|  - Now centers popup above the center of the anchor, instead of to the right\n|  - Now wraps text when getting overly long\n|- [N] LIB_WT_InputKeySelector\n|  - [N] No longer locks mouse to bounds while selecting a key\n|- [N] LIB_WT_Combobox\n|  - [N] Completely rewrote combobox under the hood, since apparently allowing us to customize font at runtime is just *too hard* for epic to do themselves\n|  - [+] added function \"SetSelectedIndex\"\n|  - [I][+] Added MenuOptions and SelectedIndex private variables\n|  - [I][+] Added LIB_WC_ComboboxMenu and LIB_WC_ComboboxMenuItem\n|  - [+] added function \"SetOptions\"\n|  - [+] added function \"UpdateDisplayedValues\"\n|- [N] Updated GetDRGLibVersion to pull from mod.io instead of a packed in file\n|  - [I]This also means DAUM has been removed from the automation folder\n|- [I]Reorganized testing folder\n|  - Now holds TestMap instead of it being in the maps folder"
                                },
                                {
                                    "id": 2418542,
                                    "date_added": 1648665526,
                                    "version": "4.2.0",
                                    "changelog": "|- [N] LIB_WT_Combobox\n|  - [+] all the setter functions now have an option to call UserChangedSelection\n|  - [N] Fixed UserChangedSelection not being called at all"
                                },
                                {
                                    "id": 2446683,
                                    "date_added": 1649433659,
                                    "version": "4.2.1",
                                    "changelog": "|- LIB_WT_InputKeySelector\n|  - [N] Fixed bug where it wouldn't print overlapping custom inputs properly in AllowOverlaps mode\n|- LIB_F_Input\n|  - [N] Fixed bug where remapping custom input wouldn't properly update custom input list\n|- LIB_DEB_W_HudProfiles\n|  - [+] added button that creates an empty profile\n|- LIB_W_LogSettingsPage\n|  - [N] Improved performance of logging by updating log output widget by having it only update while visible\n|"
                                },
                                {
                                    "id": 2471443,
                                    "date_added": 1649961750,
                                    "version": "4.2.2",
                                    "changelog": "Actually uploaded the correct version from my computer"
                                },
                                {
                                    "id": 2517128,
                                    "date_added": 1651081533,
                                    "version": "4.3.0",
                                    "changelog": "|- Updated for compatibility with U36\n|- Added new JSON library, courtesy of AssemblyStorm/Trumank\n|  - Can serialize to/read from strings\n|- Added new line trace debug visualization, courtesy of LesnovBrascovitch\n|- Added new custom save object using JSON\n|  - This means that the settings can be saved to the disk as JSON, making it much easier to edit large numbers of values on or distribute specific configurations\n|  - Long term, the intention is to create a widget that automatically generates an appropriate settings page for a given save object\n|- Polished many widgets\n|\n|Detailed changes:\n|- [+] LIB_F_Trace\n|  - contains function \"LineTraceByChannel(Niagara)\", which allows for visualizing a line in the 3D space of the game\n|- [+] LIB_SAV_E_PropertyType.uasset\n|  - Used by the custom save system to denote if a given property is string/int/float etc.\n|- [+] LIB_SAV_F_SaveFunctions.uasset\n|  - Includes a number of functions to manage and save the custom savegame objects\n|- [+] LIB_SAV_O_CustomSaveObject.uasset\n|- [+] LIB_SAV_S_SettingsWidgetOptions.uasset\n|  - Stores data related to auto-generating an appropriate settings widget for a given property. Currently unused\n|- [+] LIB_SAV_O_BaseProperty.uasset\n|  - Used as a base for:\n|    - [+] LIB_SAV_O_BooleanProperty.uasset\n|    - [+] LIB_SAV_O_ByteProperty.uasset\n|    - [+] LIB_SAV_O_ColorProperty.uasset\n|    - [+] LIB_SAV_O_CustomProperty.uasset\n|   - Allows for custom data using JSON, if one of the existing properties does not fit your use case\n|    - [+] LIB_SAV_O_FloatProperty.uasset\n|    - [+] LIB_SAV_O_IntProperty.uasset\n|    - [+] LIB_SAV_O_StringProperty.uasset\n|- [+] LIB_F_JSON.uasset\n|- [+] LIB_JSON_E_Type.uasset\n|  - Stores whether a JSON object is string, number, etc.\n|- [+] LIB_JSON_O_SortOrder.uasset\n|- [+] LIB_JSON_O_SortOrders.uasset\n|- [+] LIB_JSON_O_Stream.uasset\n|- [+] LIB_JSON_O_Value.uasset\n|  - The main useful part of JSON\n|- [N] LIB_WT_Slider\n|  - [+] Added GetPercent function\n|  - [+] Added StartingPercent value to LIB_WT_Slider\n|  - [N] SetPercent now clamps between 0 and 1 properly\n|  - [+] Added event dispatcher \"SliderReleased\"\n|- [N] LIB_WT_Spinbox\n|  - [N] Nudging now rounds up to the nearest factor of NudgeMultiplier\n|  - [N] the drag nudge calculation is now raised to 1.2 instead of 2, should hopefully help smooth out dragging\n|- [N] LIB_WT_IntSlider\n|  - [N] Switched GetValue to a pure function\n|  - [+] Added event dispatcher \"SliderReleased\"\n|- [N] LIB_WT_CheckBox\n|  - [+] Added boolean variable \"StartChecked\"\n|  - [N] Fixed bug where UpdateWidgetStyle wouldn't take effect until hovering the checkbox\n|  - Fixed bug where setting isChecked while the checkbox is off screen wouldn't update the widget properly\n|  - [+] added function \"UpdateDisplayedValue\""
                                },
                                {
                                    "id": 2517832,
                                    "date_added": 1651099805,
                                    "version": "4.3.1",
                                    "changelog": "|4.3.1 changes:\n|- [I]LIB_DEB_A_AdvancedWatches\n|  - Fixed bug where default profiles wouldn't populate into overlay menu\n|\n|\n|4.3.0 changes:\n|- Updated for compatibility with U36\n|- Added new JSON library, courtesy of AssemblyStorm/Trumank\n|  - Can serialize to/read from strings\n|- Added new line trace debug visualization, courtesy of LesnovBrascovitch\n|- Added new custom save object using JSON\n|  - This means that the settings can be saved to the disk as JSON, making it much easier to edit large numbers of values on or distribute specific configurations\n|  - Long term, the intention is to create a widget that automatically generates an appropriate settings page for a given save object\n|- Polished many widgets\n|\n|Detailed changes:\n|- [+] LIB_F_Trace\n|  - contains function \"LineTraceByChannel(Niagara)\", which allows for visualizing a line in the 3D space of the game\n|- [+] LIB_SAV_E_PropertyType.uasset\n|  - Used by the custom save system to denote if a given property is string/int/float etc.\n|- [+] LIB_SAV_F_SaveFunctions.uasset\n|  - Includes a number of functions to manage and save the custom savegame objects\n|- [+] LIB_SAV_O_CustomSaveObject.uasset\n|- [+] LIB_SAV_S_SettingsWidgetOptions.uasset\n|  - Stores data related to auto-generating an appropriate settings widget for a given property. Currently unused\n|- [+] LIB_SAV_O_BaseProperty.uasset\n|  - Used as a base for:\n|    - [+] LIB_SAV_O_BooleanProperty.uasset\n|    - [+] LIB_SAV_O_ByteProperty.uasset\n|    - [+] LIB_SAV_O_ColorProperty.uasset\n|    - [+] LIB_SAV_O_CustomProperty.uasset\n|   - Allows for custom data using JSON, if one of the existing properties does not fit your use case\n|    - [+] LIB_SAV_O_FloatProperty.uasset\n|    - [+] LIB_SAV_O_IntProperty.uasset\n|    - [+] LIB_SAV_O_StringProperty.uasset\n|- [+] LIB_F_JSON.uasset\n|- [+] LIB_JSON_E_Type.uasset\n|  - Stores whether a JSON object is string, number, etc.\n|- [+] LIB_JSON_O_SortOrder.uasset\n|- [+] LIB_JSON_O_SortOrders.uasset\n|- [+] LIB_JSON_O_Stream.uasset\n|- [+] LIB_JSON_O_Value.uasset\n|  - The main useful part of JSON\n|- [N] LIB_WT_Slider\n|  - [+] Added GetPercent function\n|  - [+] Added StartingPercent value to LIB_WT_Slider\n|  - [N] SetPercent now clamps between 0 and 1 properly\n|  - [+] Added event dispatcher \"SliderReleased\"\n|- [N] LIB_WT_Spinbox\n|  - [N] Nudging now rounds up to the nearest factor of NudgeMultiplier\n|  - [N] the drag nudge calculation is now raised to 1.2 instead of 2, should hopefully help smooth out dragging\n|- [N] LIB_WT_IntSlider\n|  - [N] Switched GetValue to a pure function\n|  - [+] Added event dispatcher \"SliderReleased\"\n|- [N] LIB_WT_CheckBox\n|  - [+] Added boolean variable \"StartChecked\"\n|  - [N] Fixed bug where UpdateWidgetStyle wouldn't take effect until hovering the checkbox\n|  - Fixed bug where setting isChecked while the checkbox is off screen wouldn't update the widget properly\n|  - [+] added function \"UpdateDisplayedValue\""
                                },
                                {
                                    "id": 2536256,
                                    "date_added": 1651599589,
                                    "version": "4.3.2",
                                    "changelog": "|4.3.2\n|- Fixed bug where failsafe page wouldn't appear in missions\n|\n|- [I]LIB_A_WindowManager.uasset\n|  - [N] Will now throw error if attempting to add draggable window to screen before the window holder is ready\n|- [I]LIB_A_Modinfo.uasset\n|  - [N] Will now only attempt mod failsafe *after* widgets are ready, unless auto-accept mod Failsafe is active\n|- [I]LIB_W_ModFailsafePopup.uasset\n|  - [N] Corrected foreground color so that the checkbox aint pink"
                                },
                                {
                                    "id": 2577207,
                                    "date_added": 1652798026,
                                    "version": "4.3.3",
                                    "changelog": "Mod spawn failsafe is now off by default; but it can still be reenabled or run manually\n\n- [N][I]LIB_O_ModFailsafeSettings\n  - Renamed \"FailsafeEnabled\" to \"FailsafeIsEnabled\" and switched to default false\n    - New name so that the cast of the savegame on disk always fails :P"
                                },
                                {
                                    "id": 2706144,
                                    "date_added": 1656514667,
                                    "version": "4.4.0",
                                    "changelog": "|Added new custom save object system that allows saving to near-plaintext, as well as a widget system to create a dynamic settings page for it\n|\n|- [+] Added font \"Noto Sans\"\n|  - This font family supports all languages that DRG has translations for, and is used as a fallback for the other DRGLib fonts\n|- [+] Added custom save object system\n|  - Easy to generate from JSON\n|- [+] Added system to automatically generate settings widgets for a given save object\n|- [+] Added LIB_WT_FloatSlider\n|  - Supports Linear, Quadratic, and Radical scaling\n|  - Supports arbitrary minimum and maximum values\n|\n|- [N] [+] LIB_M_BasicMacros\n|  - Added macro \"StoreTempVar\"\n|  - Added macro \"StoreTempArray\"\n|- [N] LIB_WT_ExpandableArea\n|  - Fixed bug where area wouldn't close all the way when animated\n|- [N] LIB_W_LogSettingsPage\n|  - Switched to new settings widgets and save object. \n|- [N] LIB_WT_Spinbox\n|  - Added logic for a spinbox that has no upper or lower bound\n|- [N] [I]Updated automation bats\n|\n|Guess I've got some new docs to write..."
                                },
                                {
                                    "id": 2781658,
                                    "date_added": 1658600560,
                                    "version": "4.5.0",
                                    "changelog": "|- Reduced filesize by switching to ingame fonts for non-english fonts; instead of including non-english fonts in the mod\n|- Fixed a bug where the FloatSlider property widget did not allow dragging on the part of the slider covered by numbers\n|- Added description option to Custom save properties\n|\n|- LIB_M_BasicMacros\n|  - [+] Added macro \"SelectUsingExecLine\"\n|- LIB_DSP_W_InputKeySelector\n|  - [N] Will now add requested keymapping if one does not already exist\n|- [I]Removed engine plugin causing binding issue\n|- [I]Enabled cooked content in editor\n|- LIB_DSP_W_FloatSliderWidget\n|  - [N] Changed visibility to non-hit testable on the text\n|- LIB_F_SaveFunctions\n|  - [+] Added function FromJSON(LIB_SAV_S_SettingsWidgetOptions)\n|- LIB_S_SettingsWidgetOptions\n|  - [+] Added field \"Description\"\n|- LIB_DSP_W_PropertyWidget\n|  - [N] Will now set tooltip to the held properties description"
                                },
                                {
                                    "id": 2840900,
                                    "date_added": 1660277700,
                                    "version": "4.5.1",
                                    "changelog": "Added support for gamepad keys for LIB_WT_InputKeySelector\nThis currently does not support \"Gamepad face button bottom\", but most other gamepad keys work\n\n- [N]LIB_WT_InputKeySelector\n  -[N] Added gamepad key support"
                                },
                                {
                                    "id": 2945755,
                                    "date_added": 1663724617,
                                    "version": "4.5.2",
                                    "changelog": "Fixed bug where closing the escape menu could cause mouse cursor to stay visible\n\n- LIB_JSON_O_Value\n  - [N] Fixed bug where cloning nested objects/arrays wouldn't preserve outer object hierarchy properly\n- LIB_A_Main \n  - [N] Fixed bug where \"UpdateInformedActors\" could technically run and tell mods DRGLib is ready too early\n- LIB_SAV_O_FloatProperty\n  - [N] \"SetValue\" now clamps properly\n- LIB_WT_WarningPopup\n  - [N] Popup will now disappear when clicking on it\n- LIB_WT_InputKeySelector\n  - [N] Adjusted behavior to not warn of overlaps when unbinding a key"
                                },
                                {
                                    "id": 3026056,
                                    "date_added": 1666370661,
                                    "version": "4.6.0",
                                    "changelog": "Added a new widget template, allowing for complex editing of a HUD widget's position/anchor data\n\n- [N] Removed ModHub interface files from pak\n  - I really should have done this ages ago; should resolve some reported crashing issues\n- [+] Added LIB_WT_HUDPositionSelector\n  - This widget supports editing anchor data, intended to be a widget for moving custom HUD elements around\n- [+] Added LIB_SAV_O_AnchorDataProperty\n- [+] Added LIB_DSP_W_AnchorDataWidget\n- [+] Added new keys to SpecialSettingsData\n- [N] Updated DRGLib save schema"
                                },
                                {
                                    "id": 3225575,
                                    "date_added": 1669936277,
                                    "version": "4.7.0",
                                    "changelog": "Added some new JSON translation macros, since function libraries can't be accessed from a base object\n\n- [+] Added the following macros:\n  - ToJSON(Vector2D)\n  - FromJSON(Vector2D)\n  - ToJSON(Vector)\n  - FromJSON(Vector)\n- [+] Added functions:\n  - ToJSON(Vector)\n  - FromJSON(Vector\n- [I] [N] Updated Header files to U37P6"
                                },
                                {
                                    "id": 3446150,
                                    "date_added": 1674338823,
                                    "version": "4.8.0",
                                    "changelog": "- Added collision layers for custom inputs\n  - This allows for having inputs only overlap when relevant, e.g. if you have an editor it doesn't matter if it colides with most inputs\n- Added new watch \"ManagedInputDetailedInfo\"\n- Added new features to draggable windows\n  - Minimize\n  - Drag (partially) off screen\n  - Disabling scrollbar\n  - Automatically scale to the desired size of the content\n- Added new widget \"LIB_WT_FilterableTreeView\" which allows for the end user to search contained objects\n\n\n- [N] LIB_S_CustomInputStruct\n  - [+] Added property \"CollisionLayer\"\n- [N] LIB_W_DraggableWindow\n  - [+][I] Added variable \"IsScrollable\", which decides whether to place content in a scrollbox or not\n  - [N] When specifying a size for a window, a value of 0 will cause the window to automatically scale to the desired size of the content. As always, this is per-axis\n- [N] LIB_F_DraggableWindow\n  - [+] Added function \"AddDraggableWindowV2\", which adds support for the scrollbox property\n    - Unfortunately I couldn't find a way to pass that information without a new function, but sometimes that's just how it is, eh?\n- [+] LIB_WT_FilterableTreeView\n- [N] LIB_WT_TreeView\n  - [+] Added function \"FilterObjects\" which hides all objects not containing a given string in their name\n- [N] LIB_F_Input\n  - [N] FindConflictingInputs\n    - [+] Added input \"CollisionLayer\", to specify a layer to find collisions on\n  - [N] AddCustomActionMapping\n    - [+] Added input \"CollisionLayer\", to specify the layer this action is a member of"
                                },
                                {
                                    "id": 3716174,
                                    "date_added": 1680909711,
                                    "version": "4.8.1",
                                    "changelog": "Finally fixed the crash when remapping keys\n\n- [N] LIB_WT_InputKeySelector\n  - Fixed bug where IKS would crash game when attempting to remap\n- [N] LIB_WT_ExpandableArea\n  - [+] Added event dispatcher \"OnExpansionChanged\"\n  - [N] The arrow of the box now expands with font size\n- [I] Updated to newer headers"
                                }
                            ],
                            "tags": [
                                "Framework",
                                "Verified",
                                "Optional",
                                "1.39"
                            ]
                        },
                        "2613099": {
                            "name_id": "ammo-percentage-indicator",
                            "name": "Ammo percentage indicator",
                            "latest_modfile": 5233422,
                            "modfiles": [
                                {
                                    "id": 3305166,
                                    "date_added": 1671647418,
                                    "version": "0.1",
                                    "changelog": null
                                },
                                {
                                    "id": 3305803,
                                    "date_added": 1671657295,
                                    "version": "0.2",
                                    "changelog": "- Loading the UI widget should be fixed\nAdded percentage display for:\n- Grenades\n- Driller C4\n- Driller drills"
                                },
                                {
                                    "id": 3307965,
                                    "date_added": 1671700716,
                                    "version": "0.3",
                                    "changelog": "- Refactor blueprint structure\n- Display team bank nitra as percentage of the supply drop cost\n- Display scout grapple hook cooldown as percentage"
                                },
                                {
                                    "id": 3309499,
                                    "date_added": 1671733584,
                                    "version": "0.35",
                                    "changelog": "- Changed widget position"
                                },
                                {
                                    "id": 3313239,
                                    "date_added": 1671807100,
                                    "version": "0.4",
                                    "changelog": "- Integrate percentage count into the existing HUD (Huge thanks to Mr.Creaper &amp; AssemblyStorm!!)\n - Make resupply percentage display more accurate\n - Display pickaxe power attack recharge as percentage"
                                },
                                {
                                    "id": 3314151,
                                    "date_added": 1671819869,
                                    "version": "0.45",
                                    "changelog": "- Mod renamed"
                                },
                                {
                                    "id": 3459341,
                                    "date_added": 1674650108,
                                    "version": "0.5",
                                    "changelog": "- Fix sentry gun ammo indication\n - Fix scout crossbow special ammo indication (Huge thanks to ØrionSincoat for reporting this issue!)\n - Hopefully fix indicator loading issues once and for all (Please let me know if it's still an issue!)"
                                },
                                {
                                    "id": 3932808,
                                    "date_added": 1686847624,
                                    "version": "0.51",
                                    "changelog": "- Update version tag to 1.38"
                                },
                                {
                                    "id": 5233422,
                                    "date_added": 1718284222,
                                    "version": "0.52",
                                    "changelog": "- Update version tag to 1.39"
                                }
                            ],
                            "tags": [
                                "1.38",
                                "Verified",
                                "1.37",
                                "Optional",
                                "1.39",
                                "QoL"
                            ]
                        },
                        "3074337": {
                            "name_id": "boss-hp-bar-for-big-enemies",
                            "name": "Boss HP Bar for Big Enemies",
                            "latest_modfile": 5356742,
                            "modfiles": [
                                {
                                    "id": 3912543,
                                    "date_added": 1686324223,
                                    "version": "1.0.0",
                                    "changelog": "Inital release"
                                },
                                {
                                    "id": 3912810,
                                    "date_added": 1686330223,
                                    "version": "1.0.1",
                                    "changelog": "Added Acid Queen"
                                },
                                {
                                    "id": 3912826,
                                    "date_added": 1686330529,
                                    "version": "1.0.2",
                                    "changelog": "Fixed Acid Queen health bar not showing up"
                                },
                                {
                                    "id": 3919990,
                                    "date_added": 1686500476,
                                    "version": "1.0.3",
                                    "changelog": "Fixed Unknown Horror having a boss health bar"
                                },
                                {
                                    "id": 3938101,
                                    "date_added": 1686960771,
                                    "version": "1.0.4",
                                    "changelog": "Updated for Season 4"
                                },
                                {
                                    "id": 5356742,
                                    "date_added": 1721175546,
                                    "version": "1.0.5",
                                    "changelog": "Remade using recent game files"
                                }
                            ],
                            "tags": [
                                "Visual",
                                "Optional",
                                "1.39",
                                "QoL",
                                "Verified"
                            ]
                        },
                        "1150682": {
                            "name_id": "more-fov",
                            "name": "More FOV",
                            "latest_modfile": 2519105,
                            "modfiles": [
                                {
                                    "id": 2519105,
                                    "date_added": 1651151019,
                                    "version": "1.0.2",
                                    "changelog": "- Season 02 update"
                                }
                            ],
                            "tags": [
                                "QoL",
                                "1.38",
                                "Verified"
                            ]
                        },
                        "2965513": {
                            "name_id": "aichis-beer-selector",
                            "name": "Aichi's Beer Selector",
                            "latest_modfile": 3797254,
                            "modfiles": [
                                {
                                    "id": 3766020,
                                    "date_added": 1682225495,
                                    "version": "1.0.0",
                                    "changelog": "first release"
                                },
                                {
                                    "id": 3791959,
                                    "date_added": 1682992321,
                                    "version": "1.1.0",
                                    "changelog": "1.1.0 Now the screen at the bar properly shows the newly changed buff beer"
                                },
                                {
                                    "id": 3792113,
                                    "date_added": 1682997803,
                                    "version": "1.1.1",
                                    "changelog": "1.1.1 Now the mod only works if the operator is the host."
                                },
                                {
                                    "id": 3792231,
                                    "date_added": 1683005853,
                                    "version": "1.1.2",
                                    "changelog": "1.1.2 Fixed a tiny visual bug."
                                },
                                {
                                    "id": 3797254,
                                    "date_added": 1683209019,
                                    "version": "1.1.3",
                                    "changelog": "1.1.3 Client players can now change the special beer now."
                                }
                            ],
                            "tags": [
                                "QoL",
                                "1.37",
                                "Optional",
                                "Approved"
                            ]
                        },
                        "1861561": {
                            "name_id": "custom-difficulty",
                            "name": "Custom Difficulty",
                            "latest_modfile": 3179770,
                            "modfiles": [
                                {
                                    "id": 2444548,
                                    "date_added": 1649363963,
                                    "version": null,
                                    "changelog": "- Fix instances of Custom Difficulty persisting through level transitions and causing havoc\n- Add \"Dump Difficulty State\" button which prints a JSON object containing most values touched by Custom Difficulty for debugging purposes"
                                },
                                {
                                    "id": 2445531,
                                    "date_added": 1649386886,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2445656,
                                    "date_added": 1649391635,
                                    "version": null,
                                    "changelog": null
                                },
                                {
                                    "id": 2464931,
                                    "date_added": 1649806234,
                                    "version": null,
                                    "changelog": "- Add description field to difficulties\n- Fix incorrect hazard bonus in difficulty selector\n- Add player dependent spawn cap, and fix PawnStats not initializing sometimes\n- Allow player dependent spawn cap and resupply cost"
                                },
                                {
                                    "id": 2469003,
                                    "date_added": 1649898956,
                                    "version": null,
                                    "changelog": "- Fix resupply cost not being properly when an array"
                                },
                                {
                                    "id": 2476672,
                                    "date_added": 1650057048,
                                    "version": null,
                                    "changelog": "- Allow importing difficulties from the base game and mods"
                                },
                                {
                                    "id": 2518816,
                                    "date_added": 1651133930,
                                    "version": null,
                                    "changelog": "- Update for U36"
                                },
                                {
                                    "id": 2518830,
                                    "date_added": 1651135709,
                                    "version": null,
                                    "changelog": "- Fix season event defaults"
                                },
                                {
                                    "id": 2614213,
                                    "date_added": 1653808451,
                                    "version": null,
                                    "changelog": "- Fix importing difficulties with a hazard bonus more than 1.33 failing\n- Migrate resupply cost config to independent manager"
                                },
                                {
                                    "id": 2779501,
                                    "date_added": 1658537949,
                                    "version": null,
                                    "changelog": "- Remove AssetRegistry.bin"
                                },
                                {
                                    "id": 2845446,
                                    "date_added": 1660420459,
                                    "version": null,
                                    "changelog": "- Update common lib\n- Use common logging lib"
                                },
                                {
                                    "id": 3119659,
                                    "date_added": 1668049250,
                                    "version": null,
                                    "changelog": "- Disable season event logic entirely as prospector is no longer a season event"
                                },
                                {
                                    "id": 3179770,
                                    "date_added": 1669092129,
                                    "version": null,
                                    "changelog": "- Un-cap per player count arrays to allow scaling beyond 4 players"
                                }
                            ],
                            "tags": [
                                "Tools",
                                "RequiredByAll",
                                "Approved",
                                "Gameplay",
                                "1.36",
                                "1.38",
                                "1.37"
                            ]
                        }
                    },
                    "last_update_time": {
                        "secs_since_epoch": 1733103615,
                        "nanos_since_epoch": 354377000
                    }
                }
            }
        });
    }

}

export default CacheApi;