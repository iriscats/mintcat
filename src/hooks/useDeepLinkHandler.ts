import { useEffect, useRef } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { listen } from '@tauri-apps/api/event';
import { OAuthService } from '@/services/OAuthService';
import { AppInitializer } from '@/core/AppInitializer';

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
                            console.log('[DeepLink] Processing startup URLs:', urls);
                            urls.forEach(handleDeepLink);
                        } else {
                            // App not ready, queue for later
                            console.log('[DeepLink] App not ready, queuing startup URLs:', urls);
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
                    console.log('[DeepLink] Processing runtime URLs:', urls);
                    urls.forEach(handleDeepLink);
                } else {
                    console.log('[DeepLink] App not ready, queuing runtime URLs:', urls);
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
                console.log('[DeepLink] Received from single-instance:', url);
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
    console.log('[DeepLink] Handling URL:', url);
    
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
