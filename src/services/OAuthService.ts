import { StorageAPI } from "@/storage";
import { emitEvent } from "@/events";
import { CloudBackupApi } from "@/apis/CloudBackupApi";

/**
 * OAuth 回调参数
 */
export interface OAuthCallbackParams {
    platform: string;
    code?: string;
    accessToken?: string;
    state?: string;
    error?: string;
    errorDescription?: string;
}

// 存储 state 用于 CSRF 验证
const stateStore = new Map<string, { platform: string; timestamp: number }>();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * OAuth 服务
 * 处理 OAuth deep link 回调和 token 存储
 */
export class OAuthService {
    /**
     * 解析 OAuth 回调 URL
     * @param url deep link URL (e.g., mintcat://oauth/callback?platform=mod.io&access_token=xxx)
     * @returns 解析后的参数，如果 URL 格式无效则返回 null
     */
    static parseOAuthUrl(url: string): OAuthCallbackParams | null {
        try {
            const parsedUrl = new URL(url);

            // 检查是否为 OAuth 回调路径
            // 对于 mintcat://oauth/callback:
            //   - host = 'oauth'
            //   - pathname = '/callback'
            // 需要合并检查
            const host = parsedUrl.host || '';
            const pathname = parsedUrl.pathname || '';
            const fullPath = host + pathname;
            
            if (!fullPath.includes('oauth/callback') && !fullPath.startsWith('oauth/callback')) {
                return null;
            }

            const params = parsedUrl.searchParams;
            const platform = params.get('platform');

            if (!platform) {
                return null;
            }

            return {
                platform,
                accessToken: params.get('access_token') || undefined,
                code: params.get('code') || undefined,
                state: params.get('state') || undefined,
                error: params.get('error') || undefined,
                errorDescription: params.get('error_description') || undefined,
            };
        } catch (error) {
            console.error('[OAuthService] Failed to parse URL:', error);
            return null;
        }
    }

    /**
     * 生成 CSRF 保护的 state 参数
     * @param platform OAuth 平台
     * @returns state 字符串
     */
    static generateState(platform: string): string {
        const state = crypto.randomUUID();
        stateStore.set(state, { platform, timestamp: Date.now() });

        // 清理过期的 state
        OAuthService.cleanupExpiredStates();

        return state;
    }

    /**
     * 验证 state 参数
     * @param state 待验证的 state
     * @param platform 期望的平台
     * @returns 是否有效
     */
    static validateState(state: string, platform: string): boolean {
        const stored = stateStore.get(state);
        if (!stored) {
            return false;
        }

        // 检查是否过期
        if (Date.now() - stored.timestamp > STATE_EXPIRY_MS) {
            stateStore.delete(state);
            return false;
        }

        // 检查平台是否匹配
        if (stored.platform !== platform) {
            return false;
        }

        // 使用后删除 state (一次性使用)
        stateStore.delete(state);
        return true;
    }

    /**
     * 清理过期的 state
     */
    private static cleanupExpiredStates(): void {
        const now = Date.now();
        for (const [state, data] of stateStore.entries()) {
            if (now - data.timestamp > STATE_EXPIRY_MS) {
                stateStore.delete(state);
            }
        }
    }

    /**
     * 处理 OAuth 回调
     * @param params OAuth 回调参数
     */
    static async processOAuthCallback(params: OAuthCallbackParams): Promise<void> {
        console.log('[OAuthService] Processing OAuth callback:', params.platform);

        // 发出回调接收事件
        await emitEvent('oauth-callback-received', params);

        try {
            // 检查错误
            if (params.error) {
                const errorMsg = params.errorDescription || params.error;
                console.error('[OAuthService] OAuth error:', errorMsg);
                await emitEvent('oauth-error', {
                    platform: params.platform,
                    error: errorMsg,
                });
                return;
            }

            // 验证 state (如果存在)
            if (params.state) {
                const isValid = OAuthService.validateState(params.state, params.platform);
                if (!isValid) {
                    console.error('[OAuthService] Invalid state parameter');
                    await emitEvent('oauth-error', {
                        platform: params.platform,
                        error: 'Invalid state parameter (CSRF protection)',
                    });
                    return;
                }
            }

            // 获取 access token
            let accessToken = params.accessToken;

            // 如果只有 code，需要交换 token (暂不实现，大多数场景直接返回 token)
            if (!accessToken && params.code) {
                console.warn('[OAuthService] Code exchange not implemented, expecting access_token directly');
                await emitEvent('oauth-error', {
                    platform: params.platform,
                    error: 'Authorization code flow not supported yet',
                });
                return;
            }

            if (!accessToken) {
                await emitEvent('oauth-error', {
                    platform: params.platform,
                    error: 'No access token received',
                });
                return;
            }

            // 存储 token
            await OAuthService.storeOAuthToken(params.platform, accessToken);

            // 发出成功事件
            await emitEvent('oauth-success', {
                platform: params.platform,
            });

            console.log('[OAuthService] OAuth token stored successfully for:', params.platform);
        } catch (error) {
            console.error('[OAuthService] Failed to process OAuth callback:', error);
            await emitEvent('oauth-error', {
                platform: params.platform,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    /**
     * 存储 OAuth token
     * @param platform 平台
     * @param token OAuth token
     */
    private static async storeOAuthToken(platform: string, token: string): Promise<void> {
        const oauthDAO = await StorageAPI.getOAuths();
        const userDAO = await StorageAPI.getUsers();

        // 获取当前活跃用户
        const activeUser = await userDAO.getActiveUser();
        
        if (!activeUser) {
            throw new Error('No active user found. Please ensure the application is properly initialized.');
        }

        // 根据平台存储 token
        if (platform === 'mod.io') {
            await oauthDAO.setModioOAuth(activeUser.id, token);
        } else if (platform === 'modcat') {
            // MintCat 云服务 token - 同步到云备份设置
            await oauthDAO.upsertOAuth(activeUser.id, platform, token);
            // 同时保存到云备份配置
            const config = await CloudBackupApi.getConfig();
            await CloudBackupApi.saveConfig({
                ...config,
                baseUrl: config.baseUrl || 'https://api.mintcat.work',
                accessToken: token,
            });
            console.log('[OAuthService] MintCat token synced to cloud backup config');
        } else {
            // 通用存储
            await oauthDAO.upsertOAuth(activeUser.id, platform, token);
        }
    }
}
