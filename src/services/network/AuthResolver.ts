import { StorageAPI } from '@/storage';
import type { NetworkAuthPolicy } from './RequestTypes';

type OAuthLike = {
    oauth?: string | null;
    uid?: string | number | null;
};

export class AuthResolver {
    private async getOAuthByPlatform(platform: string): Promise<OAuthLike | null> {
        const oauthDAO = await StorageAPI.getOAuths();
        return await oauthDAO.getActiveUserOAuthByPlatform(platform);
    }

    public async getMintcatToken(): Promise<string> {
        const oauth = await this.getOAuthByPlatform('mintcat');
        return oauth?.oauth?.trim() ?? '';
    }

    public async getModioToken(): Promise<string> {
        const oauth = await this.getOAuthByPlatform('mod.io');
        return oauth?.oauth?.trim() ?? '';
    }

    public async getModioUid(fallbackUid: string): Promise<string> {
        const oauth = await this.getOAuthByPlatform('mod.io');
        if (oauth?.uid === undefined || oauth?.uid === null || oauth.uid === '') {
            return fallbackUid;
        }
        return String(oauth.uid).trim() || fallbackUid;
    }

    public async getModcatToken(): Promise<string> {
        const oauth = await this.getOAuthByPlatform('modcat');
        return oauth?.oauth?.trim() ?? '';
    }

    public async getNexusmodsToken(): Promise<string> {
        const oauth = await this.getOAuthByPlatform('nexusmods');
        return oauth?.oauth?.trim() ?? '';
    }

    public async resolveHeaders(policy: NetworkAuthPolicy = 'none'): Promise<Record<string, string>> {
        switch (policy) {
            case 'mintcatToken': {
                const token = await this.getMintcatToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
            }
            case 'modioToken': {
                const token = await this.getModioToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
            }
            case 'modcatToken': {
                const token = await this.getModcatToken();
                return token ? { Authorization: `Bearer ${token}` } : {};
            }
            case 'none':
            default:
                return {};
        }
    }
}

