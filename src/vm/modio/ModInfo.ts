
export interface ModInfo {
    id: number;
    game_id: number;
    status: number;
    visible: number;
    submitted_by: SubmittedBy;
    date_added: number;
    date_updated: number;
    date_live: number;
    maturity_option: number;
    community_options: number;
    credit_options: number;
    monetization_options: number;
    stock: number;
    price: number;
    tax: number;
    logo: Logo;
    homepage_url?: any;
    name: string;
    name_trans: string;
    name_id: string;
    summary: string;
    summary_trans: string;
    description: string;
    description_plaintext: string;
    metadata_blob?: any;
    profile_url: string;
    media: Media;
    modfile: ModFile;
    dependencies: boolean;
    platforms?: Array<Platforms>;
    metadata_kvp?: Array<any>;
    tags: Array<Tags>;
    stats: Stats;
}

export interface SubmittedBy {
    id: number;
    name_id: string;
    username: string;
    display_name_portal?: any;
    date_online: number;
    date_joined: number;
    avatar: Avatar;
    timezone?: any;
    language?: any;
    profile_url: string;
}

export interface Logo {
    filename: string;
    original: string;
    thumb_320x180: string;
    thumb_640x360: string;
    thumb_1280x720: string;
}

export interface Media {
    youtube?: Array<any>;
    sketchfab?: Array<any>;
    images: Array<Images>;
}

export interface ModFile {
    id: number;
    mod_id: number;
    date_added: number;
    date_updated: number;
    date_scanned: number;
    virus_status: number;
    virus_positive: number;
    virustotal_hash?: any;
    filesize: number;
    filesize_uncompressed: number;
    filehash: FileHash;
    filename: string;
    version: string;
    changelog: string;
    metadata_blob?: any;
    download: Download;
    platforms: Array<Platforms>;
}

export interface Tags {
    name: string;
    name_localized: string;
    date_added: number;
}

export interface Stats {
    mod_id: number;
    popularity_rank_position: number;
    popularity_rank_total_mods: number;
    downloads_today: number;
    downloads_total: number;
    subscribers_total: number;
    ratings_total: number;
    ratings_positive: number;
    ratings_negative: number;
    ratings_percentage_positive: number;
    ratings_weighted_aggregate: number;
    ratings_display_text: string;
    date_expires: number;
}

export interface Avatar {
    filename: string;
    original: string;
    thumb_50x50: string;
    thumb_100x100: string;
}

export interface Images {
    filename: string;
    original: string;
    thumb_320x180: string;
    thumb_1280x720: string;
}

export interface FileHash {
    md5: string;
}

export interface Download {
    binary_url: string;
    date_expires: number;
}

export interface Platforms {
    platform: string;
    status: number;
}

