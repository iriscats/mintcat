import React from "react";
import {t} from "i18next";
import {Avatar, Button, Card, Descriptions, Flex, Form, Input, message, Modal} from "antd";
import {UserOutlined} from "@ant-design/icons";
import {open as openShell} from "@tauri-apps/plugin-shell";
import {ModioApi} from "@/apis/modio";
import {CacheApi} from "@/apis/CacheApi";
import {AppViewModel} from "@/AppViewModel";
import { IoC } from "@/core/IoC.ts";
import {StorageAPI} from "@/storage";

interface UserSettingDialogStates {
    isModalOpen?: boolean;
    profileUrl?: string;
    username?: string;
    modioId?: number;
    userEmail?: string;
    modioOAuth?: string;
}

class UserSettingDialog extends React.Component<any, UserSettingDialogStates> {

    public constructor(props: any) {
        super(props);

        this.state = {
            isModalOpen: false,
            username: "",
            modioId: 0,
            userEmail: "",
            modioOAuth: ""
        }

        this.show = this.show.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.onOAuthChange = this.onOAuthChange.bind(this);
        this.onOpenModioClick = this.onOpenModioClick.bind(this);
        this.loadUserInfo = this.loadUserInfo.bind(this);
    }

    public async show() {
        this.setState({
            isModalOpen: true
        });
        await this.loadUserInfo();
    }

    private async loadUserInfo() {
        try {
            const vm = await IoC.get(AppViewModel);
            // 检查OAuth是否有效
            await vm.checkOauth();

            const userInfo = await ModioApi.getUserInfo();
            if (userInfo) {
                const url = await CacheApi.cacheImage(userInfo.avatar.thumb_50x50);
                const oauths = await StorageAPI.getOAuths();
                const modioOAuth = await oauths.getModioOAuth();

                this.setState({
                    profileUrl: url,
                    username: userInfo.username,
                    modioId: userInfo.id,
                    userEmail: "",
                    modioOAuth: modioOAuth?.oauth || ""
                })
            }
        } catch (error) {
            console.error('Failed to load user info:', error);
            message.error(t("Failed to load user info"));
        }
    }

    private handleCancel() {
        this.setState({
            isModalOpen: false
        });
    }

    private async onOpenModioClick() {
        await openShell("https://mod.io/me/access");
    }

    private async onOAuthChange(e: any) {
        const value = e.target.value;
        if (value.length !== 0 && value.length < 20) {
            message.error(t("Invalid OAuth"));
            return;
        }

        this.setState({
            modioOAuth: value
        });

        try {
            const users = await StorageAPI.getUsers();
            const activeUser = await users.getActiveUser();

            if (activeUser) {
                const oauths = await StorageAPI.getOAuths();
                await oauths.setModioOAuth(activeUser.id, value);
            }
        } catch (error) {
            console.error('Failed to save OAuth:', error);
            message.error(t("Failed to save OAuth"));
        }
    }

    render() {
        return (
            <Modal title={t("User Settings")}
                   open={this.state.isModalOpen}
                   onCancel={this.handleCancel}
                   footer={null}
                   width={600}
            >
                <Flex vertical gap="middle">
                    <Card>
                        <Flex vertical gap="middle" align="center">
                            <Avatar size={80}
                                    icon={<UserOutlined/>}
                                    src={
                                        this.state.profileUrl &&
                                        <img src={this.state.profileUrl} alt="avatar"/>
                                    }
                            />
                            <Descriptions bordered column={1} size="small">
                                <Descriptions.Item label={t("Username")}>
                                    {this.state.username}
                                </Descriptions.Item>
                                <Descriptions.Item label="ID">
                                    {this.state.modioId}
                                </Descriptions.Item>
                                <Descriptions.Item label={t("Email")}>
                                    {this.state.userEmail}
                                </Descriptions.Item>
                            </Descriptions>
                        </Flex>
                    </Card>
                    <Card title={t("User Settings")}>
                        <Form layout="vertical">
                            <Form.Item label={t("mod.io key")}>
                                <Flex>
                                    <Input onChange={this.onOAuthChange}
                                           allowClear
                                           value={this.state.modioOAuth}
                                    />
                                    <Button type="default"
                                            onClick={this.onOpenModioClick}>
                                        {t("Open mod.io")}
                                    </Button>
                                </Flex>
                            </Form.Item>
                        </Form>
                    </Card>
                </Flex>
            </Modal>
        );
    }
}

export default UserSettingDialog;
