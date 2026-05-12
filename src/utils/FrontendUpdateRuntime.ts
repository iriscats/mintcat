import { invoke } from '@tauri-apps/api/core';

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

export function frontendRouteUrl(route: string): string {
    const hashRoute = route.startsWith('#')
        ? route
        : `#${route.startsWith('/') ? route : `/${route}`}`;

    if (isHotFrontendLocation()) {
        return `mintcat-hot://localhost/index.html${hashRoute}`;
    }

    return `index.html${hashRoute}`;
}
