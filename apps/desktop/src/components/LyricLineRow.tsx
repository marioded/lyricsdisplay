import React, {useCallback, useMemo} from "react";
import {motion} from "framer-motion";
import {LyricLine, LyricSyllable, usePlayerStore, needsSpaceBefore, lineText} from "@lyricsdisplay/shared";
import {
    buildColors,
    getKaraokeChars,
    getSyllableStatus,
    KaraokeChar,
    LyricColors,
} from "@lyricsdisplay/ui-core";

interface LyricLineRowProps {
    line: LyricLine;
    isCenter: boolean;
    isPast: boolean;
    opacity: number;
    scale: number;
    blur: number;
    oppositeAlign: boolean;
    fontSize: number;
    color: string;
}

const MAX_OFFSET = 60;

const Char = React.memo(({char: {char, state}, colors}: {
    char: KaraokeChar;
    colors: LyricColors;
}) => (
    <span
        style={{
            color: state === "future" ? colors.inactive : colors.active,
            filter: state === "active"
                ? "brightness(1.4) saturate(1.2)"
                : state === "past" ? "brightness(1.05)" : "brightness(0.88)",
            transition: "color 0.1s ease, text-shadow 0.15s ease, filter 0.15s ease",
            fontWeight: state === "future" ? 400 : 550,
        }}
    >
        {char === " " ? "\u00A0" : char}
    </span>
));

const Syllable = React.memo(({syllable, currentProgressMs, colors}: {
    syllable: LyricSyllable;
    currentProgressMs: number;
    colors: LyricColors;
}) => {
    const {isActive, isPast} = getSyllableStatus(syllable, currentProgressMs);

    if (isActive) {
        const chars = getKaraokeChars(syllable, currentProgressMs);
        return (
            <span className="inline-block relative" style={{letterSpacing: "0.02em"}}>
                {chars.map((c, i) => <Char key={i} char={c} colors={colors}/>)}

                <motion.span
                    className="absolute inset-0 pointer-events-none rounded"
                    animate={{opacity: [0, 0.5, 0]}}
                    transition={{duration: 0.55, repeat: Infinity, ease: "easeInOut"}}
                    style={{
                        background: `radial-gradient(ellipse at center, ${colors.glowSoft} 0%, transparent 75%)`,
                        filter: "blur(6px)",
                        zIndex: -1,
                    }}
                />
            </span>
        );
    }

    return (
        <span style={{
            color: isPast ? colors.active : colors.inactive,
            filter: isPast ? "brightness(1.05)" : "brightness(0.88)",
            transition: "color 0.12s ease, text-shadow 0.18s ease",
            letterSpacing: "0.02em",
            fontWeight: isPast ? 550 : 400,
        }}>
            {syllable.text}
        </span>
    );
});

export const LyricLineRow: React.FC<LyricLineRowProps> = React.memo(
    ({line, isCenter, isPast, opacity, blur, oppositeAlign, fontSize, color}) => {
        const currentProgressMs = usePlayerStore((s) =>
            isCenter ? s.currentProgressMs : 0
        );

        const colors = useMemo(() => buildColors(color), [color]);
        const offsetX = oppositeAlign ? (line.oppositeAligned ? -MAX_OFFSET : MAX_OFFSET) : 0;

        const renderLine = useCallback(() => {
            if (!isCenter) {
                return (
                    <span style={{
                        color: isPast ? colors.past : colors.inactive,
                        textShadow: isPast
                            ? `0 2px 6px rgba(0,0,0,0.3), 0 0 10px ${colors.glowSoft}`
                            : "0 1px 3px rgba(0,0,0,0.2)",
                        fontWeight: isPast ? 550 : 400,
                        filter: isPast ? "brightness(1.05)" : "brightness(0.88)",
                        transition: "color 0.2s ease",
                    }}>
                        {lineText(line)}
                    </span>
                );
            }

            if (line.syllables && line.syllables.length > 0) {
                return line.syllables.map((syl, idx) => (
                    <React.Fragment key={`${syl.startTimeMs}-${idx}`}>
                        {needsSpaceBefore(idx, line.syllables[idx - 1]?.partOfWord ?? false) && (
                            <span style={{color: colors.inactive}}>{"\u00A0"}</span>
                        )}
                        <Syllable
                            syllable={syl}
                            currentProgressMs={currentProgressMs}
                            colors={colors}
                        />
                    </React.Fragment>
                ));
            }

            return (
                <span style={{
                    color: colors.active,
                    textShadow: `0 0 10px ${colors.glow}`,
                    fontWeight: 400,
                }}>
                    {line.text}
                </span>
            );
        }, [isCenter, isPast, line, colors, currentProgressMs]);

        return (
            <motion.div
                layout="position"
                className="relative my-1 w-full px-12"
                animate={{opacity, x: offsetX}}
                transition={{
                    layout: {type: "spring", stiffness: 200, damping: 24},
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                }}
                style={{
                    fontSize: `${fontSize}px`,
                    filter: blur > 0 ? `blur(${blur}px)` : undefined,
                    lineHeight: "1.8",
                    textAlign: "center",
                    letterSpacing: isCenter ? "0.02em" : "-0.01em",
                    willChange: "opacity, transform",
                }}
            >
                <span data-tauri-drag-region className="relative z-10 max-w-full">{renderLine()}</span>
            </motion.div>
        );
    }
);
