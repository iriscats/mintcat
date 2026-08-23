import { t } from 'i18next';
import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue';
import { invoke } from '@tauri-apps/api/core';
import { arch, platform } from '@tauri-apps/plugin-os';
import packageJson from '../../package.json';
import {
    compareVersion,
    getDownloadUrl,
    getManifestItemChecksum,
    getManifestItemDownloadPath,
    matchesFrontendUpdate,
    matchesIntegratorRuntime,
    matchesManifestPlatform,
    matchesProxyRuntime,
    prefetchUpdateManifest,
} from '@/apis/mintcat';
import { StorageAPI } from '@/storage';

type IntegratorRuntimeStatus = {
    activeVersion?: string | null;
};

type FrontendUpdateStatus = {
    activeVersion?: string | null;
};

@Task({
    type: 'startup_update_check',
    name: t('Check Updates'),
    description: t('Check update manifest on startup'),
    schema: null,
    estimatedDuration: 5,
})
export class StartupUpdateCheckTask implements ITask {
    async run(context: ITaskContext): Promise<void> {
        await context.setStep(t('Check Updates'), 1, 1);
        await context.setMessage(t('Checking updates...'));
        await context.updateProgress(10);

        const manifest = await prefetchUpdateManifest();
        const currentPlatform = platform();
        const currentArch = arch();
        await context.updateProgress(30);

        try {
            const settings = await StorageAPI.getSettings();
            const channel = await settings.getReleaseChannel();
            const frontend = manifest.find((item) => matchesFrontendUpdate(item, channel));

            if (frontend?.latestVersion) {
                const status = await invoke<FrontendUpdateStatus>('get_frontend_update_status');
                const currentVersion = status.activeVersion || packageJson.version;

                if (compareVersion(frontend.latestVersion, currentVersion) > 0) {
                    const url = getManifestItemDownloadPath(frontend);
                    const checksum = getManifestItemChecksum(frontend);
                    if (url && checksum) {
                        await context.setMessage(t('Downloading frontend update...'));
                        await invoke('install_frontend_update_from_manifest', {
                            manifest: {
                                version: frontend.latestVersion,
                                releaseSetId: frontend.releaseSetId ?? `frontend-${frontend.latestVersion}-${channel}`,
                                channel,
                                platform: frontend.platform ?? currentPlatform,
                                arch: frontend.arch ?? currentArch,
                                url: getDownloadUrl(url),
                                sha256: frontend.sha256,
                                md5: frontend.md5,
                                checksum: frontend.checksum,
                                signature: frontend.signature,
                                minAppVersion: frontend.minAppVersion,
                                maxAppVersion: frontend.maxAppVersion,
                                entry: frontend.entry ?? 'index.html',
                            },
                        });
                        await context.setMessage(t('Frontend update downloaded; restart to apply'));
                        await context.updateProgress(100);
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('[StartupUpdateCheckTask] Frontend update failed:', error);
        }

        await context.updateProgress(60);

        try {
            const settings = await StorageAPI.getSettings();
            const channel = await settings.getReleaseChannel();
            const integrator = manifest.find((item) => (
                matchesIntegratorRuntime(item, channel)
                && matchesManifestPlatform(item, currentPlatform, currentArch)
                && (currentPlatform !== 'macos' || Boolean(item.platform))
            ));
            if (integrator?.latestVersion) {
                const status = await invoke<IntegratorRuntimeStatus>('get_integrator_runtime_status');
                if (status.activeVersion !== integrator.latestVersion) {
                    const url = getManifestItemDownloadPath(integrator);
                    const md5 = integrator.md5;
                    if (url && md5) {
                        await invoke('install_integrator_runtime_from_manifest', {
                            manifest: {
                                version: integrator.latestVersion,
                                url: getDownloadUrl(url),
                                md5,
                                signature: integrator.signature,
                                minAppVersion: integrator.minAppVersion,
                                maxAppVersion: integrator.maxAppVersion,
                            },
                        });
                    }
                }
            }
        } catch (error) {
            console.warn('[StartupUpdateCheckTask] Integrator runtime update failed:', error);
        }

        const proxyRuntime = manifest.find(matchesProxyRuntime);
        if (proxyRuntime?.latestVersion) {
            localStorage.setItem('mintcat_proxy_latest_version', proxyRuntime.latestVersion);
        }

        await context.setMessage(t('Check Updates Finished'));
        await context.updateProgress(100);
    }
}
