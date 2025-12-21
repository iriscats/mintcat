import React, {useState, useEffect, useImperativeHandle, forwardRef} from 'react';
import {t} from "i18next";
import {Button, Flex, List, message, Radio, Typography, Modal} from 'antd';
import {GameData} from "@/storage/dao/GameDAO.ts";
import {StorageAPI} from "@/storage";
import {listen} from "@tauri-apps/api/event";

const {Text} = Typography;

export interface SelectGameDialogResult {
    gameId?: number;
    gameData?: GameData;
}

export interface SelectGameDialogRef {
    show: () => void;
}

export const SelectGameDialog = forwardRef<SelectGameDialogRef>((props, ref) => {
    const [games, setGames] = useState<GameData[]>([]);
    const [selectedGameId, setSelectedGameId] = useState<number | undefined>();
    const [loading, setLoading] = useState<boolean>(true);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);


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

        const selectedGame = games.find(game => game.id === selectedGameId);

        // onOk({
        //     gameId: selectedGameId,
        //     gameData: selectedGame
        // } as SelectGameDialogResult);
        setIsModalOpen(false);
    };

    const handleCancel = () => {
        //onCancel();
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

    useEffect(() => {
        loadGames().then();
    }, []);

    listen("select-game-dialog-open", async () => {
        setIsModalOpen(true);
    }).then();

    const renderGameItem = (game: GameData) => {
        return (
            <List.Item
                key={game.id}
                style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: '1px solid #d9d9d9',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedGameId === game.id ? '#f0f9ff' : '#fff',
                    borderColor: selectedGameId === game.id ? '#1890ff' : '#d9d9d9'
                }}
                onClick={() => onGameChange(game.id!)}
            >
                <Flex vertical gap="small" style={{width: '100%'}}>
                    <Flex justify="space-between" align="center">
                        <Text strong style={{fontSize: '16px'}}>
                            {game.displayName}
                        </Text>
                        <Radio
                            checked={selectedGameId === game.id}
                            onChange={() => onGameChange(game.id!)}
                        />
                    </Flex>
                    <Text type="secondary" style={{fontSize: '14px'}}>
                        {t("Game ID")}: {game.name}
                    </Text>
                    {game.installPath && (
                        <Text type="secondary" style={{fontSize: '12px'}}>
                            {t("Install Path")}: {game.installPath}
                        </Text>
                    )}
                    <Flex gap="small">
                        {game.isActive && (
                            <span style={{
                                backgroundColor: '#52c41a',
                                color: '#fff',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '12px'
                            }}>
                                {t("Active")}
                            </span>
                        )}
                    </Flex>
                </Flex>
            </List.Item>
        );
    };

    return (
        <Modal
            title={t("Select Game")}
            open={isModalOpen}
            onOk={handleOk}
            onCancel={handleCancel}
            width={500}
            footer={[
                <Button key="cancel" onClick={handleCancel}>
                    Cancel
                </Button>,
                <Button
                    key="ok"
                    type="primary"
                    onClick={handleOk}
                    disabled={!selectedGameId}
                >
                    OK
                </Button>
            ]}
        >
            <Flex vertical gap="large" style={{minHeight: '300px'}}>
                <div>
                    <Text type="secondary">
                        {t("Please select the game you want to manage mods for")}
                    </Text>
                </div>

                <div style={{flex: 1, overflow: 'auto', maxHeight: '400px'}}>
                    {loading ? (
                        <Flex justify="center" align="center" style={{height: '200px'}}>
                            <Text>{t("Loading games...")}</Text>
                        </Flex>
                    ) : games && games.length > 0 ? (
                        <List
                            dataSource={games}
                            renderItem={renderGameItem}
                            style={{width: '100%'}}
                            size="small"
                        />
                    ) : (
                        <Flex justify="center" align="center" style={{height: '200px'}}>
                            <Text type="secondary">
                                {t("No games available")}
                            </Text>
                        </Flex>
                    )}
                </div>
            </Flex>
        </Modal>
    );
});