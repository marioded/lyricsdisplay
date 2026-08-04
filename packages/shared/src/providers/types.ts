import {LyricLine} from '../types/song';

export interface LyricsProvider {
    readonly name: string;

    fetchLyrics(
        title: string,
        artist: string,
        album: string,
        signal?: AbortSignal
    ): Promise<LyricLine[]>;
}

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
                try {
                    console.log(`[LyricsProvider] Trying ${provider.name} for "${title}" by "${artist}"`);

                    const lyrics = await provider.fetchLyrics(
                        title,
                        artist,
                        album,
                        controller.signal
                    );

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

    private setCache(key: string, lyrics: LyricLine[]): void {
        if (this.cache.size >= 10) {
            const firstKey = this.cache.keys().next().value;
            if (typeof firstKey === 'string') this.cache.delete(firstKey);
        }

        this.cache.set(key, lyrics);
    }
}
