import { t } from 'i18next';
import { ITask, ITaskContext, Task } from 'tauri-plugin-task-queue';
import { invoke } from '@tauri-apps/api/core';
import { getDownloadUrl, prefetchUpdateManifest } from '@/apis/mintcat';

type IntegratorRuntimeStatus = {
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
                    const checksum = integrator.sha256 ?? integrator.checksum;
                    if (url && checksum) {
                        await invoke('install_integrator_runtime_from_manifest', {
                            manifest: {
                                version: integrator.latestVersion,
                                url: getDownloadUrl(url),
                                sha256: checksum,
                                checksum: integrator.checksum,
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
