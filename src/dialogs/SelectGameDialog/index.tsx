import {useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import {t} from "i18next";
import {Button, Flex, message, Typography, Modal, Tag, Input, Tooltip, theme} from 'antd';
import {FolderOpenOutlined, AimOutlined, RocketOutlined, CheckCircleFilled} from "@ant-design/icons";
import {useEventListener, emitEvent} from "@/events";
import {open} from "@tauri-apps/plugin-dialog";

import {GameData} from "@/storage/dao/GameDAO.ts";
import {StorageAPI} from "@/storage";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";

const {Text} = Typography;
const {useToken} = theme;

export interface SelectGameDialogResult {
    gameId?: number;
    gameData?: GameData;
}

export interface SelectGameDialogRef {
    show: () => void;
}

export const SelectGameDialog = forwardRef<SelectGameDialogRef>((props, ref) => {
    const {token} = useToken();
    const [games, setGames] = useState<GameData[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<number | undefined>();
    const [loading, setLoading] = useState<boolean>(true);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingPathValue, setEditingPathValue] = useState<string>("");


    const loadGames = async () => {
        try {
            setLoading(true);
            const gameDAO = await StorageAPI.getGames();
            const gamesList = await gameDAO.getAllGames();

            // 默认选中第一个活跃游戏
            const activeGame = gamesList.find(game => game.isActive);
            const defaultSelectedId = activeGame?.id || (gamesList.length > 0 ? gamesList[0].id : undefined);

            setGames(gamesList);
            setSelectedGameId(defaultSelectedId);
        } catch (error) {
            console.error('获取游戏列表失败:', error);
            message.error(t("Failed to load games"));
            setGames([]);
        } finally {
            setLoading(false);
        }
    };

    const handleOk = async () => {
        if (!selectedGameId) {
            await message.warning(t("Please select a game"));
            return;
        }

        try {
            const gameDAO = await StorageAPI.getGames();

            // 更新激活状态
            for (const game of games) {
                if (game.id === selectedGameId) {
                    if (!game.isActive) {
                        await gameDAO.setGameActive(game.id!, true);
                    }
                } else {
                    if (game.isActive) {
                        await gameDAO.setGameActive(game.id!, false);
                    }
                }
            }

            const selectedGame = games.find(game => game.id === selectedGameId);
            if (selectedGame) {
                // 发送激活游戏变更事件
                const updatedGame = { ...selectedGame, isActive: true };
                await emitEvent('active-game-change', updatedGame);
            }

            // 重新加载列表以确保状态最新
            await loadGames();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Failed to update active game:', error);
            message.error(t("Failed to update active game"));
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
    };

    useImperativeHandle(ref, () => ({
        show: () => {
            setIsModalOpen(true);
        }
    }));

    const onGameChange = (gameId: number) => {
        setSelectedGameId(gameId);
    };

    const onGamePathClick = async (gameId: number) => {
        const game = games.find(g => g.id === gameId);
        const currentPath = game?.installPath || "";

        const result = await open({
            defaultPath: currentPath,
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
                setEditingPathValue(result);
                const gameDAO = await StorageAPI.getGames();
                await gameDAO.updateGame(gameId, { installPath: result });
                await loadGames();
            } else {
                message.error(t("Please select FSD-WindowsNoEditor.pak"));
            }
        }
    };

    const onFindGamePathClick = async (gameId: number) => {
        const path = await IntegrateApi.findGamePak();
        if (path) {
            setEditingPathValue(path);
            const gameDAO = await StorageAPI.getGames();
            await gameDAO.updateGame(gameId, { installPath: path });
            await loadGames();
        } else {
            message.error(t("Can't find FSD-WindowsNoEditor.pak"));
        }
    };

    useEffect(() => {
        loadGames().then();
    }, []);

    useEventListener("select-game-dialog-open", () => {
        setIsModalOpen(true);
    });

    const renderGameItem = (game: GameData) => {
        const isSelected = selectedGameId === game.id;
        const currentPath = game.installPath || editingPathValue;

        return (
            <div
                key={game.id}
                onClick={() => onGameChange(game.id!)}
                style={{
                    border: `2px solid ${isSelected ? token.colorPrimary : '#f0f0f0'}`,
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '12px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? token.colorPrimaryBg : '#fff',
                    transition: 'all 0.2s ease',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {isSelected && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        width: 0,
                        height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 40px 40px 0',
                        borderColor: `transparent ${token.colorPrimary} transparent transparent`,
                        zIndex: 1
                    }}>
                        <CheckCircleFilled style={{
                            position: 'absolute',
                            top: 6,
                            right: -34,
                            color: '#fff',
                            fontSize: '14px'
                        }}/>
                    </div>
                )}

                <Flex vertical gap="middle">
                    <Flex justify="space-between" align="start">
                        <Flex gap="middle" align="center">
                            <div style={{
                                width: 100,
                                height: 48,
                                borderRadius: 8,
                                background: isSelected ? token.colorPrimary : '#f5f5f5',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isSelected ? '#fff' : '#8c8c8c',
                                transition: 'all 0.2s ease',
                                overflow: 'hidden',
                                flexShrink: 0
                            }}>
                                <img
                                    src={game.icon}
                                    alt={game.displayName}
                                    style={{width: '100%', height: '100%', objectFit: 'cover'}}
                                />
                            </div>
                            <Flex vertical gap={2}>
                                <Text strong style={{fontSize: 16}}>{game.displayName}</Text>
                                <Flex gap="small" align="center">
                                    <Text type="secondary" style={{fontSize: 12}}>ID: {game.name}</Text>
                                    {game.isActive && (
                                        <Tag color="success" style={{margin: 0, fontSize: 10, lineHeight: '18px', border: 'none'}}>
                                            {t("Active")}
                                        </Tag>
                                    )}
                                </Flex>
                            </Flex>
                        </Flex>
                    </Flex>

                    <div style={{
                        background: isSelected ? token.colorPrimaryBg : '#f9fafb',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '1px solid #f0f0f0'
                    }} onClick={e => e.stopPropagation()}>
                        <Flex vertical gap="small">
                            <Text type="secondary" style={{fontSize: 12}}>{t("Install Path")}</Text>
                            <Flex gap="small">
                                <Input
                                    value={currentPath}
                                    placeholder={t("Select game executable path")}
                                    readOnly
                                    style={{flex: 1, fontSize: 13}}
                                    prefix={<FolderOpenOutlined style={{color: '#bfbfbf'}}/>}
                                />
                                <Tooltip title={t("Browse")}>
                                    <Button
                                        icon={<FolderOpenOutlined/>}
                                        onClick={() => onGamePathClick(game.id!)}
                                    />
                                </Tooltip>
                                <Tooltip title={t("Auto Find")}>
                                    <Button
                                        icon={<AimOutlined/>}
                                        onClick={() => onFindGamePathClick(game.id!)}
                                    />
                                </Tooltip>
                            </Flex>
                        </Flex>
                    </div>
                </Flex>
            </div>
        );
    };

    return (
        <Modal
            title={t("Select Game")}
            open={isModalOpen}
            onOk={handleOk}
            onCancel={handleCancel}
            width={520}
            centered
            footer={[
                <Button key="cancel" onClick={handleCancel} >
                    {t("Cancel")}
                </Button>,
                <Button
                    key="ok"
                    type="primary"
                    onClick={handleOk}
                    disabled={!selectedGameId}
                >
                    {t("Confirm")}
                </Button>
            ]}
        >
            <Flex vertical gap="large" style={{padding: '20px 0'}}>
                <div style={{maxHeight: '500px', overflowY: 'auto', padding: '0 4px'}}>
                    {loading ? (
                        <Flex justify="center" align="center" style={{height: '200px'}}>
                            <Text type="secondary">{t("Loading games...")}</Text>
                        </Flex>
                    ) : games && games.length > 0 ? (
                        <Flex vertical gap="small">
                            {games.map(renderGameItem)}
                        </Flex>
                    ) : (
                        <Flex justify="center" align="center" style={{height: '200px', background: '#f5f5f5', borderRadius: '8px'}}>
                            <Flex vertical align="center" gap="small">
                                <RocketOutlined style={{fontSize: 32, color: '#d9d9d9'}}/>
                                <Text type="secondary">
                                    {t("No games available")}
                                </Text>
                            </Flex>
                        </Flex>
                    )}
                </div>
            </Flex>
        </Modal>
    );
});