import { invoke } from '@tauri-apps/api/core';
import { t } from 'i18next';
import React from 'react';
import { Button, Card, Flex, Form, Input, List, Radio, Space, Typography, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

import { StorageAPI } from '@/storage';
import { ButtonLayout, SettingLayout } from '@/pages/SettingPage/Layout.ts';
import { useEventListener } from '@/events';
import {
    setMintcatProxyModeResolved,
    type MintcatProxyMode,
} from '@/services/network';
import {
    getMintcatApiOriginLanguageFallback,
    getMintcatOriginByPresetId,
    getMintcatOriginLabelKey,
    isMintcatApiOriginId,
    MINTCAT_API_ORIGINS,
    normalizeMintcatApiOrigin,
    setMintcatApiResolvedOrigin,
} from '@/apis/mintcat/urls';
import {
    NETWORK_SERVER_AUTO_ORIGIN_KEY,
    NETWORK_SERVER_MODE_KEY,
    type MintcatServerMode,
    probeOrigin,
    type ProbeResult,
    probeAllOrigins,
    refreshAutoMintcatApiRoutingInBackground,
} from '@/apis/mintcat/routing';

const { Text } = Typography;

/** 设置界面仅保留 auto / 内置节点；历史 custom 迁移为 auto */
type ServerModeUi = Exclude<MintcatServerMode, 'custom'>;

function probeResultLabel(key: ProbeResult['key']): string {
    return key === 'unknown' ? key : t(getMintcatOriginLabelKey(key));
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
    const [mintcatProxyMode, setMintcatProxyMode] = React.useState<MintcatProxyMode>('auto');
    const [probeResults, setProbeResults] = React.useState<ProbeResult[]>([]);
    const [probing, setProbing] = React.useState(false);

    const applyRuntimeForMode = React.useCallback(async (mode: ServerModeUi) => {
        const settings = await StorageAPI.getSettings();
        if (mode !== 'auto') {
            setMintcatApiResolvedOrigin(getMintcatOriginByPresetId(mode));
            return;
        }
        const cached = (await settings.getValue(NETWORK_SERVER_AUTO_ORIGIN_KEY))?.trim() ?? '';
        if (cached) {
            const normalizedCached = normalizeMintcatApiOrigin(cached);
            const probe = await probeOrigin(normalizedCached, 1500);
            if (probe.ok) {
                setMintcatApiResolvedOrigin(normalizedCached);
                void refreshAutoMintcatApiRoutingInBackground();
                return;
            }
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
        const uiMode: ServerModeUi = mode === 'auto' ? 'auto' : isMintcatApiOriginId(mode) ? mode : 'auto';
        setServerMode(uiMode);
        setNetworkProxy(await settings.getNetworkProxy());
        setMintcatProxyMode(await settings.getMintcatProxyMode());
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
        await settings.setNetworkProxy(trimmed);
        await invoke('set_network_proxy', { proxy: trimmed || null });
    };

    const onMintcatProxyModeChange = async (e: any) => {
        const mode = e.target.value as MintcatProxyMode;
        setMintcatProxyMode(mode);
        setMintcatProxyModeResolved(mode);
        const settings = await StorageAPI.getSettings();
        await settings.setMintcatProxyMode(mode);
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
                        <Space orientation="vertical">
                            <Radio value="auto">{t('Auto Select')}</Radio>
                            {MINTCAT_API_ORIGINS.map((origin) => (
                                <Radio key={origin.id} value={origin.id}>
                                    {t(origin.labelKey)}
                                </Radio>
                            ))}
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
                                        <Space orientation="vertical" style={{ width: '100%' }}>
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
                <Form.Item label={t('MintCat Proxy')}>
                    <Flex vertical gap={8}>
                        <Radio.Group onChange={onMintcatProxyModeChange} value={mintcatProxyMode}>
                            <Space orientation="vertical">
                                <Radio value="auto">{t('MintCat Proxy Auto')}</Radio>
                                <Radio value="enabled">{t('MintCat Proxy Enabled')}</Radio>
                                <Radio value="disabled">{t('MintCat Proxy Disabled')}</Radio>
                            </Space>
                        </Radio.Group>
                    </Flex>
                </Form.Item>
            </Form>
        </Card>
    );
}
