import { message } from 'antd';
import { t } from 'i18next';
import { listenEvent, type UnlistenFn } from '@/events';
import { NexusModsApi } from './index';
import type { EventPayload } from '@/events';
import type { NexusModsParsedUrl } from './types';
import { ControlPlaneApi } from '@/apis/ControlPlaneApi';
import { BackendRuntimeApi } from '@/apis/BackendRuntimeApi';

export type NexusDownloadCapturedPayload = EventPayload<'nexus-download-captured'>;

const DEFAULT_CAPTURE_TIMEOUT_MS = 120_000;

export interface OpenNexusDownloadWebviewOptions {
    profileUrl: string;
    domain: string;
    modId: number;
    fileId?: number;
    autoStart?: boolean;
}

export interface CaptureNexusDownloadUrlOptions {
    parsed?: NexusModsParsedUrl;
    timeoutMs?: number;
    showMessage?: boolean;
}

export async function openNexusDownloadWebview(options: OpenNexusDownloadWebviewOptions): Promise<void> {
    const request = await BackendRuntimeApi.invoke<Record<string, unknown>>('open_nexus_download_webview', {
        pageUrl: buildNexusModFilesPageUrl(options.domain, options.modId, options.fileId),
        profileUrl: options.profileUrl,
        domain: options.domain,
        modId: options.modId,
        fileId: options.fileId,
        autoStart: options.autoStart ?? true,
    });
    await ControlPlaneApi.invoke('open_managed_webview', request);
}

export async function captureNexusDownloadUrl(
    url: string,
    options: CaptureNexusDownloadUrlOptions = {},
): Promise<string> {
    const parsed = options.parsed ?? NexusModsApi.parseModLinks(url);
    if (!parsed) {
        throw new Error(t('Invalid Mod Link'));
    }

    const target = await resolveNexusDownloadTarget(parsed);

    return new Promise((resolve, reject) => {
        let unlisten: UnlistenFn | undefined;
        let completed = false;
        const timeoutId = window.setTimeout(() => {
            cleanup();
            reject(new Error(t('nexusmods.captureTimeout')));
        }, options.timeoutMs ?? DEFAULT_CAPTURE_TIMEOUT_MS);

        const cleanup = () => {
            if (completed) {
                return;
            }
            completed = true;
            window.clearTimeout(timeoutId);
            if (unlisten) {
                unlisten();
                unlisten = undefined;
            }
        };

        listenEvent('nexus-download-captured', async (payload) => {
            if (!isMatchingNexusDownloadCapture(payload, target)) {
                return;
            }

            cleanup();
            resolve(buildAddModUrlFromCapturedNexusDownload(payload));
        }).then(async (listener) => {
            unlisten = listener;
            await openNexusDownloadWebview({
                profileUrl: url,
                domain: target.domain,
                modId: target.modId,
                fileId: target.fileId,
                autoStart: true,
            });
            if (options.showMessage ?? true) {
                message.info(t('nexusmods.webviewAutoOpened'));
            }
        }).catch((error) => {
            cleanup();
            reject(error);
        });
    });
}

export function buildAddModUrlFromCapturedNexusDownload(payload: NexusDownloadCapturedPayload): string {
    if (payload.source !== 'cdn') {
        return payload.url;
    }

    try {
        const url = new URL(payload.url);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
        hash.set('mintcat_domain', payload.domain);
        hash.set('mintcat_mod_id', String(payload.modId));
        if (payload.fileId) {
            hash.set('mintcat_file_id', String(payload.fileId));
        }
        hash.set('mintcat_profile_url', payload.profileUrl);
        url.hash = hash.toString();
        return url.toString();
    } catch {
        return payload.url;
    }
}

export function isMatchingNexusDownloadCapture(
    payload: NexusDownloadCapturedPayload,
    parsed: Pick<NexusModsParsedUrl, 'domain' | 'modId' | 'fileId'>,
): boolean {
    if (payload.domain.toLowerCase() !== parsed.domain.toLowerCase()) {
        return false;
    }
    if (payload.modId !== parsed.modId) {
        return false;
    }
    if (parsed.fileId && payload.fileId && payload.fileId !== parsed.fileId) {
        return false;
    }
    return true;
}

export async function resolveNexusDownloadTarget(parsed: NexusModsParsedUrl): Promise<NexusModsParsedUrl> {
    if (parsed.fileId) {
        return parsed;
    }

    try {
        const files = await NexusModsApi.getModFiles(parsed.domain, parsed.modId);
        const file = NexusModsApi.pickDownloadableFile(files);
        const fileId = NexusModsApi.getFileId(file);
        if (fileId) {
            return { ...parsed, fileId };
        }
    } catch (error) {
        console.warn('[NexusModsWebview] Failed to resolve preferred file before opening WebView:', error);
    }

    return parsed;
}

function buildNexusModFilesPageUrl(domain: string, modId: number, fileId?: number): string {
    const url = new URL(NexusModsApi.getModFilesUrl(domain, modId));
    if (fileId) {
        url.searchParams.set('file_id', String(fileId));
    }
    return url.toString();
}

