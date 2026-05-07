import { invoke } from '@tauri-apps/api/core';

const HOT_FRONTEND_URL = 'mintcat-hot://localhost/index.html#/home';

type FrontendUpdateStatus = {
    hasLocalBundle: boolean;
};

function normalizeHref(value: string): string {
    try {
        return decodeURIComponent(value).replace(/\\/g, '/').toLowerCase();
    } catch {
        return value.replace(/\\/g, '/').toLowerCase();
    }
}

export function isHotFrontendLocation(): boolean {
    const href = normalizeHref(window.location.href);
    return href.includes('/frontend/versions/')
        || href.includes('mintcathot.localhost')
        || href.includes('mintcat-hot.localhost')
        || href.startsWith('mintcathot:')
        || href.startsWith('mintcat-hot:');
}

export async function confirmFrontendUpdateIfHot(): Promise<void> {
    if (!isHotFrontendLocation()) return;
    await invoke('mark_frontend_update_ok');
}

export async function activateInstalledHotFrontend(reason: string): Promise<boolean> {
    if (isHotFrontendLocation()) return false;

    const status = await invoke<FrontendUpdateStatus>('get_frontend_update_status');
    if (!status.hasLocalBundle) return false;

    console.log('[FrontendUpdate] Activating hot frontend', { reason, url: HOT_FRONTEND_URL });
    invoke('activate_frontend_update')
        .catch((error) => console.warn('[FrontendUpdate] Backend activation failed:', error));
    window.setTimeout(() => {
        window.location.replace(HOT_FRONTEND_URL);
    }, 250);
    return true;
}
