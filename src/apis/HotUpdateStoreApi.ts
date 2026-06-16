import { invoke } from '@tauri-apps/api/core';

export type HotUpdateComponentKey = {
    category: string;
    component: string;
    game?: string;
    channel?: string;
    platform?: string;
    arch?: string;
};

export type HotUpdateComponentState = {
    activeVersion?: string | null;
    previousVersion?: string | null;
    failedVersion?: string | null;
    activeFileName?: string | null;
    metadata?: Record<string, unknown>;
};

export type CapabilityStatus = {
    name: string;
    supported: boolean;
    installed: boolean;
    active: boolean;
};

export type ControlPlaneStatus = {
    apiVersion: number;
    activeReleaseSetId?: string | null;
    failedReleaseSetId?: string | null;
    safeMode: boolean;
    capabilities: CapabilityStatus[];
};

export type HotUpdateArtifactPathRequest = HotUpdateComponentKey & {
    version: string;
    fileName: string;
};

export type HotUpdateStagingPathRequest = HotUpdateComponentKey & {
    operationId: string;
    fileName: string;
};

export class HotUpdateStoreApi {
    static getControlPlaneStatus(): Promise<ControlPlaneStatus> {
        return invoke<ControlPlaneStatus>('get_control_plane_status');
    }

    static resolveArtifactPath(request: HotUpdateArtifactPathRequest): Promise<string> {
        return invoke<string>('resolve_hot_update_artifact_path', { request });
    }

    static resolveStagingPath(request: HotUpdateStagingPathRequest): Promise<string> {
        return invoke<string>('resolve_hot_update_staging_path', { request });
    }

    static getStoreManifest(): Promise<unknown> {
        return invoke('get_hot_update_store_manifest');
    }

    static getComponentState(key: HotUpdateComponentKey): Promise<HotUpdateComponentState> {
        return invoke<HotUpdateComponentState>('get_hot_update_component_state', { key });
    }

    static activateComponent(
        key: HotUpdateComponentKey,
        version: string,
        fileName: string,
        metadata: Record<string, unknown> = {},
    ): Promise<HotUpdateComponentState> {
        return invoke<HotUpdateComponentState>('activate_hot_update_component', {
            request: {
                ...key,
                version,
                fileName,
                metadata,
            },
        });
    }

    static markComponentFailed(
        key: HotUpdateComponentKey,
        version: string,
        fileName: string,
        metadata: Record<string, unknown> = {},
    ): Promise<HotUpdateComponentState> {
        return invoke<HotUpdateComponentState>('mark_hot_update_component_failed', {
            request: {
                ...key,
                version,
                fileName,
                metadata,
            },
        });
    }

    static enterSafeMode(failedReleaseSetId?: string): Promise<unknown> {
        return invoke('enter_safe_mode', {
            failedReleaseSetId: failedReleaseSetId ?? null,
        });
    }

    static disableActiveReleaseSet(): Promise<unknown> {
        return invoke('disable_active_release_set');
    }

    static assetUrl(request: HotUpdateArtifactPathRequest): Promise<string> {
        return invoke<string>('hot_update_asset_url', { request });
    }
}
