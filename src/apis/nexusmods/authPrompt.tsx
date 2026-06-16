import React from 'react';
import { Button, message } from 'antd';
import { t } from 'i18next';
import { emitVoidEvent } from '@/events';

const NEXUSMODS_API_KEY_REQUIRED_MESSAGE_KEY = 'nexusmods-api-key-required';

export function showNexusModsApiKeyRequiredMessage() {
    message.warning({
        key: NEXUSMODS_API_KEY_REQUIRED_MESSAGE_KEY,
        content: (
            <span>
                {t('nexusmods.apiKeyRequired')}
                {' '}
                <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => {
                    message.destroy(NEXUSMODS_API_KEY_REQUIRED_MESSAGE_KEY);
                    emitVoidEvent('user-setting-dialog-open');
                }}>
                    {t('Open User Management')}
                </Button>
            </span>
        ),
        duration: 6,
    });
}
