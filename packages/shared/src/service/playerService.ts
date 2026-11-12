import { LyricLine } from '../types/song';
import { LyricsApiService } from '../api/lyricsApi';

export class PlayerService {
    private static instance: PlayerService;
    private backendApi = LyricsApiService.getInstance();

    private constructor() {}

    static getInstance(): PlayerService {
        if (!PlayerService.instance) {
            PlayerService.instance = new PlayerService();
        }
        return PlayerService.instance;
    }

    async fetchLyrics(title: string, author: string, album: string, durationMs?: number): Promise<LyricLine[]> {
        return await this.backendApi.fetchLyrics(title, author, album, durationMs);
    }

    calculateCurrentLyricIndex(lyrics: LyricLine[], currentProgressMs: number): number {
        if (!lyrics.length) return 0;

        let left = 0;
        let right = lyrics.length - 1;
        let result = 0;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const nextIndex = mid + 1;

            if (nextIndex >= lyrics.length || currentProgressMs < lyrics[nextIndex].startTimeMs) {
                result = mid;
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        }

        return result;
    }
}
