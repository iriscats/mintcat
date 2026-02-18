import { App } from 'antd';
import { t } from 'i18next';
import { useEventListener } from '@/events';

/**
 * Hook to display application errors in Ant Design message
 * Listens to 'app-error' events and shows error notifications.
 * Supports backend.* keys: message is translated when it is a known i18n key.
 *
 * @example
 * function App() {
 *   useAppError();
 *   return <div>...</div>;
 * }
 */
export const useAppError = () => {
    const { message } = App.useApp();

    // ✅ 使用 useEventListener 自动管理监听器生命周期；支持 backend.* key 或 { key, ...params }
    useEventListener('app-error', (errorMessage) => {
        let displayMessage: string;
        if (typeof errorMessage === 'string') {
            displayMessage = errorMessage.startsWith('backend.') ? t(errorMessage) : (t(errorMessage) !== errorMessage ? t(errorMessage) : errorMessage);
        } else if (errorMessage && typeof errorMessage === 'object' && 'key' in errorMessage && typeof (errorMessage as { key: string }).key === 'string') {
            const { key, ...params } = errorMessage as { key: string; [k: string]: unknown };
            displayMessage = t(key, params as Record<string, string>);
        } else {
            displayMessage = String(errorMessage);
        }
        message.error(displayMessage);
    }, [message]);

    return null;
};
