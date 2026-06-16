import React from 'react';
import {Badge, Button, Card, Collapse, Flex, message, Space, Spin, Tag, theme, Typography} from 'antd';
import {
    DownloadOutlined,
    FileTextOutlined,
    SafetyCertificateOutlined,
    SettingOutlined,
    ThunderboltOutlined,
} from '@ant-design/icons';
import {t} from 'i18next';
import {openPath} from '@tauri-apps/plugin-opener';
import {
    findProxyRuntimeManifest,
    getProxyRuntimeStatus,
    installProxyCert,
    installProxyRuntimeFromManifest,
    listenProxyRuntimeLog,
    listenProxyRuntimeState,
    startProxyRuntime,
    stopProxyRuntime,
    type ProxyRuntimeStatus,
} from '@/apis/proxyRuntime';
import {compareVersion, type UpdateCheckManifestItem} from '@/apis/mintcat';
import './styles.css';

const LOG_LIMIT = 200;

function formatElapsed(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const secs = safeSeconds % 60;
    return [hours, minutes, secs].map((part) => String(part).padStart(2, '0')).join(':');
}

export function AcceleratorPage() {
    const {token} = theme.useToken();
    const [status, setStatus] = React.useState<ProxyRuntimeStatus | null>(null);
    const [manifest, setManifest] = React.useState<UpdateCheckManifestItem | undefined>();
    const [logs, setLogs] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [busy, setBusy] = React.useState<string | null>(null);
    const [elapsed, setElapsed] = React.useState(0);

    const loadStatus = React.useCallback(async () => {
        const [runtimeStatus, latest] = await Promise.all([
            getProxyRuntimeStatus(),
            findProxyRuntimeManifest(false).catch(() => undefined),
        ]);
        setStatus(runtimeStatus);
        setManifest(latest);
    }, []);

    React.useEffect(() => {
        let mounted = true;
        loadStatus()
            .catch((error) => {
                console.warn('[AcceleratorPage] load status failed:', error);
                message.error(t('accelerator.loadStatusFailed'));
            })
            .finally(() => mounted && setLoading(false));
        return () => {
            mounted = false;
        };
    }, [loadStatus]);

    React.useEffect(() => {
        let unlistenLog: (() => void) | undefined;
        let unlistenState: (() => void) | undefined;
        listenProxyRuntimeLog((event) => {
            setLogs((previous) => [...previous, event.line].slice(-LOG_LIMIT));
        }).then((fn) => {
            unlistenLog = fn;
        });
        listenProxyRuntimeState((nextStatus) => {
            setStatus(nextStatus);
        }).then((fn) => {
            unlistenState = fn;
        });
        return () => {
            unlistenLog?.();
            unlistenState?.();
        };
    }, []);

    React.useEffect(() => {
        if (!status?.running || !status.startedAt) {
            setElapsed(0);
            return;
        }
        const tick = () => {
            setElapsed(Math.max(0, Math.floor(Date.now() / 1000) - status.startedAt!));
        };
        tick();
        const timer = window.setInterval(tick, 1000);
        return () => window.clearInterval(timer);
    }, [status?.running, status?.startedAt]);

    const latestVersion = manifest?.latestVersion;
    const currentVersion = status?.activeVersion ?? null;
    const hasUpdate = Boolean(latestVersion && currentVersion && currentVersion !== 'bundled' && compareVersion(latestVersion, currentVersion) > 0);
    const installButtonText = status?.installed
        ? (hasUpdate ? t('Update plugin') : t('Reinstall plugin'))
        : t('Install plugin');

    const runAction = async (key: string, action: () => Promise<ProxyRuntimeStatus | void>) => {
        setBusy(key);
        try {
            const nextStatus = await action();
            if (nextStatus) {
                setStatus(nextStatus);
            }
            await loadStatus();
        } catch (error) {
            console.error(`[AcceleratorPage] ${key} failed:`, error);
            message.error(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(null);
        }
    };

    const onRefreshManifest = async () => {
        setBusy('refresh');
        try {
            const latest = await findProxyRuntimeManifest(true);
            setManifest(latest);
            message.success(latest ? t('Found Update') : t('accelerator.noPluginRelease'));
        } catch (error) {
            console.error('[AcceleratorPage] refresh manifest failed:', error);
            message.error(t('error.release_check_network'));
        } finally {
            setBusy(null);
        }
    };

    const onInstallRuntime = async () => {
        await runAction('install', async () => {
            const latest = manifest ?? await findProxyRuntimeManifest(true);
            if (!latest) {
                throw new Error(t('accelerator.noPluginRelease'));
            }
            return installProxyRuntimeFromManifest(latest);
        });
    };

    const onInstallCert = async () => {
        await runAction('cert', installProxyCert);
    };

    const onStartStop = async () => {
        if (status?.running) {
            await runAction('stop', stopProxyRuntime);
            return;
        }
        await runAction('start', () => startProxyRuntime({port: 443}));
    };

    const onOpenLog = async () => {
        if (status?.logPath) {
            await openPath(status.logPath);
        }
    };

    if (loading || !status) {
        return (
            <Flex align="center" justify="center" style={{height: window.innerHeight - 81}}>
                <Spin tip={t('Loading')}/>
            </Flex>
        );
    }

    const isToggling = busy === 'start' || busy === 'stop';
    const elapsedText = formatElapsed(elapsed);
    const buttonDisabled = !status.installed || isToggling;
    const buttonStateClass = status.running
        ? 'accelerator-page__button--running'
        : status.installed
            ? 'accelerator-page__button--idle'
            : 'accelerator-page__button--disabled';
    const acceleratorThemeStyle = {
        height: window.innerHeight - 81,
        '--accelerator-primary': token.colorPrimary,
        '--accelerator-primary-hover': token.colorPrimaryHover,
        '--accelerator-primary-active': token.colorPrimaryActive,
        '--accelerator-primary-bg': token.colorPrimaryBg,
        '--accelerator-page-bg': token.colorBgLayout,
        '--accelerator-surface': token.colorBgContainer,
        '--accelerator-disabled-bg': token.colorFillSecondary,
        '--accelerator-muted': token.colorTextTertiary,
        '--accelerator-button-text': token.colorTextLightSolid,
    } as React.CSSProperties;

    return (
        <div
            id="scrollableDiv"
            className="scrollable-div accelerator-page"
            style={acceleratorThemeStyle}
        >
            <div className="accelerator-page__header">
                <Typography.Title level={5} className="accelerator-page__title">
                    <Space>
                        <ThunderboltOutlined/>
                        <span>{t('Accelerator')}</span>
                    </Space>
                </Typography.Title>
                <div className="accelerator-page__header-actions">
                    <Space wrap className="accelerator-page__quick-actions">
                        <Button
                            icon={<DownloadOutlined/>}
                            loading={busy === 'install'}
                            onClick={onInstallRuntime}
                        >
                            {installButtonText}
                        </Button>
                        <Button
                            loading={busy === 'refresh'}
                            onClick={onRefreshManifest}
                        >
                            {t('Check Updates')}
                        </Button>
                        <Button
                            icon={<SafetyCertificateOutlined/>}
                            disabled={!status.installed}
                            loading={busy === 'cert'}
                            onClick={onInstallCert}
                        >
                            {status.hasCertInstalled ? t('accelerator.reinstallCert') : t('Install CA certificate')}
                        </Button>
                    </Space>
                </div>
            </div>

                <div className="accelerator-page__hero">
                    <div className="accelerator-page__orb">
                        {status.running && (
                            <>
                                <span className="accelerator-page__ring accelerator-page__ring--outer"/>
                                <span className="accelerator-page__ring accelerator-page__ring--inner"/>
                                <span className="accelerator-page__pulse accelerator-page__pulse--one"/>
                                <span className="accelerator-page__pulse accelerator-page__pulse--two"/>
                                <span className="accelerator-page__particle accelerator-page__particle--one"/>
                                <span className="accelerator-page__particle accelerator-page__particle--two"/>
                                <span className="accelerator-page__particle accelerator-page__particle--three"/>
                            </>
                        )}
                        <button
                            type="button"
                            className={`accelerator-page__button ${buttonStateClass}`}
                            disabled={buttonDisabled}
                            onClick={onStartStop}
                            aria-label={status.running ? t('Stop acceleration') : t('Start acceleration')}
                        >
                            <span className="accelerator-page__button-icon">
                                {isToggling ? <Spin size="large"/> : <ThunderboltOutlined/>}
                            </span>
                            <span className="accelerator-page__button-primary">
                                {status.running ? elapsedText : t('Start acceleration')}
                            </span>
                            <span className="accelerator-page__button-secondary">
                                {!status.installed
                                    ? t('accelerator.heroDisabled')
                                    : status.running
                                        ? t('Stop acceleration')
                                        : t('accelerator.heroIdle')}
                            </span>
                        </button>
                    </div>

                    <Space className="accelerator-page__hero-state-tags">
                        <Tag color={status.installed ? 'green' : 'default'}>
                            {status.installed ? t('accelerator.pluginInstalled') : t('Plugin not installed')}
                        </Tag>
                        <Tag color={status.running ? 'processing' : 'default'}>
                            {status.running ? t('Running') : t('Stopped')}
                        </Tag>
                    </Space>

                    <Flex wrap gap={12} align="center" justify="center" className="accelerator-page__status-strip">
                        <Space size={6}>
                            <Badge status={status.running ? 'processing' : status.installed ? 'success' : 'default'}/>
                            <Typography.Text>
                                {t('Version')}: {currentVersion ?? t('Unknown')}
                            </Typography.Text>
                        </Space>
                        {latestVersion && (
                            <Typography.Text type="secondary">
                                {t('Latest')}: {latestVersion}
                            </Typography.Text>
                        )}
                        {status.pid && <Typography.Text type="secondary">PID: {status.pid}</Typography.Text>}
                    </Flex>
                </div>

                <Collapse
                    ghost
                    className="accelerator-page__advanced"
                    items={[
                        {
                            key: 'advanced',
                            label: (
                                <Space>
                                    <SettingOutlined/>
                                    <span>{t('accelerator.advanced')}</span>
                                </Space>
                            ),
                            children: (
                                <Flex vertical gap={16}>
                                    <Card
                                        size="small"
                                        title={t('accelerator.runtimeLog')}
                                        extra={
                                            <Button
                                                type="link"
                                                icon={<FileTextOutlined/>}
                                                disabled={!status.logPath}
                                                onClick={onOpenLog}
                                            >
                                                {t('Open')}
                                            </Button>
                                        }
                                    >
                                        {logs.length === 0 ? (
                                            <Typography.Text type="secondary">{t('accelerator.noLogs')}</Typography.Text>
                                        ) : (
                                            <pre className="accelerator-page__log">
                                                {logs.join('\n')}
                                            </pre>
                                        )}
                                    </Card>
                                </Flex>
                            ),
                        },
                    ]}
                />
        </div>
    );
}
