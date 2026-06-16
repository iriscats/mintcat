import { invoke } from '@tauri-apps/api/core';
import { HotUpdateStoreApi } from '@/apis/HotUpdateStoreApi';

export type OptionalAssetPackDescriptor = {
    capability: string;
    component: string;
    version: string;
    fileName: string;
    channel?: string;
    platform?: string;
    arch?: string;
    releaseSetId?: string;
    schemaVersion?: string;
};

export class OptionalAssetPackApi {
    static resolvePackPath(descriptor: OptionalAssetPackDescriptor): Promise<string> {
        return HotUpdateStoreApi.resolveArtifactPath({
            category: 'optional-assets',
            component: descriptor.component,
            game: 'global',
            channel: descriptor.channel,
            platform: descriptor.platform,
            arch: descriptor.arch,
            version: descriptor.version,
            fileName: descriptor.fileName,
        });
    }

    static activate(descriptor: OptionalAssetPackDescriptor): Promise<unknown> {
        return invoke('activate_optional_asset_pack', { request: descriptor });
    }

    static assetUrl(descriptor: OptionalAssetPackDescriptor): Promise<string> {
        return HotUpdateStoreApi.assetUrl({
            category: 'optional-assets',
            component: descriptor.component,
            game: 'global',
            channel: descriptor.channel,
            platform: descriptor.platform,
            arch: descriptor.arch,
            version: descriptor.version,
            fileName: descriptor.fileName,
        });
    }
}
