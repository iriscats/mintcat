import React, { useMemo } from 'react';
import { Button, Space, Tour } from 'antd';
import type { TourProps } from 'antd';
import { t } from 'i18next';
import { emitVoidEvent } from '@/events';
import { platform } from '@tauri-apps/plugin-os';

const TOUR_SELECTORS = {
    welcome: null,
    home: '.tour-step-home',
    switchProfile: '.tour-step-profile',
    save: '.tour-step-save',
    addMod: '.tour-step-add-mod',
    launch: '.tour-step-launch',
    switchGame: '.tour-step-switch-game',
    modio: '.tour-step-modio',
    setting: '.tour-step-setting',
    userSettings: '.tour-step-avatar',
    end: null,
} as const;

function getTarget(selector: string | null): (() => HTMLElement | null) {
    return () => (selector ? document.querySelector<HTMLElement>(selector) : null);
}

export interface OnboardingTourProps {
    open: boolean;
    onComplete: () => void;
}

/**
 * 新手指引：初次使用时介绍首页、mod.io、设置等模块
 */
export function OnboardingTour({ open, onComplete }: OnboardingTourProps) {
    const supportsGameLaunch = platform() !== 'macos';
    const steps: TourProps['steps'] = useMemo(
        () => [
            {
                title: t('onboarding.welcome.title'),
                description: t('onboarding.welcome.description'),
                target: getTarget(TOUR_SELECTORS.welcome),
            },
            {
                title: t('onboarding.configImport.title'),
                description: (
                    <Space orientation="vertical" size="middle">
                        <span>{t('onboarding.configImport.description')}</span>
                        <Button
                            type="primary"
                            className="tour-step-config-import-btn"
                            onClick={() => emitVoidEvent('config-manage-dialog-open')}
                        >
                            {t('onboarding.configImport.openButton')}
                        </Button>
                    </Space>
                ),
                target: getTarget(null),
            },
            {
                title: t('onboarding.gameSelect.title'),
                description: t('onboarding.gameSelect.description'),
                target: getTarget(TOUR_SELECTORS.switchGame),
            },
            {
                title: t('onboarding.userSettings.title'),
                description: t('onboarding.userSettings.description'),
                target: getTarget(TOUR_SELECTORS.userSettings),
            },
            {
                title: t('onboarding.home.title'),
                description: t('onboarding.home.description'),
                target: getTarget(TOUR_SELECTORS.home),
            },
            {
                title: t('onboarding.switchProfile.title'),
                description: t('onboarding.switchProfile.description'),
                target: getTarget(TOUR_SELECTORS.switchProfile),
            },
            {
                title: t('onboarding.save.title'),
                description: t(supportsGameLaunch
                    ? 'onboarding.save.description'
                    : 'onboarding.save.installDescription'),
                target: getTarget(TOUR_SELECTORS.save),
            },
            {
                title: t('onboarding.addMod.title'),
                description: t('onboarding.addMod.description'),
                target: getTarget(TOUR_SELECTORS.addMod),
            },
            {
                title: t(supportsGameLaunch ? 'onboarding.launch.title' : 'Install mods'),
                description: t(supportsGameLaunch ? 'onboarding.launch.description' : 'onboarding.install.description'),
                target: getTarget(TOUR_SELECTORS.launch),
            },
            {
                title: t('onboarding.modio.title'),
                description: t('onboarding.modio.description'),
                target: getTarget(TOUR_SELECTORS.modio),
            },
            {
                title: t('onboarding.setting.title'),
                description: t('onboarding.setting.description'),
                target: getTarget(TOUR_SELECTORS.setting),
            },
            {
                title: t('onboarding.end.title'),
                description: t('onboarding.end.description'),
                target: getTarget(TOUR_SELECTORS.end),
            },
        ],
        [supportsGameLaunch]
    );

    return (
        <Tour
            open={open}
            onClose={onComplete}
            steps={steps}
            type="primary"
        />
    );
}
