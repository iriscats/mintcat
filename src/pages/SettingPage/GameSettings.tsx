import {open} from "@tauri-apps/plugin-dialog";
import {Button, Card, Flex, Form, message} from "antd";
import {t} from "i18next";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import Search from "antd/es/input/Search";
import {FolderAddOutlined} from "@ant-design/icons";
import React from "react";
import {SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {AppViewModel} from "@/vm/AppViewModel.ts";

export function GameSettings() {

    const [drgPakPath, setDrgPakPath] = React.useState<string>("");

    const onGamePathClick = async () => {

        const result = await open({
            defaultPath: drgPakPath,
            filters: [{
                name: 'FSD-WindowsNoEditor',
                extensions: ['pak'],
            }],
            multiple: false,
        });

        if (result) {
            if (result.endsWith("FSD-WindowsNoEditor.pak")) {
                setDrgPakPath(result);
                const vm = await AppViewModel.getInstance();
                vm.setting.drgPakPath = result;
                await vm.saveSettings();
            } else {
                message.error(t("Please select FSD-WindowsNoEditor.pak"));
            }
        }
    }

    const onFindGamePathClick = async () => {
        const path = await IntegrateApi.findGamePak();
        if (path) {
            setDrgPakPath(path);
            const vm = await AppViewModel.getInstance();
            vm.setting.drgPakPath = path;
            await vm.saveSettings();
        } else {
            message.error(t("Can't find FSD-WindowsNoEditor.pak"));
        }
    }

    React.useEffect(() => {
        const fetchData = async () => {
            const vm = await AppViewModel.getInstance();
            setDrgPakPath(vm.setting.drgPakPath);
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
            </Form>
        </Card>
    )
}

