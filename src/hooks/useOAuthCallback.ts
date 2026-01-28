import { App } from 'antd';
import { useEventListener } from '@/events';

/**
 * Hook for displaying OAuth callback feedback notifications
 * Listens to oauth-success and oauth-error events
 */
export function useOAuthCallback() {
    const { notification } = App.useApp();

    useEventListener('oauth-success', (payload) => {
        notification.success({
            message: 'OAuth Success',
            description: `Connected to ${payload.platform}`,
            duration: 3,
        });
    }, [notification]);

    useEventListener('oauth-error', (payload) => {
        notification.error({
            message: 'OAuth Failed',
            description: `${payload.platform}: ${payload.error}`,
            duration: 5,
        });
    }, [notification]);
}
