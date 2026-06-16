import { useEffect, useRef } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { listen } from '@tauri-apps/api/event';
import { message } from 'antd';
import { t } from 'i18next';
import { OAuthService } from '@/services/OAuthService';
import { AppInitializer } from '@/core/AppInitializer';
import { NexusModsApi, showNexusModsApiKeyRequiredMessage } from '@/apis/nexusmods';
import { ModService } from '@/services/ModService';
import { ModUpdateService } from '@/services/ModUpdateService';
import { ProfileService } from '@/services/ProfileService';
import { IoC } from '@/core/IoC';
import { emitVoidEvent } from '@/events';
import StatusBar from '@/components/StatusBar';

/**
 * Hook for handling deep link events
 * Processes OAuth callbacks from mintcat:// URLs
 * 
 * @param isAppReady - Whether the app core is initialized and ready
 */
export function useDeepLinkHandler(isAppReady: boolean = false) {
    const pendingUrlsRef = useRef<string[]>([]);
    const initialUrlsFetchedRef = useRef(false);
    const listenerRegisteredRef = useRef(false);

    // Process pending URLs when app becomes ready
    useEffect(() => {
        if (isAppReady && pendingUrlsRef.current.length > 0) {
            console.log('[DeepLink] App ready, processing pending URLs:', pendingUrlsRef.current);
            const urls = [...pendingUrlsRef.current];
            pendingUrlsRef.current = [];
            urls.forEach(handleDeepLink);
        }
    }, [isAppReady]);

    useEffect(() => {
        // Handle deep links that opened the app (startup) - only fetch once
        if (!initialUrlsFetchedRef.current) {
            initialUrlsFetchedRef.current = true;
            getCurrent()
                .then((urls) => {
                    if (urls && urls.length > 0) {
                        if (AppInitializer.isCoreReady()) {
                            // App is ready, process immediately
                            console.log('[DeepLink] Processing startup URLs:', urls.map(sanitizeDeepLinkForLog));
                            urls.forEach(handleDeepLink);
                        } else {
                            // App not ready, queue for later
                            console.log('[DeepLink] App not ready, queuing startup URLs:', urls.map(sanitizeDeepLinkForLog));
                            pendingUrlsRef.current.push(...urls);
                        }
                    }
                })
                .catch((error) => {
                    console.error('[DeepLink] Failed to get current URLs:', error);
                });
        }

        // Listen for deep links while app is running (only register once)
        let cleanupDeepLink: (() => void) | null = null;
        let cleanupSingleInstance: (() => void) | null = null;

        if (!listenerRegisteredRef.current) {
            listenerRegisteredRef.current = true;
            
            // Listen for deep links via deep-link plugin
            onOpenUrl((urls) => {
                // Check if app is ready at the time of receiving the URL
                if (AppInitializer.isCoreReady()) {
                    console.log('[DeepLink] Processing runtime URLs:', urls.map(sanitizeDeepLinkForLog));
                    urls.forEach(handleDeepLink);
                } else {
                    console.log('[DeepLink] App not ready, queuing runtime URLs:', urls.map(sanitizeDeepLinkForLog));
                    pendingUrlsRef.current.push(...urls);
                }
            })
                .then((unlisten) => {
                    cleanupDeepLink = unlisten;
                })
                .catch((error) => {
                    console.error('[DeepLink] Failed to register URL listener:', error);
                });
            
            // Listen for deep links from single-instance plugin
            // When app is already running, the second instance's URL is passed via this event
            listen<string>('single-instance-deep-link', (event) => {
                const url = event.payload;
                console.log('[DeepLink] Received from single-instance:', sanitizeDeepLinkForLog(url));
                if (AppInitializer.isCoreReady()) {
                    handleDeepLink(url);
                } else {
                    console.log('[DeepLink] App not ready, queuing single-instance URL:', url);
                    pendingUrlsRef.current.push(url);
                }
            })
                .then((unlisten) => {
                    cleanupSingleInstance = unlisten;
                })
                .catch((error) => {
                    console.error('[DeepLink] Failed to register single-instance listener:', error);
                });
        }

        return () => {
            if (cleanupDeepLink) {
                cleanupDeepLink();
            }
            if (cleanupSingleInstance) {
                cleanupSingleInstance();
            }
            listenerRegisteredRef.current = false;
        };
    }, []);
}

/**
 * Handle a deep link URL
 * @param url The deep link URL to process
 */
async function handleDeepLink(url: string) {
    console.log('[DeepLink] Handling URL:', sanitizeDeepLinkForLog(url));

    if (url.toLowerCase().startsWith('nxm://')) {
        await handleNexusModsDeepLink(url);
        return;
    }
    
    // Check if this is an OAuth callback
    if (url.includes('oauth/callback')) {
        const params = OAuthService.parseOAuthUrl(url);
        console.log('[DeepLink] Parsed OAuth params:', params);
        
        if (params) {
            try {
                await OAuthService.processOAuthCallback(params);
                console.log('[DeepLink] OAuth callback processed successfully');
            } catch (error) {
                console.error('[DeepLink] OAuth callback processing failed:', error);
            }
        } else {
            console.warn('[DeepLink] Failed to parse OAuth URL:', url);
        }
        return;
    }

    // Handle other deep link types here in the future
    console.log('[DeepLink] Unhandled URL type:', url);
}

function sanitizeDeepLinkForLog(url: string): string {
    if (!url.toLowerCase().startsWith('nxm://')) {
        return url;
    }
    try {
        const parsed = new URL(url);
        for (const key of ['key', 'expires', 'user_id']) {
            if (parsed.searchParams.has(key)) {
                parsed.searchParams.set(key, '[REDACTED]');
            }
        }
        return parsed.toString();
    } catch {
        return 'nxm://[REDACTED]';
    }
}

async function handleNexusModsDeepLink(url: string) {
    const parsed = NexusModsApi.parseModLinks(url);
    if (!parsed) {
        message.error(t('nexusmods.invalidNxmLink'));
        return;
    }
    if (!parsed.key || !parsed.expires) {
        message.warning(t('nexusmods.nxmCredentialsRequired'));
        return;
    }
    if (parsed.expires <= Math.floor(Date.now() / 1000)) {
        message.warning(t('nexusmods.downloadLinkExpired'));
        return;
    }
    if (!await NexusModsApi.isAuthenticated()) {
        showNexusModsApiKeyRequiredMessage();
        return;
    }

    try {
        await StatusBar.info(t('nexusmods.receivedNxmLink'));
        const profileService = await IoC.get(ProfileService);
        const profile = await profileService.ensureActiveProfile();
        const resolved = await NexusModsApi.getModInfoByLink(url);
        if (!resolved) {
            message.error(t('nexusmods.resolveNxmFailed'));
            return;
        }

        const mod = await ModService.addModFromNexusmods(resolved, profile.id!, 0);
        await emitVoidEvent('mods-added');
        await ModUpdateService.updateModFile(mod);
        message.success(t('nexusmods.nxmDownloadStarted'));
    } catch (error) {
        console.error('[DeepLink] Nexus Mods NXM handling failed:', error);
        message.error(error instanceof Error ? error.message : t('nexusmods.resolveNxmFailed'));
    }
}
