import { invoke } from '@tauri-apps/api/core';
import { t } from 'i18next';
import React from 'react';
import { Button, Card, Flex, Form, Input, List, Radio, Space, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import { StorageAPI } from '@/storage';
import { ButtonLayout, SettingLayout } from '@/pages/SettingPage/Layout.ts';
import { useEventListener } from '@/events';
import {
    getMintcatApiOriginLanguageFallback,
    getMintcatOriginByPresetId,
    normalizeMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from '@/apis/mintcat/urls';
import {
    NETWORK_SERVER_AUTO_ORIGIN_KEY,
    NETWORK_SERVER_MODE_KEY,
    type MintcatServerMode,
    type ProbeResult,
    probeAllOrigins,
    refreshAutoMintcatApiRoutingInBackground,
} from '@/apis/mintcat/routing';

const { Text } = Typography;

/** 设置界面仅保留 auto / zh / global；历史 custom 迁移为 auto */
type ServerModeUi = 'auto' | 'zh' | 'global';

function probeResultLabel(key: string): string {
    if (key === 'zh') {
        return t('China Mainland Node');
    }
    if (key === 'global') {
        return t('International Node');
    }
    return key;
}

function formatProbeError(err?: string): string {
    if (!err) {
        return t('Unreachable');
    }
    if (err === 'timeout') {
        return t('Timeout');
    }
    return err;
}

export function NetworkSettings() {
    const [serverMode, setServerMode] = React.useState<ServerModeUi>('auto');
    const [networkProxy, setNetworkProxy] = React.useState('');
    const [probeResults, setProbeResults] = React.useState<ProbeResult[]>([]);
    const [probing, setProbing] = React.useState(false);

    const applyRuntimeForMode = React.useCallback(async (mode: ServerModeUi) => {
        const settings = await StorageAPI.getSettings();
        if (mode === 'zh') {
            setMintcatApiResolvedOrigin(getMintcatOriginByPresetId('zh'));
            return;
        }
        if (mode === 'global') {
            setMintcatApiResolvedOrigin(getMintcatOriginByPresetId('global'));
            return;
        }
        const cached = (await settings.getValue(NETWORK_SERVER_AUTO_ORIGIN_KEY))?.trim() ?? '';
        if (cached) {
            setMintcatApiResolvedOrigin(normalizeMintcatApiOrigin(cached));
            void refreshAutoMintcatApiRoutingInBackground();
            return;
        }
        setMintcatApiResolvedOrigin(getMintcatApiOriginLanguageFallback());
        void refreshAutoMintcatApiRoutingInBackground();
    }, []);

    const fetchSettings = React.useCallback(async () => {
        const settings = await StorageAPI.getSettings();
        let modeRaw = await settings.getValue(NETWORK_SERVER_MODE_KEY);
        let mode: MintcatServerMode = (modeRaw?.trim() as MintcatServerMode) || 'auto';
        if (mode === 'custom') {
            await settings.setValue(NETWORK_SERVER_MODE_KEY, 'auto');
            mode = 'auto';
        }
        const uiMode: ServerModeUi = mode === 'zh' || mode === 'global' ? mode : 'auto';
        setServerMode(uiMode);
        setNetworkProxy((await settings.getValue('network.proxy')) || '');
    }, []);

    React.useEffect(() => {
        void fetchSettings();
    }, [fetchSettings]);

    useEventListener('config-imported', () => {
        void fetchSettings();
    });

    const onServerModeChange = async (e: any) => {
        const mode = e.target.value as ServerModeUi;
        setServerMode(mode);
        const settings = await StorageAPI.getSettings();
        await settings.setValue(NETWORK_SERVER_MODE_KEY, mode);
        try {
            await applyRuntimeForMode(mode);
            message.success(t('Server changed'));
        } catch (err) {
            console.error('[NetworkSettings] Failed to apply server mode', err);
            message.error(t('Failed to apply server mode'));
        }
    };

    const onNetworkProxyChange = async (value: string) => {
        const trimmed = value?.trim() ?? '';
        setNetworkProxy(trimmed);
        const settings = await StorageAPI.getSettings();
        await settings.setValue('network.proxy', trimmed);
        await invoke('set_network_proxy', { proxy: trimmed || null });
    };

    const onTestConnection = async () => {
        setProbing(true);
        setProbeResults([]);
        try {
            const results = await probeAllOrigins();
            setProbeResults(results);
        } catch (e) {
            console.error('[NetworkSettings] Probe failed', e);
            message.error(t('Test Connection Failed'));
        } finally {
            setProbing(false);
        }
    };

    return (
        <Card title={t('Network Settings')} style={{ marginBottom: '10px' }}>
            <Form {...SettingLayout}>
                <Form.Item label={t('API Server')}>
                    <Radio.Group onChange={onServerModeChange} value={serverMode}>
                        <Space direction="vertical">
                            <Radio value="auto">{t('Auto Select')}</Radio>
                            <Radio value="zh">{t('China Mainland Node')}</Radio>
                            <Radio value="global">{t('International Node')}</Radio>
                        </Space>
                    </Radio.Group>
                </Form.Item>
                <Form.Item label={t('Test Connection')}>
                    <Flex vertical gap={8}>
                        <Button
                            type="default"
                            icon={<ReloadOutlined />}
                            loading={probing}
                            onClick={() => void onTestConnection()}
                            {...ButtonLayout}
                        >
                            {t('Test Connection')}
                        </Button>
                        {probeResults.length > 0 ? (
                            <List
                                size="small"
                                bordered
                                dataSource={probeResults}
                                renderItem={(item) => (
                                    <List.Item>
                                        <Space direction="vertical" style={{ width: '100%' }}>
                                            <Text strong>{probeResultLabel(item.key)}</Text>
                                            {item.ok ? (
                                                <Text type="success">
                                                    {t('Connected')}
                                                    {item.latencyMs != null ? ` ${item.latencyMs} ms` : ''}
                                                </Text>
                                            ) : (
                                                <Text type="danger">{formatProbeError(item.error)}</Text>
                                            )}
                                        </Space>
                                    </List.Item>
                                )}
                            />
                        ) : null}
                    </Flex>
                </Form.Item>
                <Form.Item label={t('Network Proxy')}>
                    <Input
                        placeholder="http://127.0.0.1:7890"
                        value={networkProxy}
                        onChange={(e) => setNetworkProxy(e.target.value)}
                        onBlur={(e) => void onNetworkProxyChange(e.target.value)}
                    />
                </Form.Item>
            </Form>
        </Card>
    );
}
