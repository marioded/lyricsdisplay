import axios, { AxiosInstance } from "axios";

let httpInstance: AxiosInstance = axios.create({
    timeout: 10000,
});

export function setHttpInstance(instance: AxiosInstance) {
    httpInstance = instance;
}

function createAbortError(): Error {
    const err = new Error("canceled");
    err.name = "CanceledError";
    return err;
}

function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(createAbortError());

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(createAbortError());

        signal.addEventListener("abort", onAbort, { once: true });
        promise.then(
            (value) => {
                signal.removeEventListener("abort", onAbort);
                resolve(value);
            },
            (err) => {
                signal.removeEventListener("abort", onAbort);
                reject(err);
            }
        );
    });
}

export async function httpGet(
    url: string,
    headers: Record<string, string> = {},
    signal?: AbortSignal
): Promise<string> {
    const res = await withAbort(
        httpInstance.get<string>(url, {
            headers,
            responseType: "text",
            transformResponse: [(data) => data],
            signal,
        }),
        signal
    );

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
    console.log(text)

    return JSON.parse(text) as T;
}
