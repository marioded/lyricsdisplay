import {ClientSettings} from '../types/settings';

export const SONG_FETCH_INTERVAL = 1000;
export const DEFAULT_COLOR = "#1DB954";
export const MAXIMUM_VISIBLE_LINES = 7;

export const DEFAULT_SETTINGS: ClientSettings = {
    language: 'en',
    showTitle: true,
    showArtists: true,
    showCover: true,
    fontName: 'Arial',
    fontSize: 18,
    color: DEFAULT_COLOR,
    maxLines: 5
};
