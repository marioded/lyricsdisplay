import {setHttpInstance, useSettingsStore} from "@lyricsdisplay/shared";
import { createJSONStorage } from "zustand/middleware";
import { Store } from "@tauri-apps/plugin-store";
import { StateStorage } from "zustand/middleware";
import axios, {AxiosAdapter} from "axios";
import {invoke} from "@tauri-apps/api/core";

let store: Store;

const tauriStorage: StateStorage = {
    getItem: async (name) => {
        const value = await store.get(name);
        return value ? JSON.stringify(value) : null;
    },

    setItem: async (name, value) => {
        await store.set(name, JSON.parse(value));
        await store.save();
    },

    removeItem: async (name) => {
        await store.delete(name);
        await store.save();
    },
};

export async function initDesktopServices() {
    store = await Store.load("settings.json");

    useSettingsStore.persist.setOptions({
        storage: createJSONStorage(() => tauriStorage),
    });

    await useSettingsStore.persist.rehydrate();

    const tauriAxiosAdapter: AxiosAdapter = async (config) => {
        const headers: Record<string,string> = {};

        if (config.headers) {
            Object.entries(config.headers)
                .forEach(([k,v]) => {
                    if (typeof v === "string") {
                        headers[k] = v;
                    }
                });
        }

        const data = await invoke<string>(
            "http_get",
            {
                url: config.url,
                headers
            }
        );

        return {
            data,
            status: 200,
            statusText: "OK",
            headers: {},
            config,
            request: null,
        };
    };

    const instance = axios.create({
        timeout: 12000,

        adapter: tauriAxiosAdapter
    });

    setHttpInstance(instance);
}