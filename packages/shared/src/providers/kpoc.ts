import {LyricLine, LyricSyllable} from '../types/song';
import {LyricsProvider} from './types';
import {httpGetJson} from '../utils/httpFetch';

export class KpocProvider implements LyricsProvider {
    private static KPOC_API = 'https://lyricsplus.prjktla.my.id/v2/lyrics/get';
    readonly name = 'kpoc';
    readonly timeoutMs = 5000;

    async fetchLyrics(title: string, artist: string, _album: string, signal: AbortSignal): Promise<LyricLine[]> {
        const url = `${KpocProvider.KPOC_API}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;

        try {
            const body = await httpGetJson(url, {}, signal);
            console.log(body)
            return KpocProvider.parse(body);
        } catch (err: any) {
            if (signal?.aborted || err?.name === 'CanceledError' || err?.name === 'AbortError') throw err;
            console.warn('[Kpoc] fetchLyrics error:', err);
            return [];
        }
    }

    static parse(data: any): LyricLine[] {
        console.log(data)
        if (!Array.isArray(data?.lyrics)) return [];

        const isSynced = data.type === 'Word';

        return data.lyrics
            .filter((line: any) => typeof line?.text === 'string' && line.text.length > 0)
            .map((line: any): LyricLine => {
                if (!isSynced || !Array.isArray(line.syllabus) || line.syllabus.length === 0) {
                    return {
                        startTimeMs: line.time ?? 0,
                        endTimeMs: line.duration ? (line.time ?? 0) + line.duration : undefined,
                        text: line.text,
                    };
                }

                const syllables: LyricSyllable[] = line.syllabus.map((syllable: any) => {
                    const rawText: string = syllable.text ?? '';
                    return {
                        text: rawText.trimEnd(),
                        startTimeMs: syllable.time ?? 0,
                        endTimeMs: (syllable.time ?? 0) + (syllable.duration ?? 0),
                        partOfWord: !rawText.endsWith(' '),
                    };
                });

                return {
                    startTimeMs: line.time ?? 0,
                    endTimeMs: line.duration ? (line.time ?? 0) + line.duration : undefined,
                    text: line.text,
                    syllables,
                };
            });
    }
}
