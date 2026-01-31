import { t } from "i18next";
import React from "react";
import { Button, Card, Divider, Flex, Input, message, Space, Table, Tag, Typography } from "antd";
import {
    CloudUploadOutlined,
    DeleteOutlined,
    DownloadOutlined,
    ReloadOutlined,
    RollbackOutlined,
} from "@ant-design/icons";
import { save } from "@tauri-apps/plugin-dialog";

import { CloudBackupApi, type CloudBackupRecord } from "@/apis/CloudBackupApi";
import { MessageBox } from "@/components/MessageBox";

const { Text } = Typography;

function formatBytes(bytes?: number): string {
    if (bytes === undefined || Number.isNaN(bytes)) {
        return "-";
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }
    const units = ["KB", "MB", "GB", "TB"];
    let value = bytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function formatDate(value?: string): string {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
}

function buildDefaultFileName(createdAt?: string): string {
    const stamp = createdAt ? new Date(createdAt).toISOString() : new Date().toISOString();
    const safeStamp = stamp.replace(/[:.]/g, "-");
    return `mintcat-backup-${safeStamp}.sqlite`;
}

function formatError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
}

export function CloudBackupSettings() {
    const [note, setNote] = React.useState<string>("");
    const [backups, setBackups] = React.useState<CloudBackupRecord[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [backingUp, setBackingUp] = React.useState(false);
    const [downloadId, setDownloadId] = React.useState<string | null>(null);
    const [restoreId, setRestoreId] = React.useState<string | null>(null);
    const [deleteId, setDeleteId] = React.useState<string | null>(null);

    const loadBackups = async () => {
        setLoading(true);
        try {
            const list = await CloudBackupApi.listBackups();
            setBackups(list);
        } catch (error) {
            console.error("[CloudBackup] Failed to load backups:", error);
            message.error(`${t("Backup List Failed")}: ${formatError(error)}`);
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        loadBackups().then();
    }, []);

    const onBackupNow = async () => {
        setBackingUp(true);
        try {
            await CloudBackupApi.createBackup(note);
            message.success(t("Backup Created"));
            setNote("");
            await loadBackups();
        } catch (error) {
            console.error("[CloudBackup] Backup failed:", error);
            message.error(`${t("Backup Failed")}: ${formatError(error)}`);
        } finally {
            setBackingUp(false);
        }
    };

    const onDownload = async (item: CloudBackupRecord) => {
        const target = await save({
            defaultPath: buildDefaultFileName(item.createdAt),
            filters: [
                { name: "SQLite", extensions: ["sqlite"] },
            ],
        });
        if (!target) {
            return;
        }
        setDownloadId(item.id);
        try {
            await CloudBackupApi.downloadBackupToPath(item.id, target);
            message.success(t("Backup Downloaded"));
        } catch (error) {
            console.error("[CloudBackup] Download failed:", error);
            message.error(`${t("Backup Download Failed")}: ${formatError(error)}`);
        } finally {
            setDownloadId(null);
        }
    };

    const onRestore = async (item: CloudBackupRecord) => {
        const confirmed = await MessageBox.confirm({
            title: t("Restore"),
            content: t("Restore will replace local data after restart. Continue?"),
        });
        if (!confirmed) {
            return;
        }
        setRestoreId(item.id);
        try {
            await CloudBackupApi.prepareRestore(item.id);
            message.success(t("Backup Restore Prepared"));
        } catch (error) {
            console.error("[CloudBackup] Restore failed:", error);
            message.error(`${t("Backup Restore Failed")}: ${formatError(error)}`);
        } finally {
            setRestoreId(null);
        }
    };

    const onDelete = async (item: CloudBackupRecord) => {
        const confirmed = await MessageBox.confirm({
            title: t("Delete"),
            content: t("Delete Backup Confirm"),
        });
        if (!confirmed) {
            return;
        }
        setDeleteId(item.id);
        try {
            await CloudBackupApi.deleteBackup(item.id);
            message.success(t("Backup Deleted"));
            await loadBackups();
        } catch (error) {
            console.error("[CloudBackup] Delete failed:", error);
            message.error(`${t("Backup Delete Failed")}: ${formatError(error)}`);
        } finally {
            setDeleteId(null);
        }
    };

    return (
        <Card title={t("Cloud Backup")} style={{ marginBottom: "10px" }}>
            <Space.Compact style={{ width: "100%", marginBottom: 16 }}>
                <Input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={t("Optional note for this backup")}
                    style={{ flex: 1 }}
                />
                <Button
                    type="primary"
                    icon={<CloudUploadOutlined />}
                    loading={backingUp}
                    onClick={onBackupNow}
                >
                    {t("Backup Now")}
                </Button>
                <Button
                    icon={<ReloadOutlined />}
                    loading={loading}
                    onClick={loadBackups}
                >
                    {t("Refresh")}
                </Button>
            </Space.Compact>
            <Divider />
            <Flex vertical gap={12}>
                <Text strong>{t("Backup History")}</Text>
                <Table
                    loading={loading}
                    dataSource={backups}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    locale={{ emptyText: t("No backups yet") }}
                    columns={[
                        {
                            title: t("Time"),
                            dataIndex: "createdAt",
                            key: "createdAt",
                            width: 180,
                            render: (value: string) => formatDate(value),
                        },
                        {
                            title: t("Size"),
                            dataIndex: "size",
                            key: "size",
                            width: 100,
                            render: (value: number) => formatBytes(value),
                        },
                        {
                            title: t("Version"),
                            dataIndex: "appVersion",
                            key: "appVersion",
                            width: 80,
                            render: (value: string) => value ? <Tag color="purple">{value}</Tag> : "-",
                        },
                        {
                            title: t("Note"),
                            dataIndex: "note",
                            key: "note",
                            ellipsis: true,
                            render: (value: string) => value || "-",
                        },
                        {
                            title: t("Actions"),
                            key: "actions",
                            width: 200,
                            render: (_: unknown, item: CloudBackupRecord) => (
                                <Space size={0}>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<DownloadOutlined />}
                                        loading={downloadId === item.id}
                                        onClick={() => onDownload(item)}
                                    >
                                        {t("Download")}
                                    </Button>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<RollbackOutlined />}
                                        loading={restoreId === item.id}
                                        onClick={() => onRestore(item)}
                                    >
                                        {t("Restore")}
                                    </Button>
                                    <Button
                                        type="text"
                                        size="small"
                                        danger
                                        icon={<DeleteOutlined />}
                                        loading={deleteId === item.id}
                                        onClick={() => onDelete(item)}
                                    >
                                        {t("Delete")}
                                    </Button>
                                </Space>
                            ),
                        },
                    ]}
                />
            </Flex>
        </Card>
    );
}
