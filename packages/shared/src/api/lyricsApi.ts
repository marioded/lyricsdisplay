import {LyricLine} from '../types/song';
import {KpocProvider, LiriqoProvider, LrclibProvider, LyricsProviderManager, PaxsenixProvider} from '../providers';

const defaultProviders = [
    new LiriqoProvider('word'),
    new KpocProvider(),
    new PaxsenixProvider(),
    new LrclibProvider(),
    new LiriqoProvider('line'),
];

export class LyricsApiService {
    private static instance: LyricsApiService;
    private readonly manager = new LyricsProviderManager(defaultProviders);

    private constructor() {
    }

    static getInstance(): LyricsApiService {
        if (!LyricsApiService.instance) {
            LyricsApiService.instance = new LyricsApiService();
        }
        return LyricsApiService.instance;
    }

    async fetchLyrics(title: string, author: string, album: string, durationMs?: number): Promise<LyricLine[]> {
        return this.manager.fetchLyrics(title, author, album, durationMs);
    }
}
