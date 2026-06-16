export const NEXUSMODS_PLATFORM = 'nexusmods';

export const NEXUSMODS_DRG_DOMAIN = 'deeprockgalactic';
export const NEXUSMODS_ROGUE_CORE_DOMAIN = 'deeprockgalacticroguecore';
export const NEXUSMODS_ROGUE_CORE_GAME_URL = `https://www.nexusmods.com/games/${NEXUSMODS_ROGUE_CORE_DOMAIN}`;

export interface NexusModsParsedUrl {
    domain: string;
    modId: number;
    fileId?: number;
    key?: string;
    expires?: number;
    userId?: number;
    rawUrl?: string;
    directDownloadUrl?: string;
}

export interface NexusModsSearchParams {
    query?: string;
    page: number;
    pageSize: number;
    domain?: string;
    sortBy?: 'downloads' | 'subscribers' | 'rating' | 'date' | 'name';
    sortOrder?: 'asc' | 'desc';
}

export interface NexusModsGameRef {
    id?: number;
    domainName?: string;
    name?: string;
}

export interface NexusModsUserRef {
    id?: number | string;
    name?: string;
    avatar?: string;
}

export interface NexusModsModNode {
    id?: string;
    uid?: string;
    modId: number;
    gameId?: number;
    name: string;
    summary?: string;
    description?: string;
    author?: string;
    downloads?: number;
    endorsements?: number;
    version?: string;
    fileSize?: number;
    pictureUrl?: string;
    thumbnailUrl?: string;
    thumbnailLargeUrl?: string;
    createdAt?: string;
    updatedAt?: string;
    game?: NexusModsGameRef;
    uploader?: NexusModsUserRef;
}

export interface NexusModsSearchResult {
    items: NexusModsModNode[];
    total: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
}

export interface NexusModsV1Mod {
    mod_id?: number;
    id?: number;
    name?: string;
    summary?: string;
    description?: string;
    picture_url?: string;
    mod_downloads?: number;
    unique_downloads?: number;
    endorsement_count?: number;
    endorsements?: number;
    version?: string;
    author?: string;
    uploaded_by?: string;
    updated_time?: number;
    created_time?: number;
    domain_name?: string;
}

export interface NexusModsFile {
    file_id?: number;
    id?: number;
    name?: string;
    version?: string;
    file_name?: string;
    category_id?: number;
    category_name?: string;
    is_primary?: boolean;
    uploaded_timestamp?: number;
    size?: number;
    size_kb?: number;
}

export interface NexusModsFilesResponse {
    files?: NexusModsFile[];
}

export interface NexusModsDownloadLink {
    name?: string;
    URI?: string;
    uri?: string;
}

export interface NexusModsResolvedMod {
    domain: string;
    modId: number;
    mod: NexusModsV1Mod;
    file?: NexusModsFile;
    sourceUrl?: string;
}
