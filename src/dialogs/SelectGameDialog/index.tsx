import {useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import {t} from "i18next";
import {Button, Flex, message, Typography, Modal, Tag, Input, Tooltip, theme} from 'antd';
import {FolderOpenOutlined, AimOutlined, RocketOutlined, CheckCircleFilled} from "@ant-design/icons";
import {useEventListener, emitEvent, emitVoidEvent} from "@/events";
import {open} from "@tauri-apps/plugin-dialog";

import {GameData} from "@/storage/dao/GameDAO.ts";
import {IntegrateApi} from "@/apis/IntegrateApi.ts";
import {DialogGameService} from "@/services/DialogGameService.ts";

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
    const dialogGameService = new DialogGameService();


    const loadGames = async () => {
        try {
            setLoading(true);
            const gamesList = await dialogGameService.getAllGames();

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

        const selectedGame = games.find(game => game.id === selectedGameId);
        if (!selectedGame) {
            return;
        }

        try {
            await dialogGameService.setGameActive(selectedGameId);

            // 发送激活游戏变更事件
            const updatedGame = { ...selectedGame, isActive: true };
            await emitEvent('active-game-change', updatedGame);

            // 重新加载列表以确保状态最新
            await loadGames();
            setIsModalOpen(false);
            emitVoidEvent("select-game-dialog-closed");
        } catch (error) {
            console.error('error.updateActiveGame:', error);
            message.error(t("error.updateActiveGame"));
        }
    };

    const handleCancel = () => {
        setIsModalOpen(false);
        emitVoidEvent("select-game-dialog-closed");
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
        const isRc = game?.name?.toLowerCase() === 'rc';

        const result = await open({
            defaultPath: currentPath,
            filters: [{
                name: isRc ? 'RogueCore-*' : 'FSD-*',
                extensions: ['pak'],
            }],
            multiple: false,
        });

        if (result) {
            const validDrg = result.endsWith("FSD-WindowsNoEditor.pak") || result.endsWith("FSD-WinGDK.pak");
            const validRc = result.endsWith("RogueCore-Windows.pak");
            if ((isRc && validRc) || (!isRc && validDrg)) {
                await dialogGameService.updateGameInstallPath(gameId, result);
                await loadGames();
            } else {
                message.error(isRc ? t("game.pleaseSelectRoguePak") : t("game.pleaseSelectFsdPak"));
            }
        }
    };

    const onFindGamePathClick = async (gameId: number) => {
        const game = games.find(g => g.id === gameId);
        const gameName = game?.name ?? undefined;
        const path = await IntegrateApi.findGamePak(gameName);
        if (path) {
            await dialogGameService.updateGameInstallPath(gameId, path);
            await loadGames();
        } else {
            message.error(gameName === 'rc' ? t("game.roguePakNotFound") : t("game.fsdPakNotFound"));
        }
    };

    useEffect(() => {
        loadGames().then();
    }, []);

    // 每次打开弹窗时重新拉取游戏列表（含 installPath），避免配置迁移等操作后路径未刷新
    useEffect(() => {
        if (isModalOpen) {
            loadGames().then();
        }
    }, [isModalOpen]);

    useEventListener("select-game-dialog-open", () => {
        setIsModalOpen(true);
    });

    const renderGameItem = (game: GameData) => {
        const isSelected = selectedGameId === game.id;
        const currentPath = game.installPath || "";

        return (
            <div
                key={game.id}
                onClick={() => onGameChange(game.id!)}
                className={isSelected ? 'select-game-item-selected' : 'select-game-item'}
            >
                {isSelected && (
<div className="select-game-check">
                        <CheckCircleFilled className="select-game-check-icon"/>
                    </div>
                )}

                <Flex vertical gap="middle">
                    <Flex justify="space-between" align="start">
                        <Flex gap="middle" align="center">
                            <div className={isSelected ? 'select-game-icon-selected' : 'select-game-icon'}>
                                <img
                                    src={game.icon}
                                    alt={game.displayName}
                                    className="select-game-icon-img"
                                />
                            </div>
                            <Flex vertical gap={2}>
                                <Text strong className="select-game-name">{game.displayName}</Text>
                                <Flex gap="small" align="center">
                                    <Text type="secondary" className="select-game-id">ID: {game.name}</Text>
                                    {game.isActive && (
                                        <Tag color="success" className="select-game-active-tag">
                                            {t("Active")}
                                        </Tag>
                                    )}
                                </Flex>
                            </Flex>
                        </Flex>
                    </Flex>

<div className={isSelected ? 'select-game-path-selected' : 'select-game-path'} onClick={e => e.stopPropagation()}>
                        <Flex vertical gap="small">
                            <Text type="secondary" className="select-game-path-label">{t("Install Path")}</Text>
                            <Flex gap="small">
                                <Input
                                    value={currentPath}
                                    placeholder={t("Select game executable path")}
                                    readOnly
                                    className="select-game-path-input"
                                    prefix={<FolderOpenOutlined className="select-game-path-input-icon"/>}
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
            zIndex={1200}
            onOk={handleOk}
            onCancel={handleCancel}
            width={520}
            centered
            styles={{
                header: {
                    borderBottom: "none",
                    marginBottom: 0,
                },
                footer: {
                    borderTop: "none",
                    marginTop: 0,
                },
            }}
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
            <Flex vertical gap="large" className="select-game-modal-body">
                <div className="select-game-list-container">
                    {loading ? (
                        <Flex justify="center" align="center" className="select-game-empty">
                            <Text type="secondary">{t("Loading games...")}</Text>
                        </Flex>
                    ) : games && games.length > 0 ? (
                        <Flex vertical gap="small">
                            {games.map(renderGameItem)}
                        </Flex>
                    ) : (
                        <Flex justify="center" align="center" className="select-game-no-data">
                            <Flex vertical align="center" gap="small">
                                <RocketOutlined className="select-game-no-data-icon"/>
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
