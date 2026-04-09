import { t } from "i18next";
import { IoC } from "@/core/IoC";
import {
    AuthResolver,
    NetworkClient,
    NetworkRequestError,
    RequestLogger,
    RoutePolicy,
    type NetworkProxyPolicy,
    type NetworkRequestConfig,
    type NetworkResponse,
    type NetworkRoutePlan,
} from "@/services/network";

export class NetworkApi {
    private static fallbackClient = new NetworkClient(
        new AuthResolver(),
        new RoutePolicy(),
        new RequestLogger(),
    );

    private static async getClient(): Promise<NetworkClient> {
        try {
            return await IoC.get(NetworkClient);
        } catch {
            return this.fallbackClient;
        }
    }

    public static async resolveRoutePlan(
        url: string,
        proxyPolicy: NetworkProxyPolicy = 'mintcatProxyFallback',
    ): Promise<NetworkRoutePlan> {
        const client = await this.getClient();
        return await client.resolveRoutePlan(url, { proxyPolicy });
    }

    public static async request<T = Response>(config: NetworkRequestConfig): Promise<NetworkResponse<T>> {
        const client = await this.getClient();
        return await client.request<T>(config);
    }

    public static async get(
        url: string,
        headers?: Record<string, string>,
        forceProxy?: boolean,
    ): Promise<Response> {
        try {
            const result = await this.request<Response>({
                service: 'network.get',
                url,
                method: 'GET',
                headers,
                proxyPolicy: forceProxy ? 'forceMintcatProxy' : 'mintcatProxyFallback',
                parseAs: 'response',
            });
            return result.response;
        } catch (error) {
            if (
                error instanceof NetworkRequestError &&
                (error.code === 'network' || error.code === 'timeout')
            ) {
                throw new Error(`${t("Network Error")}`);
            }
            throw error;
        }
    }
}