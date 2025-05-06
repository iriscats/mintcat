import {t} from "i18next";
import React from "react";
import {open as openShell} from "@tauri-apps/plugin-shell";
import {Button, Card, Flex, Form, Input, message} from "antd";
import {SettingLayout} from "@/pages/SettingPage/Layout.ts";
import {AppViewModel} from "@/vm/AppViewModel.ts";

export function UserAuthSettings() {

    const [modioOAuth, setModioOAuth] = React.useState<string>("");

    const onOpenModioClick = async () => {
        await openShell("https://mod.io/me/access");
    }

    const onOAuthChange = async (e: any) => {
        if (e.target.value.length !== 0 && e.target.value.length < 20) {
            message.error(t("Invalid OAuth"));
        }
        setModioOAuth(e.target.value);
        const vm = await AppViewModel.getInstance();
        await vm.saveSettings();
    }


    React.useEffect(() => {
        const fetchData = async () => {
            const vm = await AppViewModel.getInstance();
            setModioOAuth(vm.setting.modioOAuth);
        }
        fetchData().then();
    }, []);


    return (
        <Card title={t("User Authentication")}
              style={{marginBottom: "10px"}}
        >
            <Form {...SettingLayout}>
                <Form.Item label={t("mod.io key")} name="oauth">
                    <Flex>
                        <Input onChange={onOAuthChange}
                               allowClear
                               value={modioOAuth}
                        />
                        <Button type="default"
                                onClick={onOpenModioClick}>
                            {t("Open mod.io")}
                        </Button>
                    </Flex>
                </Form.Item>
            </Form>
        </Card>
    )
}
