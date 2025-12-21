import {open} from "@tauri-apps/plugin-dialog";
import {Button, Card, Checkbox, Flex, Form, message, Select} from "antd";
import {t} from "i18next";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import Search from "antd/es/input/Search";
import {FolderAddOutlined} from "@ant-design/icons";
import React from "react";
import {ButtonLayout, SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {StorageAPI} from "@/storage";

export function GameSettings() {

    const [drgPakPath, setDrgPakPath] = React.useState<string>("");
    const [ue4ss, setUe4ss] = React.useState<string>("");

    const onGamePathClick = async () => {

        const result = await open({
            defaultPath: drgPakPath,
            filters: [{
                name: 'FSD-*',
                extensions: ['pak'],
            }],
            multiple: false,
        });

        if (result) {
            if (result.endsWith("FSD-WindowsNoEditor.pak") ||
                result.endsWith("FSD-WinGDK.pak")
            ) {
                setDrgPakPath(result);
                const gameDAO = await StorageAPI.getGames();
                const activeGame = await gameDAO.getActiveGame();
                if (activeGame) {
                    await gameDAO.updateGame(activeGame.id, { installPath: result });
                }
            } else {
                message.error(t("Please select FSD-WindowsNoEditor.pak"));
            }
        }
    }

    const onFindGamePathClick = async () => {
        const path = await IntegrateApi.findGamePak();
        if (path) {
            setDrgPakPath(path);
            const gameDAO = await StorageAPI.getGames();
            const activeGame = await gameDAO.getActiveGame();
            if (activeGame) {
                await gameDAO.updateGame(activeGame.id, { installPath: path });
            }
        } else {
            message.error(t("Can't find FSD-WindowsNoEditor.pak"));
        }
    }

    const onUe4ssChange = async (value: string) => {
        setUe4ss(value);
        if (value === "Custom") {
            message.warning(t("Disclaimer: The installation of the Custom mode UE4SS will be taken over by the user, and all consequences are the user's sole responsibility."));
        }
        const settings = await StorageAPI.getSettings();
        await settings.setValue('ue4ss', value);
    }

    const onUninstallClick = async () => {
        await IntegrateApi.uninstallMods();
    }

    React.useEffect(() => {
        const fetchData = async () => {
            const gameDAO = await StorageAPI.getGames();
            const activeGame = await gameDAO.getActiveGame();
            const drgPath = activeGame?.installPath || "";

            const settings = await StorageAPI.getSettings();
            const ue4ssValue = await settings.getValue('ue4ss');

            setDrgPakPath(drgPath);
            setUe4ss(ue4ssValue ? ue4ssValue : "UE4SS-Lite");
        }
        fetchData().then();
    }, []);


    return (
        <Card title={t("Game Settings")}
        >
            <Form {...SettingLayout}
            >
                <Form.Item label={t("Game Path")}>
                    <Flex>
                        <Search placeholder={"FSD-WindowsNoEditor.pak"}
                                value={drgPakPath}
                                enterButton={<FolderAddOutlined/>}
                                onSearch={onGamePathClick}
                        />
                        <Button type="default"
                                onClick={onFindGamePathClick}
                        >
                            {t("Auto Find")}
                        </Button>
                    </Flex>
                </Form.Item>
                <Form.Item label={t("Uninstall Mods")}>
                    <Button type="dashed"
                            {...ButtonLayout}
                            onClick={onUninstallClick}>
                        {t("Delete")}
                    </Button>
                </Form.Item>
                <Form.Item label={t("UE4SS")}>
                    <Select onChange={onUe4ssChange}
                            value={ue4ss}
                            options={[
                                {
                                    value: "UE4SS-Lite",
                                    label: "UE4SS-Lite",
                                },
                                {
                                    value: "Custom",
                                    label: "Custom",
                                },
                            ]}/>
                </Form.Item>
            </Form>
        </Card>
    )
}

