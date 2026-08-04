import { useSettingsStore } from "@lyricsdisplay/shared";
import { createJSONStorage } from "zustand/middleware";
import { Store } from "@tauri-apps/plugin-store";
import { StateStorage } from "zustand/middleware";

const store = await Store.load("settings.json");

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

export function initDesktopServices() {
    useSettingsStore.persist.setOptions({
        storage: createJSONStorage(() => tauriStorage),
    });

    useSettingsStore.persist.rehydrate();
}