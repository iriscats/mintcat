import { useEffect } from 'react';
import { onOpenUrl, getCurrent } from '@tauri-apps/plugin-deep-link';
import { OAuthService } from '@/services/OAuthService';

/**
 * Hook for handling deep link events
 * Processes OAuth callbacks from mintcat:// URLs
 */
export function useDeepLinkHandler() {
    useEffect(() => {
        // Handle deep links that opened the app (startup)
        getCurrent()
            .then((urls) => {
                if (urls && urls.length > 0) {
                    urls.forEach(handleDeepLink);
                }
            })
            .catch((error) => {
                console.error('[DeepLink] Failed to get current URLs:', error);
            });

        // Listen for deep links while app is running
        let cleanup: (() => void) | null = null;

        onOpenUrl((urls) => {
            urls.forEach(handleDeepLink);
        })
            .then((unlisten) => {
                cleanup = unlisten;
            })
            .catch((error) => {
                console.error('[DeepLink] Failed to register URL listener:', error);
            });

        return () => {
            if (cleanup) {
                cleanup();
            }
        };
    }, []);
}

/**
 * Handle a deep link URL
 * @param url The deep link URL to process
 */
async function handleDeepLink(url: string) {
    // Check if this is an OAuth callback
    if (url.includes('oauth/callback')) {
        const params = OAuthService.parseOAuthUrl(url);
        if (params) {
            await OAuthService.processOAuthCallback(params);
        } else {
            console.warn('[DeepLink] Failed to parse OAuth URL:', url);
        }
        return;
    }

    // Handle other deep link types here in the future
    console.log('[DeepLink] Unhandled URL type:', url);
}
