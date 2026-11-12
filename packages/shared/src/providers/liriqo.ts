import {LyricLine, LyricSyllable} from '../types/song';
import {LyricsProvider} from './types';
import {httpGetJson} from '../utils/httpFetch';

interface LiriqoWord {
    text: string;
    start: number;
    end: number;
}

interface LiriqoTimedLine {
    text: string;
    start: number;
    end: number;
    words?: LiriqoWord[];
}

interface LiriqoTrack {
    provider: string;
    syncLevel: string;
    nativeWordTiming?: boolean;
    plain?: string;
    timed?: LiriqoTimedLine[];
    ttml?: string;
}

interface LiriqoResponse {
    error?: string;
    tracks?: LiriqoTrack[];
    primary?: LiriqoTrack;
}

interface TtmlWord {
    text: string;
    start?: number;
    end?: number;
}

type LiriqoMode = 'word' | 'line';

const PUNCTUATION = /^[,.!?;:%)}\]…'’"”»]/;
const CJK = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

export class LiriqoProvider implements LyricsProvider {
    private static LIRIQO_API = 'https://api.liriqo-alfarrizi.my.id/v1';
    private static HEADERS = {'User-Agent': 'LyricsDisplay/0.1.1', Accept: 'application/json'};
    private static cacheKey: string | null = null;
    private static cacheBody: LiriqoResponse | null = null;

    readonly name: string;
    readonly timeoutMs = 8000;
    private readonly mode: LiriqoMode;

    constructor(mode: LiriqoMode = 'word') {
        this.mode = mode;
        this.name = mode === 'word' ? 'liriqo' : 'liriqo-line';
    }

    async fetchLyrics(title: string, artist: string, album: string, signal: AbortSignal, durationMs?: number): Promise<LyricLine[]> {
        const params = new URLSearchParams({title, artist});

        if (album) params.set('album', album);
        if (durationMs && durationMs > 0) params.set('duration', String(Math.round(durationMs / 1000)));

        const key = params.toString();

        try {
            let body: LiriqoResponse;

            if (LiriqoProvider.cacheKey === key && LiriqoProvider.cacheBody) {
                body = LiriqoProvider.cacheBody;
            } else {
                body = await httpGetJson<LiriqoResponse>(`${LiriqoProvider.LIRIQO_API}/lyrics?${params}`, LiriqoProvider.HEADERS, signal);

                if (!body?.error) {
                    LiriqoProvider.cacheKey = key;
                    LiriqoProvider.cacheBody = body;
                }
            }

            if (body?.error) {
                console.warn('[LiriQo] API error:', body.error);
                return [];
            }

            return LiriqoProvider.parse(LiriqoProvider.pickTrack(body, this.mode), this.mode);
        } catch (err: any) {
            if (signal?.aborted || err?.name === 'CanceledError' || err?.name === 'AbortError') throw err;
            console.warn('[LiriQo] fetchLyrics error:', err);
            return [];
        }
    }

    static pickTrack(body: LiriqoResponse | undefined, mode: LiriqoMode): LiriqoTrack | undefined {
        if (!body) return undefined;

        const candidates = [
            ...(body.primary ? [body.primary] : []),
            ...(body.tracks ?? []),
        ];

        if (mode === 'word') {
            const wordTracks = candidates.filter(track => LiriqoProvider.hasWordTiming(track, 'word'));
            if (wordTracks.length > 0) return wordTracks[0];

            return candidates.find(track => LiriqoProvider.hasWordTiming(track, 'syllable'));
        }

        const lineTracks = candidates.filter(track => track.syncLevel === 'line' && LiriqoProvider.hasLineTiming(track));
        return lineTracks[0] ?? candidates.find(track => LiriqoProvider.hasLineTiming(track));
    }

    static hasWordTiming(track: LiriqoTrack | undefined, syncLevel: 'word' | 'syllable'): boolean {
        if (!track || track.syncLevel !== syncLevel) return false;

        if (syncLevel === 'syllable' && track.ttml) return true;

        return Array.isArray(track.timed) && track.timed.some(line => (line.words?.length ?? 0) > 0);
    }

    static hasLineTiming(track: LiriqoTrack | undefined): boolean {
        if (!track || !Array.isArray(track.timed)) return false;
        return track.timed.some(line => typeof line?.text === 'string' && line.text.trim().length > 0);
    }

    static parse(track: LiriqoTrack | undefined, mode: LiriqoMode = 'word'): LyricLine[] {
        if (!track) return [];

        if (mode === 'word' && track.syncLevel === 'syllable' && track.ttml) {
            const lines = LiriqoProvider.parseTtml(track.ttml);
            if (lines.length > 0) return lines;
        }

        return track.timed ? LiriqoProvider.parseTimed(track.timed, mode === 'word') : [];
    }

    static parseTimed(timed: LiriqoTimedLine[], requireWords = true): LyricLine[] {
        const lines: LyricLine[] = [];
        let hasWords = false;

        for (const line of timed) {
            if (!line || typeof line.text !== 'string') continue;

            const words = (line.words ?? []).filter(word => typeof word?.text === 'string' && word.text.length > 0);
            const syllables = words.length > 0 ? LiriqoProvider.toSyllables(words, line.text) : undefined;

            if (syllables) hasWords = true;

            lines.push({
                startTimeMs: line.start ?? 0,
                endTimeMs: line.end ?? undefined,
                text: line.text,
                syllables,
            });
        }

        lines.sort((a, b) => a.startTimeMs - b.startTimeMs);

        return requireWords && !hasWords ? [] : lines;
    }

    static parseTtml(ttml: string): LyricLine[] {
        const lines: LyricLine[] = [];
        const paragraph = /<p\b([^>]*)>([\s\S]*?)<\/p>/g;

        let match: RegExpExecArray | null;

        while ((match = paragraph.exec(ttml)) !== null) {
            const lineBegin = LiriqoProvider.parseTime(LiriqoProvider.attr(match[1], 'begin'));
            const lineEnd = LiriqoProvider.parseTime(LiriqoProvider.attr(match[1], 'end'));
            const words = LiriqoProvider.parseTtmlWords(match[2]);

            if (words.length === 0) continue;

            const isCjk = CJK.test(match[2]);

            const syllables = words.map((word, index): LyricSyllable => {
                const next = words[index + 1]?.text?.trimStart() ?? '';

                return {
                    text: word.text.trim(),
                    startTimeMs: word.start ?? 0,
                    endTimeMs: word.end ?? 0,
                    partOfWord: isCjk || (next.length > 0 && PUNCTUATION.test(next)),
                };
            });

            lines.push({
                startTimeMs: lineBegin ?? syllables[0].startTimeMs,
                endTimeMs: lineEnd ?? syllables[syllables.length - 1].endTimeMs,
                text: LiriqoProvider.buildText(syllables, isCjk),
                syllables,
            });
        }

        lines.sort((a, b) => a.startTimeMs - b.startTimeMs);

        return lines;
    }

    private static parseTtmlWords(inner: string): TtmlWord[] {
        const isCjk = CJK.test(inner);
        const words: TtmlWord[] = [];
        const token = /<span\b([^>]*)>([\s\S]*?)<\/span>|([^<]+)/g;

        let current: TtmlWord | null = null;
        let pendingSpace = false;
        let match: RegExpExecArray | null;

        const flush = () => {
            if (current && current.text.trim()) words.push(current);
            current = null;
        };

        while ((match = token.exec(inner)) !== null) {
            if (match[3] !== undefined) {
                if (/\s/.test(match[3])) pendingSpace = true;
                continue;
            }

            const raw = match[2];
            const value = LiriqoProvider.decodeEntities(raw.replace(/<[^>]+>/g, ''));

            if (!value) continue;

            let start = LiriqoProvider.parseTime(LiriqoProvider.attr(match[1], 'begin'));
            let end = LiriqoProvider.parseTime(LiriqoProvider.attr(match[1], 'end'));

            if (start === undefined) start = LiriqoProvider.parseTime(LiriqoProvider.attr(raw, 'begin'));
            if (end === undefined) end = LiriqoProvider.parseTime(LiriqoProvider.attr(raw, 'end'));

            if (!isCjk && current && !pendingSpace) {
                current.text += value;
                if (end !== undefined) current.end = end;
            } else {
                flush();
                current = {text: value, start, end};
            }

            pendingSpace = false;
        }

        flush();

        return words;
    }

    private static toSyllables(words: LiriqoWord[], lineText: string): LyricSyllable[] {
        const isCjk = CJK.test(lineText);
        const hasWhitespace = words.some(word => /\s/.test(word.text));

        return words.map((word, index): LyricSyllable => {
            const raw = word.text;
            const text = raw.trimEnd();
            const next = words[index + 1]?.text?.trimStart() ?? '';

            let partOfWord: boolean;

            if (isCjk) {
                partOfWord = true;
            } else if (hasWhitespace) {
                partOfWord = !/\s$/.test(raw);
            } else {
                partOfWord = next.length > 0 && PUNCTUATION.test(next);
            }

            return {
                text,
                startTimeMs: word.start ?? 0,
                endTimeMs: word.end ?? 0,
                partOfWord,
            };
        });
    }

    private static buildText(syllables: LyricSyllable[], isCjk: boolean): string {
        return syllables.reduce((acc, syllable, index, all) => {
            if (index === 0) return syllable.text;

            const separator = isCjk || all[index - 1].partOfWord ? '' : ' ';
            return acc + separator + syllable.text;
        }, '');
    }

    private static parseTime(value: string | undefined): number | undefined {
        if (!value) return undefined;

        if (/^\d+(\.\d+)?$/.test(value)) {
            return Math.round(parseFloat(value) * 1000);
        }

        const parts = value.split(':').map(Number);
        if (parts.some(Number.isNaN)) return undefined;

        let seconds = 0;
        for (const part of parts) seconds = seconds * 60 + part;

        return Math.round(seconds * 1000);
    }

    private static attr(attrs: string, name: string): string | undefined {
        const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
        return match ? match[1] : undefined;
    }

    private static decodeEntities(value: string): string {
        return value
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, '&')
            .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
            .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)));
    }
}