import axios, { AxiosInstance } from "axios";

let httpInstance: AxiosInstance = axios.create({
    timeout: 12000,
});

export function getHttp(): AxiosInstance {
    return httpInstance;
}

export function setHttpInstance(instance: AxiosInstance) {
    httpInstance = instance;
}

export async function httpGet(
    url: string,
    headers: Record<string, string> = {},
    signal?: AbortSignal
): Promise<string> {
    const res = await getHttp().get<string>(url, {
        headers,
        responseType: "text",
        transformResponse: [(data) => data],
        signal,
    });

    return typeof res.data === 'string'
        ? res.data
        : JSON.stringify(res.data);
}

export async function httpGetJson<T = unknown>(
    url: string,
    headers: Record<string, string> = {},
    signal?: AbortSignal
): Promise<T> {
    const text = await httpGet(url, headers, signal);

    return JSON.parse(text) as T;
}