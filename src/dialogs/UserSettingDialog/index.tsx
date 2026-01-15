import React from "react";
import {t} from "i18next";
import {Avatar, Button, Divider, Flex, Input, message, Modal, Typography} from "antd";
import {UserOutlined, LinkOutlined, KeyOutlined, CrownOutlined} from "@ant-design/icons";
import {open as openShell} from "@tauri-apps/plugin-shell";

import {ModioApi} from "@/apis/modio";
import {CacheApi} from "@/apis/CacheApi";
import {AppViewModel} from "@/AppViewModel";
import {IoC} from "@/core/IoC.ts";
import {StorageAPI} from "@/storage";
import { autoBind } from "@/utils/ReactUtils";

const {Text, Title} = Typography;

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

    }

    @autoBind
    public async show() {
        this.setState({
            isModalOpen: true
        });
        await this.loadUserInfo();
    }

    @autoBind
    private async loadUserInfo() {
        try {
            const vm = await IoC.get(AppViewModel);
            // 检查OAuth是否有效
            await vm.checkOauth();

            const userInfo = await ModioApi.getUserInfo();
            if (userInfo) {
                const url = await CacheApi.cacheAvatar(userInfo.id, userInfo.avatar.thumb_100x100);
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
            message.error(t("Failed to load user info") + error);
        }
    }

    @autoBind
    private handleCancel() {
        this.setState({
            isModalOpen: false
        });
    }

    @autoBind
    private async onOpenModioClick() {
        await openShell("https://mod.io/me/access");
    }

    @autoBind
    private async onVIPClick() {
        await openShell("https://vip.mintcat.work");
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
                   width={480}
                   centered
            >
                <Flex vertical gap={24} style={{ paddingTop: 12 }}>
                    {/* User Profile Section */}
                    <Flex align="center" gap={20}>
                        <Avatar 
                            size={80}
                            icon={<UserOutlined/>}
                            src={this.state.profileUrl}
                            style={{
                                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                border: '2px solid #fff'
                            }}
                        />
                        <Flex vertical gap={4}>
                            <Flex align="center" gap={8}>
                                <Title level={4} style={{ margin: 0, color: '#1F2937' }}>
                                    {this.state.username || t("Guest User")}
                                </Title>
                                <Button
                                    size="small"
                                    type="primary"
                                    icon={<CrownOutlined />}
                                    onClick={this.onVIPClick}
                                    style={{
                                        backgroundColor: '#FFD700',
                                        borderColor: '#FFD700',
                                        color: '#725e0c',
                                        fontWeight: 'bold',
                                        fontSize: '12px',
                                        height: '22px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    VIP
                                </Button>
                            </Flex>
                            <Text type="secondary">
                                ID: {this.state.modioId || "N/A"}
                            </Text>
                        </Flex>
                    </Flex>

                    <Divider style={{ margin: 0 }} />

                    {/* Mod.io Configuration Section */}
                    <Flex vertical gap={8}>
                        <Flex justify="space-between" align="center">
                            <Text strong style={{ fontSize: 15 }}>{t("Mod.io Configuration")}</Text>
                            <Button 
                                color="primary"
                                variant="link" 
                                size="small" 
                                onClick={this.onOpenModioClick}
                                icon={<LinkOutlined/>}
                                style={{ padding: 0 }}
                            >
                                {t("Get Access Key")}
                            </Button>
                        </Flex>
                        
                        <Input 
                            prefix={<KeyOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
                            onChange={this.onOAuthChange}
                            allowClear
                            value={this.state.modioOAuth}
                            placeholder={t("Enter your mod.io OAuth key")}
                        />
                        <Text type="secondary" style={{ fontSize: 12 }}>
                            {t("Paste your OAuth key here to sync your subscriptions.")}
                        </Text>
                    </Flex>

                    {/* Footer Actions */}
                    <Button type="primary"
                            block
                            onClick={this.handleCancel}
                            style={{ marginTop: 8 }}
                    >
                        {t("Save Changes")}
                    </Button>
                </Flex>
            </Modal>
        );
    }
}

export default UserSettingDialog;
