import {useEffect} from 'react';
import {App} from 'antd';
import {listen} from '@tauri-apps/api/event';

export const useAppError = () => {
    const {message} = App.useApp();

    useEffect(() => {
        let unlisten: (() => void) | undefined;

        const setupListener = async () => {
            try {
                const listener = await listen<string>('app-error', (event) => {
                    message.error(event.payload);
                });
                unlisten = listener;
            } catch (e) {
                console.error('Failed to register error listener:', e);
            }
        };

        setupListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [message]);

    return null;
};
