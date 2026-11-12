import {useEffect} from 'react';
import {usePlayerStore} from '../store/playerStore';
import {PlayerService} from '../service/playerService';
import {SONG_FETCH_INTERVAL} from '../constants/config';
import {LyricLine, Song} from '../types/song';
import {useI18n} from "../hooks/useI18n";

const getNow = (): number => {
    const g = typeof globalThis !== 'undefined' ? (globalThis as any) : null;
    if (g && g.performance && typeof g.performance.now === 'function') {
        return g.performance.now();
    }
    return Date.now();
};

export interface CurrentSongFetcher {
    fetchCurrentSong: () => Promise<Song | null>;
}

interface UsePlayerProps {
    fetcher: CurrentSongFetcher;
}

const createNoLyricsPlaceholder = (text: string): LyricLine[] => [
    {startTimeMs: 0, text}
];

export interface TimerController {
    setInterval: (callback: () => void, ms: number) => any;
    clearInterval: (id: any) => void;
}

let globalTimerController: TimerController = {
    setInterval: (callback, ms) => setInterval(callback, ms),
    clearInterval: (id) => {
        if (id) clearInterval(id);
    },
};

export const registerTimerController = (controller: TimerController) => {
    if (controller) {
        globalTimerController = {
            setInterval: controller.setInterval || ((callback, ms) => setInterval(callback, ms)),
            clearInterval: controller.clearInterval || ((id) => {
                if (id) clearInterval(id);
            }),
        };
    }
};

class PlayerIntervalManager {
    private activePlayers = 0;
    private syncInterval: any = null;
    private fetchInterval: any = null;
    private fetcher: any = null;
    private noLyricsText: string = 'No lyrics available';
    private lastUpdateTime = 0;
    private progressMs = 0;

    start(fetcher: any, noLyricsText: string) {
        this.fetcher = fetcher;
        this.noLyricsText = noLyricsText;
        this.activePlayers++;

        if (this.activePlayers === 1) {
            this.lastUpdateTime = getNow();
            this.progressMs = usePlayerStore.getState().currentProgressMs;

            this.fetchSong();

            this.syncInterval = globalTimerController.setInterval(() => this.updateLyrics(), 32);
            this.fetchInterval = globalTimerController.setInterval(() => this.fetchSong(), SONG_FETCH_INTERVAL);
        }
    }

    updateLyrics() {
        const store = usePlayerStore.getState();
        if (!store.lyrics.length || !store.song || !store.song.is_playing) {
            this.lastUpdateTime = getNow();
            return;
        }

        const now = getNow();
        const elapsed = now - this.lastUpdateTime;
        this.progressMs += elapsed;
        this.lastUpdateTime = now;

        store.setCurrentProgressMs(this.progressMs);

        const newIndex = PlayerService.getInstance().calculateCurrentLyricIndex(store.lyrics, this.progressMs);
        if (newIndex !== store.centerIndex && store.lyrics[newIndex]) {
            store.setCenterIndex(newIndex);
        }

    }

    async fetchSong() {
        if (!this.fetcher) return;

        try {
            const fetchStartTime = getNow();
            const currentSong = await this.fetcher.fetchCurrentSong();
            const fetchEndTime = getNow();

            const store = usePlayerStore.getState();

            const estimatedLatency = Math.min((fetchEndTime - fetchStartTime) / 2, 200);
            const currentSongId = hashSong(currentSong);
            const previousSongId = hashSong(store.song);
            const hasSongChanged = currentSongId !== previousSongId;

            const wasPlaying = store.song?.is_playing ?? false;
            const isPlaying = currentSong?.is_playing ?? false;
            const playStateChanged = wasPlaying !== isPlaying;

            store.setSong(currentSong);

            if (!isPlaying) return;

            if (!currentSong) {
                store.setLyrics(createNoLyricsPlaceholder(this.noLyricsText));
                store.setCenterIndex(0);
                store.setCurrentProgressMs(0);
                this.progressMs = 0;
                return;
            }

            if (hasSongChanged) {
                store.setLyrics(createNoLyricsPlaceholder(this.noLyricsText));
                store.setCenterIndex(0);

                PlayerService.getInstance().fetchLyrics(
                    currentSong.item.name,
                    currentSong.item.artists?.[0]?.name ?? "",
                    currentSong.item.album.name,
                    currentSong.item.duration_ms
                ).then((newLyrics) => {
                    const latestSongId = hashSong(usePlayerStore.getState().song);
                    if (latestSongId === currentSongId && newLyrics.length) {
                        usePlayerStore.getState().setLyrics(newLyrics);
                    }
                }).catch((err) => {
                    console.error("Failed to fetch lyrics for new song:", err);
                });
            }

            const baseProgress = currentSong.progress_ms ?? 0;
            const targetProgress = isPlaying ? baseProgress + estimatedLatency : baseProgress;

            if (hasSongChanged || playStateChanged) {
                store.setCurrentProgressMs(targetProgress);
                this.progressMs = targetProgress;
                this.lastUpdateTime = getNow();
            } else {
                const diff = Math.abs(this.progressMs - targetProgress);
                const threshold = isPlaying ? 1000 : 100;

                if (diff > threshold) {
                    store.setCurrentProgressMs(targetProgress);
                    this.progressMs = targetProgress;
                    this.lastUpdateTime = getNow();
                }
            }
        } catch (err) {
            console.error("Failed to fetch current song:", err);
        }
    }

    stop() {
        this.activePlayers = Math.max(0, this.activePlayers - 1);
        if (this.activePlayers === 0) {
            const clearInt = (globalTimerController && globalTimerController.clearInterval)
                || (typeof globalThis !== 'undefined' && globalThis.clearInterval)
                || (typeof window !== 'undefined' && window.clearInterval)
                || clearInterval;
            if (this.syncInterval) {
                try {
                    clearInt(this.syncInterval);
                } catch (e) {
                    clearInterval(this.syncInterval);
                }
            }
            if (this.fetchInterval) {
                try {
                    clearInt(this.fetchInterval);
                } catch (e) {
                    clearInterval(this.fetchInterval);
                }
            }
            this.syncInterval = null;
            this.fetchInterval = null;
        }
    }
}

const intervalManager = new PlayerIntervalManager();

function hashSong(currentSong: Song | null): string | null {
    if (!currentSong?.item) return null;
    return `${currentSong.item.name}-${currentSong.item.artists?.[0]?.name ?? ''}`;
}

export const usePlayer = ({fetcher}: UsePlayerProps) => {
    const {t} = useI18n();

    const song = usePlayerStore(state => state.song);
    const lyrics = usePlayerStore(state => state.lyrics);
    const centerIndex = usePlayerStore(state => state.centerIndex);
    const setLyrics = usePlayerStore(state => state.setLyrics);

    const noLyricsText = t('no-lyrics');

    useEffect(() => {
        if (!lyrics) return;

        const isEmpty = lyrics.length === 0 || (lyrics.length === 1 && lyrics[0].text === '');
        const hasPlaceholder = lyrics.length === 1 && lyrics[0].text === noLyricsText;

        if (isEmpty && !hasPlaceholder) {
            setLyrics(createNoLyricsPlaceholder(noLyricsText));
        }
    }, [noLyricsText, lyrics, setLyrics]);

    useEffect(() => {
        intervalManager.start(fetcher, noLyricsText);

        return () => {
            intervalManager.stop();
        };
    }, [fetcher, noLyricsText]);

    return {song, lyrics, centerIndex};
};