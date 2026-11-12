import {LyricLine} from '../types/song';
import {LyricsProvider} from './types';
import {httpGetJson} from '../utils/httpFetch';

interface LrclibTrack {
    id: number;
    trackName: string;
    artistName: string;
    albumName: string;
    duration: number;
    instrumental: boolean;
    plainLyrics: string | null;
    syncedLyrics: string | null;
}

const TIME_TAG_SOURCE = '\\[(\\d{1,3}):(\\d{1,2})(?:[.:](\\d{1,3}))?\\]';
const LRCLIB_HEADERS = {'User-Agent': 'LyricsDisplay/0.1.1'};

export class LrclibProvider implements LyricsProvider {
    private static LRCLIB_API = 'https://lrclib.net/api';
    readonly name = 'lrclib';
    readonly timeoutMs = 5000;

    async fetchLyrics(title: string, artist: string, album: string, signal: AbortSignal): Promise<LyricLine[]> {
        const params = new URLSearchParams({
            track_name: title,
            artist_name: artist,
        });

        if (album) params.set('album_name', album);

        try {
            const track = await httpGetJson<LrclibTrack>(`${LrclibProvider.LRCLIB_API}/get?${params}`, LRCLIB_HEADERS, signal);
            const lines = LrclibProvider.parse(track);
            if (lines.length > 0) return lines;
        } catch (err) {
            if (signal?.aborted) throw err;
            console.warn('[Lrclib] get error:', err);
        }

        try {
            const results = await httpGetJson<LrclibTrack[]>(`${LrclibProvider.LRCLIB_API}/search?${params}`, LRCLIB_HEADERS, signal);
            return LrclibProvider.parse(LrclibProvider.pickBest(results, title, album));
        } catch (err) {
            if (signal?.aborted) throw err;
            console.warn('[Lrclib] search error:', err);
            return [];
        }
    }

    static pickBest(results: LrclibTrack[] | undefined, title: string, album: string): LrclibTrack | undefined {
        if (!Array.isArray(results) || results.length === 0) return undefined;

        const synced = results.filter(track => !!track?.syncedLyrics && !track.instrumental);
        if (synced.length === 0) return undefined;

        const titleLc = title.toLowerCase();
        const albumLc = album?.toLowerCase();

        return synced.find(track => track.trackName?.toLowerCase() === titleLc && (!albumLc || track.albumName?.toLowerCase() === albumLc))
            ?? synced.find(track => track.trackName?.toLowerCase() === titleLc)
            ?? synced[0];
    }

    static parse(track: LrclibTrack | undefined): LyricLine[] {
        if (!track?.syncedLyrics || track.instrumental) return [];
        return LrclibProvider.parseLrc(track.syncedLyrics);
    }

    static parseLrc(lrc: string): LyricLine[] {
        const lines: LyricLine[] = [];

        const offsetMatch = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i);
        const offset = offsetMatch ? parseInt(offsetMatch[1], 10) : 0;

        const timeTag = new RegExp(TIME_TAG_SOURCE, 'g');

        for (const rawLine of lrc.split(/\r?\n/)) {
            const timestamps = [...rawLine.matchAll(timeTag)];
            if (timestamps.length === 0) continue;

            const text = rawLine
                .replace(timeTag, '')
                .replace(/<\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?>/g, '')
                .trim();

            if (!text) continue;

            for (const timestamp of timestamps) {
                lines.push({
                    startTimeMs: Math.max(0, LrclibProvider.parseTimestamp(timestamp[1], timestamp[2], timestamp[3]) + offset),
                    text,
                });
            }
        }

        lines.sort((a, b) => a.startTimeMs - b.startTimeMs);

        for (let i = 0; i < lines.length - 1; i++) {
            lines[i].endTimeMs = lines[i + 1].startTimeMs;
        }

        return lines;
    }

    private static parseTimestamp(minutes: string, seconds: string, fraction?: string): number {
        let ms = 0;

        if (fraction) {
            const value = parseInt(fraction, 10);
            ms = fraction.length === 1 ? value * 100 : fraction.length === 2 ? value * 10 : value;
        }

        return parseInt(minutes, 10) * 60000 + parseInt(seconds, 10) * 1000 + ms;
    }
}
