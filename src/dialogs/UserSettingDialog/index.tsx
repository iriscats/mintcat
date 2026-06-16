import React from "react";
import {t} from "i18next";
import {Avatar, Button, Divider, Flex, Input, message, Modal, Tabs, Typography} from "antd";
import {UserOutlined, LinkOutlined, KeyOutlined, CrownOutlined} from "@ant-design/icons";
import {open as openShell} from "@tauri-apps/plugin-shell";

import {ModioApi} from "@/apis/modio";
import {MODCAT_PLATFORM} from "@/apis/modcat";
import {NEXUSMODS_PLATFORM} from "@/apis/nexusmods";
import {CacheApi} from "@/apis/CacheApi";
import {validateVipStatus} from "@/apis/mintcat";
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
    nexusmodsOAuth?: string;
    vipStatus?: 'Active' | 'Expired' | 'None';
    vipType?: string | null;
    vipExpirationTime?: string | null;
}

interface AccessKeyTabConfig {
    title: string;
    value: string;
    placeholder: string;
    description: string;
    onChange: (e: any) => void;
    onOpen: () => Promise<void>;
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
            nexusmodsOAuth: "",
            vipStatus: "None",
            vipType: null,
            vipExpirationTime: null,
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

            // 加载各平台 OAuth（始终从 DB 拉取并展示，即使用户信息接口失败如 token 过期）
            const mintcatOAuth = await this.appService.getOAuthByPlatform('mintcat');
            const modcatOAuth = await this.appService.getOAuthByPlatform(MODCAT_PLATFORM);
            const modioOAuth = await this.appService.getOAuthByPlatform('mod.io');
            const nexusmodsOAuth = await this.appService.getOAuthByPlatform(NEXUSMODS_PLATFORM);

            // 通过后端接口验证真实 VIP 状态
            const vipInfo = await validateVipStatus();

            const userInfo = await ModioApi.getUserInfo();
            if (userInfo) {
                const url = await CacheApi.cacheAvatar(userInfo.id, userInfo.avatar.thumb_100x100);
                this.setState({
                    profileUrl: url,
                    username: userInfo.username,
                    modioId: userInfo.id,
                    userEmail: "",
                    modioOAuth: modioOAuth?.oauth || "",
                    mintcatOAuth: mintcatOAuth?.oauth || "",
                    modcatOAuth: modcatOAuth?.oauth || "",
                    nexusmodsOAuth: nexusmodsOAuth?.oauth || "",
                    vipStatus: vipInfo?.vipStatus ?? "None",
                    vipType: vipInfo?.vipType ?? null,
                    vipExpirationTime: vipInfo?.vipExpirationTime ?? null,
                })
            } else {
                this.setState({
                    modioOAuth: modioOAuth?.oauth || "",
                    mintcatOAuth: mintcatOAuth?.oauth || "",
                    modcatOAuth: modcatOAuth?.oauth || "",
                    nexusmodsOAuth: nexusmodsOAuth?.oauth || "",
                    vipStatus: vipInfo?.vipStatus ?? "None",
                    vipType: vipInfo?.vipType ?? null,
                    vipExpirationTime: vipInfo?.vipExpirationTime ?? null,
                })
            }
        } catch (error) {
            message.error(t("userSetting.loadUserInfoFailed") + error);
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
                content: t("userSetting.invalidOAuth"),
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
            message.error(t("userSetting.saveOAuthFailed"));
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
                content: t("userSetting.invalidOAuth"),
                key: "mintcat-oauth-invalid"
            });
            this.setState({
                vipStatus: "None",
                vipType: null,
                vipExpirationTime: null,
            });
            return;
        }

        try {
            const activeUser = await this.appService.getActiveUser();
            if (activeUser) {
                await this.appService.setOAuth(activeUser.id, 'mintcat', value);
            }

            if (!value.trim()) {
                this.setState({
                    vipStatus: "None",
                    vipType: null,
                    vipExpirationTime: null,
                });
                return;
            }

            const vipInfo = await validateVipStatus();
            this.setState({
                vipStatus: vipInfo?.vipStatus ?? "None",
                vipType: vipInfo?.vipType ?? null,
                vipExpirationTime: vipInfo?.vipExpirationTime ?? null,
            });
        } catch (error) {
            console.error('Failed to save MintCat OAuth:', error);
            message.error(t("userSetting.saveOAuthFailed"));
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
                content: t("userSetting.invalidOAuth"),
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
            message.error(t("userSetting.saveOAuthFailed"));
        }
    }

    @autoBind
    private async onOpenModcatClick() {
        await openShell("https://modcat.top");
    }

    @autoBind
    private async onNexusmodsOAuthChange(e: any) {
        const value = e.target.value;
        this.setState({
            nexusmodsOAuth: value
        });

        if (value.length !== 0 && value.length < 20) {
            message.error({
                content: t("userSetting.invalidOAuth"),
                key: "nexusmods-oauth-invalid"
            });
            return;
        }

        try {
            const activeUser = await this.appService.getActiveUser();
            if (activeUser) {
                await this.appService.setOAuth(activeUser.id, NEXUSMODS_PLATFORM, value);
            }
        } catch (error) {
            console.error('Failed to save Nexus Mods API key:', error);
            message.error(t("userSetting.saveOAuthFailed"));
        }
    }

    @autoBind
    private async onOpenNexusmodsClick() {
        await openShell("https://www.nexusmods.com/users/myaccount?tab=api%20access");
    }

    private renderAccessKeyTab(config: AccessKeyTabConfig) {
        return (
            <Flex vertical gap={8} className="user-settings-tab-pane">
                <Flex justify="space-between" align="center">
                    <Text strong className="user-settings-config-title">{config.title}</Text>
                    <Button
                        color="primary"
                        variant="link"
                        size="small"
                        onClick={config.onOpen}
                        icon={<LinkOutlined/>}
                        className="user-settings-link"
                    >
                        {t("userSetting.getAccessKey")}
                    </Button>
                </Flex>

                <Input
                    prefix={<KeyOutlined className="user-settings-input-icon" />}
                    onChange={config.onChange}
                    allowClear
                    value={config.value}
                    placeholder={config.placeholder}
                />
                <Text type="secondary" className="user-settings-desc">
                    {config.description}
                </Text>
            </Flex>
        );
    }

    render() {
        const accessKeyTabs = [
            {
                key: "mintcat",
                label: "MintCat",
                children: this.renderAccessKeyTab({
                    title: t("userSetting.mintcatConfig"),
                    value: this.state.mintcatOAuth || "",
                    placeholder: t("userSetting.placeholderMintcatOAuth"),
                    description: t("userSetting.descMintcatOAuth"),
                    onChange: this.onMintcatOAuthChange,
                    onOpen: this.onOpenMintcatClick,
                }),
            },
            {
                key: "modio",
                label: "mod.io",
                children: this.renderAccessKeyTab({
                    title: t("userSetting.modioConfig"),
                    value: this.state.modioOAuth || "",
                    placeholder: t("userSetting.placeholderModioOAuth"),
                    description: t("userSetting.descModioOAuth"),
                    onChange: this.onOAuthChange,
                    onOpen: this.onOpenModioClick,
                }),
            },
            {
                key: "nexusmods",
                label: "Nexus Mods",
                children: this.renderAccessKeyTab({
                    title: t("userSetting.nexusmodsConfig"),
                    value: this.state.nexusmodsOAuth || "",
                    placeholder: t("userSetting.placeholderNexusmodsOAuth"),
                    description: t("userSetting.descNexusmodsOAuth"),
                    onChange: this.onNexusmodsOAuthChange,
                    onOpen: this.onOpenNexusmodsClick,
                }),
            },
            {
                key: "modcat",
                label: "ModCat",
                children: this.renderAccessKeyTab({
                    title: t("userSetting.modcatConfig"),
                    value: this.state.modcatOAuth || "",
                    placeholder: t("userSetting.placeholderModcatOAuth"),
                    description: t("userSetting.descModcatOAuth"),
                    onChange: this.onModcatOAuthChange,
                    onOpen: this.onOpenModcatClick,
                }),
            },
        ];

        return (
            <Modal title={t("userSetting.title")}
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
                                    {this.state.username || t("userSetting.guestUser")}
                                </Title>
                                {this.state.vipStatus === 'Active' && (
                                    <Button
                                        size="small"
                                        type="primary"
                                        icon={<CrownOutlined />}
                                        onClick={this.onVIPClick}
                                        className="user-settings-vip"
                                    >
                                        {t("userSetting.mintcatVip")}
                                    </Button>
                                )}
                                {this.state.vipStatus === 'Expired' && (
                                    <Button
                                        size="small"
                                        type="default"
                                        icon={<CrownOutlined style={{ color: "#8c8c8c" }} />}
                                        onClick={this.onVIPClick}
                                        className="user-settings-vip"
                                        style={{ color: "#8c8c8c", borderColor: "#d9d9d9" }}
                                    >
                                        {t("userSetting.vipExpired")}
                                    </Button>
                                )}
                            </Flex>
                            <Text type="secondary">
                                ID: {this.state.modioId || "N/A"}
                            </Text>
                            {this.state.vipStatus === 'Active' && this.state.vipExpirationTime && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t("userSetting.vipExpiration", { date: new Date(this.state.vipExpirationTime).toLocaleDateString() })}
                                </Text>
                            )}
                            {this.state.vipStatus === 'Expired' && this.state.vipExpirationTime && (
                                <Text type="secondary" style={{ fontSize: 12 }}>
                                    {t("userSetting.vipExpiredAt", { date: new Date(this.state.vipExpirationTime).toLocaleDateString() })}
                                </Text>
                            )}
                        </Flex>
                    </Flex>

                    <Divider className="user-settings-divider" />

                    <Tabs
                        size="small"
                        className="user-settings-tabs"
                        items={accessKeyTabs}
                    />

                    {/* Footer Actions */}
                    <Button type="primary"
                            block
                            onClick={this.handleCancel}
                            className="user-settings-save"
                    >
                        {t("userSetting.saveChanges")}
                    </Button>
                </Flex>
            </Modal>
        );
    }
}

export default UserSettingDialog;
