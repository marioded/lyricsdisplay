import {LyricLine, LyricSyllable} from '../types/song';
import {LyricsProvider} from './types';
import {httpGet, httpGetJson} from '../utils/httpFetch';
import {buildLineText} from '../utils/lyrics';

let cachedToken: string | null = null;

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:95.0) Gecko/20100101 Firefox/95.0';
const AM_API = 'https://amp-api.music.apple.com/v1/catalog/us';
const AM_WEB = 'https://beta.music.apple.com';

async function fetchAppleMusicToken(forceRefresh = false): Promise<string> {
    if (!forceRefresh && cachedToken) return cachedToken;

    const mainHtml = await httpGet(AM_WEB, {'User-Agent': BROWSER_UA});
    const indexJsMatch = mainHtml.match(/\/assets\/index~[^/]+\.js/);
    if (!indexJsMatch) throw new Error('[Paxsenix] index JS URL not found');

    const jsBundle = await httpGet(AM_WEB + indexJsMatch[0], {'User-Agent': BROWSER_UA});
    const tokenMatch = jsBundle.match(/eyJ[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+/);
    if (!tokenMatch) throw new Error('[Paxsenix] JWT token not found in JS bundle');

    cachedToken = tokenMatch[0];
    return cachedToken;
}

function amHeaders(token: string): Record<string, string> {
    return {
        Authorization: `Bearer ${token}`,
        Origin: 'https://music.apple.com',
        Referer: 'https://music.apple.com/',
        'User-Agent': BROWSER_UA,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.5',
        'x-apple-renewal': 'true',
    };
}

async function searchAppleMusic(title: string, artist: string, token: string, signal: AbortSignal): Promise<string | null> {
    const term = encodeURIComponent(`${title} ${artist}`);
    const url = `${AM_API}/search?term=${term}&types=songs&limit=25&l=en-US&platform=web&format[resources]=map&include[songs]=artists&extend=artistUrl`;

    try {
        const body: any = await httpGetJson(url, amHeaders(token), signal);
        const songsData: any[] = body?.results?.songs?.data ?? [];
        if (!songsData.length) return null;

        const resources = body?.resources?.songs ?? {};
        const titleLc = title.toLowerCase();

        const best = songsData.find(s => (resources[s.id]?.attributes?.name ?? '').toLowerCase() === titleLc) ?? songsData[0];
        return best?.id ?? null;
    } catch (err: any) {
        const errMsg = String(err?.message ?? err);
        if (errMsg.includes('401')) {
            throw new Error('401');
        }
        return null;
    }
}

export class PaxsenixProvider implements LyricsProvider {
    private static PAXSENIX_API = 'https://lyrics.paxsenix.org/apple-music/lyrics?id=';
    readonly name = 'paxsenix';

    async fetchLyrics(title: string, artist: string, _album: string, signal: AbortSignal): Promise<LyricLine[]> {
        const trackId = await this.resolveTrackId(title, artist, signal)
        if (!trackId) return [];

        return this.fetchFromPaxsenix(trackId, signal);
    }

    private async resolveTrackId(title: string, artist: string, signal: AbortSignal): Promise<string | null> {
        try {
            let token = await fetchAppleMusicToken();
            try {
                return await searchAppleMusic(title, artist, token, signal);
            } catch (err: any) {
                if (err.message === '401' && cachedToken) {
                    cachedToken = null;
                    token = await fetchAppleMusicToken(true);
                    return await searchAppleMusic(title, artist, token, signal);
                }

                throw err;
            }
        } catch (err) {
            console.warn('[Paxsenix] resolveTrackId error:', err);
            return null;
        }
    }

    private async fetchFromPaxsenix(trackId: string, signal: AbortSignal): Promise<LyricLine[]> {
        try {
            const body = await httpGetJson(`${PaxsenixProvider.PAXSENIX_API}${trackId}`, {}, signal);
            return PaxsenixProvider.parse(body);
        } catch {
            return [];
        }
    }

    static parse(data: any): LyricLine[] {
        if (!data?.content || !Array.isArray(data.content)) return [];

        return data.content
            .filter((line: any) => Array.isArray(line.text) && line.text.length > 0)
            .map((line: any): LyricLine => {
                const syllables: LyricSyllable[] = line.text.map((word: any) => ({
                    text: word.text ?? '',
                    startTimeMs: word.timestamp ?? 0,
                    endTimeMs: word.endtime ?? 0,
                    partOfWord: word.part === true,
                }));

                const text = buildLineText(syllables);

                return {
                    startTimeMs: line.timestamp ?? 0,
                    endTimeMs: line.endtime ?? undefined,
                    text,
                    syllables,
                    oppositeAligned: line.oppositeTurn === true || line.background === true,
                };
            });
    }
}