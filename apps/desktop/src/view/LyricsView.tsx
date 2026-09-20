import React from 'react';
import {SongInfo} from "@/components/SongInfo";
import {LyricsDisplay} from "@/components/LyricsDisplay";
import {useMouseHitTesting} from "@/hooks/useMouseHitTesting";
import {useWindowController} from "@/hooks/useWindowController";
import {useTauriFetcher} from "@/hooks/useTauriFetcher";
import {useSettingsSync} from "@/hooks/useSettingsSync";
import {usePlayer, useSettingsStore, useVisibleLyrics} from "@lyricsdisplay/shared";

export const LyricsView: React.FC = () => {
    const fetcher = useTauriFetcher();

    const {song, lyrics, centerIndex} = usePlayer({fetcher});

    const {settings} = useSettingsStore();

    const {visibleLyrics, startIndex} = useVisibleLyrics(
        lyrics,
        centerIndex,
        settings.maxLines
    );

    useSettingsSync();
    useWindowController();
    useMouseHitTesting([visibleLyrics, settings]);

    return (
        <div
            className="h-screen w-full flex flex-col items-center relative"
            style={{
                fontFamily: `${settings.fontName}, sans-serif`,
                color: settings.color,
                textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
            }}
        >
            <div className="text-center">
                <SongInfo
                    song={song}
                    showTitle={settings.showTitle}
                    showArtists={settings.showArtists}
                    showCover={settings.showCover}
                    fontSize={settings.fontSize}
                />
            </div>

            <div className="lyrics-container w-full">
                <LyricsDisplay
                    lyrics={visibleLyrics}
                    oppositeAlign={lyrics.some(line => line.oppositeAligned)}
                    centerIndex={centerIndex}
                    startIndex={startIndex}
                    fontSize={settings.fontSize}
                    color={settings.color}
                />
            </div>
        </div>
    );
};