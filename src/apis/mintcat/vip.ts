import { NetworkApi } from "@/apis/NetworkApi";
import { AuthResolver } from "@/services/network";
import type { VipInfo } from "./types";
import { MintCatApiUrls } from "./urls";

const authResolver = new AuthResolver();

function normalizeVipStatus(value: unknown): VipInfo['vipStatus'] {
    return value === 'Active' || value === 'Expired' || value === 'None' ? value : 'None';
}

export async function validateVipStatus(): Promise<VipInfo | null> {
    const accessToken = await authResolver.getMintcatToken();

    if (!accessToken) {
        return null;
    }

    try {
        const result = await NetworkApi.request({
            service: 'mintcat.vip.validate',
            url: MintCatApiUrls.auth.validateAccessToken(),
            headers: { Authorization: `Bearer ${accessToken}` },
            proxyPolicy: 'direct',
            parseAs: 'response',
        });
        const response = result.response;

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            vipType: data.vipType ?? null,
            vipStatus: normalizeVipStatus(data.vipStatus),
            vipExpirationTime: data.vipExpirationTime ?? null,
        };
    } catch {
        return null;
    }
}
