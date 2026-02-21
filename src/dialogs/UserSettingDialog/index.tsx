import React from "react";
import {t} from "i18next";
import {Avatar, Button, Divider, Flex, Input, message, Modal, Typography} from "antd";
import {UserOutlined, LinkOutlined, KeyOutlined, CrownOutlined} from "@ant-design/icons";
import {open as openShell} from "@tauri-apps/plugin-shell";

import {ModioApi} from "@/apis/modio";
import {MODCAT_PLATFORM} from "@/apis/modcat";
import {CacheApi} from "@/apis/CacheApi";
import {AppViewModel} from "@/AppViewModel";
import {IoC} from "@/core/IoC.ts";
import {AppService} from "@/services/AppService.ts";
import { autoBind } from "@/utils/ReactUtils";
import { emitVoidEvent } from "@/events";

const {Text, Title} = Typography;

interface UserSettingDialogStates {
    isModalOpen?: boolean;
    profileUrl?: string;
    username?: string;
    modioId?: number;
    userEmail?: string;
    modioOAuth?: string;
    mintcatOAuth?: string;
    modcatOAuth?: string;
}

class UserSettingDialog extends React.Component<any, UserSettingDialogStates> {
    private appService = new AppService();

    public constructor(props: any) {
        super(props);

        this.state = {
            isModalOpen: false,
            username: "",
            modioId: 0,
            userEmail: "",
            modioOAuth: "",
            mintcatOAuth: "",
            modcatOAuth: "",
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

            // 加载各平台 OAuth
            const mintcatOAuth = await this.appService.getOAuthByPlatform('mintcat');
            const modcatOAuth = await this.appService.getOAuthByPlatform(MODCAT_PLATFORM);
            
            const userInfo = await ModioApi.getUserInfo();
            if (userInfo) {
                const url = await CacheApi.cacheAvatar(userInfo.id, userInfo.avatar.thumb_100x100);
                const modioOAuth = await this.appService.getOAuthByPlatform('mod.io');

                this.setState({
                    profileUrl: url,
                    username: userInfo.username,
                    modioId: userInfo.id,
                    userEmail: "",
                    modioOAuth: modioOAuth?.oauth || "",
                    mintcatOAuth: mintcatOAuth?.oauth || "",
                    modcatOAuth: modcatOAuth?.oauth || "",
                })
            } else {
                // 即使没有 mod.io 用户信息，也要加载其他平台 OAuth 状态
                this.setState({
                    mintcatOAuth: mintcatOAuth?.oauth || "",
                    modcatOAuth: modcatOAuth?.oauth || "",
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
        emitVoidEvent("user-setting-dialog-closed");
    }

    @autoBind
    private async onOpenModioClick() {
        await openShell("https://mod.io/me/access");
    }

    @autoBind
    private async onVIPClick() {
        await openShell("https://vip.mintcat.work");
    }

    @autoBind
    private async onOAuthChange(e: any) {
        const value = e.target.value;
        this.setState({
            modioOAuth: value
        });

        if (value.length !== 0 && value.length < 20) {
            message.error({
                content: t("Invalid OAuth"),
                key: "oauth-invalid"
            });
            return;
        }

        try {
            const activeUser = await this.appService.getActiveUser();
            if (activeUser) {
                await this.appService.setOAuth(activeUser.id, 'mod.io', value);
            }
        } catch (error) {
            console.error('Failed to save OAuth:', error);
            message.error(t("Failed to save OAuth"));
        }
    }

    @autoBind
    private async onMintcatOAuthChange(e: any) {
        const value = e.target.value;
        this.setState({
            mintcatOAuth: value
        });

        if (value.length !== 0 && value.length < 20) {
            message.error({
                content: t("Invalid OAuth"),
                key: "mintcat-oauth-invalid"
            });
            return;
        }

        try {
            const activeUser = await this.appService.getActiveUser();
            if (activeUser) {
                await this.appService.setOAuth(activeUser.id, 'mintcat', value);
            }
        } catch (error) {
            console.error('Failed to save MintCat OAuth:', error);
            message.error(t("Failed to save OAuth"));
        }
    }

    @autoBind
    private async onOpenMintcatClick() {
        await openShell("https://vip.mintcat.work");
    }

    @autoBind
    private async onModcatOAuthChange(e: any) {
        const value = e.target.value;
        this.setState({
            modcatOAuth: value
        });

        if (value.length !== 0 && value.length < 20) {
            message.error({
                content: t("Invalid OAuth"),
                key: "modcat-oauth-invalid"
            });
            return;
        }

        try {
            const activeUser = await this.appService.getActiveUser();
            if (activeUser) {
                await this.appService.setOAuth(activeUser.id, MODCAT_PLATFORM, value);
            }
        } catch (error) {
            console.error('Failed to save ModCat OAuth:', error);
            message.error(t("Failed to save OAuth"));
        }
    }

    @autoBind
    private async onOpenModcatClick() {
        await openShell("https://modcat.top");
    }

    render() {
        return (
            <Modal title={t("User Settings")}
                   open={this.state.isModalOpen}
                   zIndex={1200}
                   onCancel={this.handleCancel}
                   footer={null}
                   width={480}
                   centered
            >
                <Flex vertical gap={24} className="user-settings-root">
                    {/* User Profile Section */}
                    <Flex align="center" gap={20}>
                        <Avatar 
                            size={80}
                            icon={<UserOutlined/>}
                            src={this.state.profileUrl}
                            className="user-settings-avatar"
                        />
                        <Flex vertical gap={4}>
                            <Flex align="center" gap={8}>
                                <Title level={4} className="user-settings-title">
                                    {this.state.username || t("Guest User")}
                                </Title>
                                {this.state.mintcatOAuth && (
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<CrownOutlined />}
                                        onClick={this.onVIPClick}
                                        className="user-settings-vip"
                                    >
                                        VIP
                                    </Button>
                                )}
                            </Flex>
                            <Text type="secondary">
                                ID: {this.state.modioId || "N/A"}
                            </Text>
                        </Flex>
                    </Flex>

                    <Divider className="user-settings-divider" />

                    {/* ModCat Configuration Section */}
                    <Flex vertical gap={8}>
                        <Flex justify="space-between" align="center">
                            <Text strong className="user-settings-config-title">{t("ModCat")}</Text>
                            <Button 
                                color="primary"
                                variant="link" 
                                size="small" 
                                onClick={this.onOpenModcatClick}
                                icon={<LinkOutlined/>}
                                className="user-settings-link"
                            >
                                {t("Get Access Key")}
                            </Button>
                        </Flex>
                        
                        <Input 
                            prefix={<KeyOutlined className="user-settings-input-icon" />}
                            onChange={this.onModcatOAuthChange}
                            allowClear
                            value={this.state.modcatOAuth}
                            placeholder={t("Enter your ModCat OAuth key")}
                        />
                        <Text type="secondary" className="user-settings-desc">
                            {t("Paste your ModCat OAuth key to search and download mods from modcat.top")}
                        </Text>
                    </Flex>

                    {/* MintCat Configuration Section */}
                    <Flex vertical gap={8}>
                        <Flex justify="space-between" align="center">
                            <Text strong className="user-settings-config-title">{t("MintCat VIP")}</Text>
                            <Button 
                                color="primary"
                                variant="link" 
                                size="small" 
                                onClick={this.onOpenMintcatClick}
                                icon={<LinkOutlined/>}
                                className="user-settings-link"
                            >
                                {t("Get Access Key")}
                            </Button>
                        </Flex>
                        
                        <Input 
                            prefix={<KeyOutlined className="user-settings-input-icon" />}
                            onChange={this.onMintcatOAuthChange}
                            allowClear
                            value={this.state.mintcatOAuth}
                            placeholder={t("Enter your MintCat OAuth key")}
                        />
                        <Text type="secondary" className="user-settings-desc">
                            {t("Paste your MintCat OAuth key to unlock VIP features.")}
                        </Text>
                    </Flex>

                    {/* Mod.io Configuration Section */}
                    <Flex vertical gap={8}>
                        <Flex justify="space-between" align="center">
                            <Text strong className="user-settings-config-title">{t("Mod.io Configuration")}</Text>
                            <Button 
                                color="primary"
                                variant="link" 
                                size="small" 
                                onClick={this.onOpenModioClick}
                                icon={<LinkOutlined/>}
                                className="user-settings-link"
                            >
                                {t("Get Access Key")}
                            </Button>
                        </Flex>
                        
                        <Input 
                            prefix={<KeyOutlined className="user-settings-input-icon" />}
                            onChange={this.onOAuthChange}
                            allowClear
                            value={this.state.modioOAuth}
                            placeholder={t("Enter your mod.io OAuth key")}
                        />
                        <Text type="secondary" className="user-settings-desc">
                            {t("Paste your OAuth key here to sync your subscriptions.")}
                        </Text>
                    </Flex>

                    {/* Footer Actions */}
                    <Button type="primary"
                            block
                            onClick={this.handleCancel}
                            className="user-settings-save"
                    >
                        {t("Save Changes")}
                    </Button>
                </Flex>
            </Modal>
        );
    }
}

export default UserSettingDialog;
