/**
 * @lyricsdisplay/shared
 *
 * Contains shared types, constants, services and hooks for the app platforms.
 */

export type { Album, Artist, SongItem, Song, LyricSyllable, LyricLine, RawLineLyric, RawSyllableLyric, RawSyllableSection, TranslationEntry } from './types/song';
export type { ClientSettings } from './types/settings';

export { VISIBLE_LYRICS_COUNT, SONG_FETCH_INTERVAL, DEFAULT_SETTINGS } from './constants/config';

export { LyricsApiService } from './api/lyricsApi';
export type { LyricsProvider } from './providers';
export { LyricsProviderManager, PaxsenixProvider } from './providers';


export { PlayerService } from './service/playerService';
export { I18nService } from './service/i18nService';

export { usePlayerStore } from './store/playerStore';
export { useSettingsStore } from './store/settingStore';
export type { SettingsStore } from './store/settingStore';

export { usePlayer, registerTimerController } from './hooks/usePlayer';
export { useI18n } from './hooks/useI18n';
export { setHttpInstance } from './utils/httpFetch';
export type { CurrentSongFetcher } from './hooks/usePlayer';
export * from './hooks/useSongDetails';
export * from './hooks/useVisibleLyrics';
export * from './utils/lyrics';