import { StorageAPI } from "@/storage";
import type { VipInfo } from "./types";

const BASE_URL = "https://api.mintcat.work";

export async function validateVipStatus(): Promise<VipInfo | null> {
    const oauthDAO = await StorageAPI.getOAuths();
    const mintcatOAuth = await oauthDAO.getActiveUserOAuthByPlatform("mintcat");
    const accessToken = mintcatOAuth?.oauth;

    if (!accessToken) {
        return null;
    }

    try {
        const response = await fetch(`${BASE_URL}/v1/validate-access-token`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return {
            vipType: data.vipType ?? null,
            vipStatus: data.vipStatus ?? "None",
            vipExpirationTime: data.vipExpirationTime ?? null,
        };
    } catch {
        return null;
    }
}
