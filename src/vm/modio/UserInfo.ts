export interface UserInfo {
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

export interface Avatar {
    filename: string;
    original: string;
    thumb_50x50: string;
    thumb_100x100: string;
}
