import {LyricLine} from '../types/song';

export interface LyricsProvider {
    readonly name: string;
    readonly timeoutMs?: number;

    fetchLyrics(
        title: string,
        artist: string,
        album: string,
        signal?: AbortSignal,
        durationMs?: number
    ): Promise<LyricLine[]>;
}

const DEFAULT_PROVIDER_TIMEOUT_MS = 6000;

function cleanTitle(title: string) {
    return title.replace(/ *\([^)]*\) */g, '').trim();
}

export class LyricsProviderManager {
    private readonly providers: LyricsProvider[];
    private readonly cache = new Map<string, LyricLine[]>();
    private currentAbortController: AbortController | null = null;

    constructor(providers: LyricsProvider[]) {
        this.providers = providers;
    }

    async fetchLyrics(
        title: string,
        artist: string,
        album: string,
        durationMs?: number,
    ): Promise<LyricLine[]> {
        const key = `${title.toLowerCase()}__${artist.toLowerCase()}`;

        title = cleanTitle(title);

        if (this.cache.has(key)) {
            return this.cache.get(key)!;
        }

        this.currentAbortController?.abort();

        const controller = new AbortController();
        this.currentAbortController = controller;

        try {
            for (const provider of this.providers) {
                if (controller.signal.aborted) {
                    console.log("[LyricsProvider] Request aborted");
                    return [];
                }

                try {
                    console.log(`[LyricsProvider] Trying ${provider.name} for "${title}" by "${artist}"`);

                    const lyrics = await this.fetchWithTimeout(
                        provider,
                        title,
                        artist,
                        album,
                        controller.signal,
                        durationMs
                    );

                    if (controller.signal.aborted) {
                        console.log("[LyricsProvider] Request aborted");
                        return [];
                    }

                    if (lyrics.length > 0) {
                        console.log(`[LyricsProvider] ${provider.name} returned ${lyrics.length} lines`);

                        this.setCache(key, lyrics);
                        return lyrics;
                    }

                    console.log(`[LyricsProvider] ${provider.name} returned nothing`);
                } catch (err: any) {

                    if (
                        err.name === "AbortError" ||
                        err.name === "CanceledError" ||
                        controller.signal.aborted
                    ) {
                        console.log("[LyricsProvider] Request aborted");
                        return [];
                    }

                    if (err.name === "TimeoutError") {
                        console.warn(
                            `[LyricsProvider] ${provider.name} timed out, skipping to next provider`
                        );
                        continue;
                    }

                    console.warn(
                        `[LyricsProvider] ${provider.name} threw:`,
                        err
                    );
                }
            }

            return [];

        } finally {
            if (this.currentAbortController === controller) {
                this.currentAbortController = null;
            }
        }
    }

    private async fetchWithTimeout(
        provider: LyricsProvider,
        title: string,
        artist: string,
        album: string,
        parentSignal: AbortSignal,
        durationMs?: number
    ): Promise<LyricLine[]> {
        const timeoutMs = provider.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
        const controller = new AbortController();

        const onAbort = () => controller.abort();
        parentSignal.addEventListener('abort', onAbort, {once: true});

        let timer: ReturnType<typeof setTimeout> | undefined;

        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
                controller.abort();

                const err = new Error(`${provider.name} timed out after ${timeoutMs}ms`);
                err.name = 'TimeoutError';
                reject(err);
            }, timeoutMs);
        });

        try {
            return await Promise.race([
                provider.fetchLyrics(title, artist, album, controller.signal, durationMs),
                timeout,
            ]);
        } finally {
            if (timer !== undefined) clearTimeout(timer);
            parentSignal.removeEventListener('abort', onAbort);
        }
    }

    private setCache(key: string, lyrics: LyricLine[]): void {
        if (this.cache.size >= 10) {
            const firstKey = this.cache.keys().next().value;
            if (typeof firstKey === 'string') this.cache.delete(firstKey);
        }

        this.cache.set(key, lyrics);
    }
}
