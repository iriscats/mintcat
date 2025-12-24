import { App } from 'antd';
import { useEventListener } from '@/events';

/**
 * Hook to display application errors in Ant Design message
 * Listens to 'app-error' events and shows error notifications
 *
 * @example
 * function App() {
 *   useAppError();
 *   return <div>...</div>;
 * }
 */
export const useAppError = () => {
    const { message } = App.useApp();

    // ✅ 使用 useEventListener 自动管理监听器生命周期
    useEventListener('app-error', (errorMessage) => {
        message.error(errorMessage);
    }, [message]);

    return null;
};
