import { t } from 'i18next';
import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue';
import { invoke } from '@tauri-apps/api/core';
import packageJson from '../../package.json';
import { getDownloadUrl, prefetchUpdateManifest, type UpdateCheckManifestItem } from '@/apis/mintcat';
import { StorageAPI } from '@/storage';
import { activateInstalledHotFrontend } from '@/utils/FrontendUpdateRuntime';

const HOT_FRONTEND_ACTIVATION_DELAY_MS = 250;

type IntegratorRuntimeStatus = {
    activeVersion?: string | null;
};

type FrontendUpdateStatus = {
    activeVersion?: string | null;
};

function normalize(value: string | undefined | null): string {
    return (value ?? '').trim().toLowerCase();
}

function compareVersion(left: string, right: string): number {
    const parse = (value: string) => value
        .split(/[.-]/)
        .map((part) => Number.parseInt(part, 10))
        .map((part) => (Number.isFinite(part) ? part : 0));
    const a = parse(left);
    const b = parse(right);
    const len = Math.max(a.length, b.length, 3);
    for (let i = 0; i < len; i++) {
        const diff = (a[i] ?? 0) - (b[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

function findFrontendUpdate(manifest: UpdateCheckManifestItem[], channel: string): UpdateCheckManifestItem | undefined {
    const requestedChannel = normalize(channel);
    return manifest.find((item) => {
        const name = normalize(item.name);
        const type = normalize(item.type);
        const itemChannel = normalize(item.channel);
        return itemChannel === requestedChannel && (name === 'mintcat-frontend' || (name === 'frontend' && type === 'frontend'));
    });
}

function activateHotFrontend(): void {
    window.setTimeout(() => {
        activateInstalledHotFrontend('startup update installed')
            .catch((error) => console.warn('[FrontendUpdate] Asset activation failed:', error));
    }, HOT_FRONTEND_ACTIVATION_DELAY_MS);
}

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
        await context.updateProgress(30);

        try {
            const settings = await StorageAPI.getSettings();
            const channel = await settings.getReleaseChannel();
            const frontend = findFrontendUpdate(manifest, channel);

            if (frontend?.latestVersion) {
                const status = await invoke<FrontendUpdateStatus>('get_frontend_update_status');
                const currentVersion = status.activeVersion || packageJson.version;

                if (compareVersion(frontend.latestVersion, currentVersion) > 0) {
                    const url = frontend.downloadUrl ?? frontend.url ?? frontend.path;
                    const checksum = frontend.sha256 ?? frontend.md5 ?? frontend.checksum;
                    if (url && checksum) {
                        await context.setMessage(t('Installing frontend update...'));
                        await invoke('install_frontend_update_from_manifest', {
                            manifest: {
                                version: frontend.latestVersion,
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
                        await context.setMessage(t('Frontend update installed'));
                        await context.updateProgress(100);
                        activateHotFrontend();
                        return;
                    }
                }
            }
        } catch (error) {
            console.warn('[StartupUpdateCheckTask] Frontend update failed:', error);
        }

        await context.updateProgress(60);

        const integrator = manifest.find((item) => {
            const name = item.name?.toLowerCase();
            const type = item.type?.toLowerCase();
            return name === 'mintcat-integrator' || (name === 'integrator' && type === 'runtime');
        });

        if (integrator?.latestVersion) {
            try {
                const status = await invoke<IntegratorRuntimeStatus>('get_integrator_runtime_status');
                if (status.activeVersion !== integrator.latestVersion) {
                    const url = integrator.downloadUrl ?? integrator.url ?? integrator.path;
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
            } catch (error) {
                console.warn('[StartupUpdateCheckTask] Integrator runtime update failed:', error);
            }
        }

        await context.setMessage(t('Update manifest loaded', { count: manifest.length }));
        await context.updateProgress(100);
    }
}
