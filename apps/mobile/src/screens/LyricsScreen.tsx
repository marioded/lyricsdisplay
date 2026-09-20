import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Dimensions,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { OverlayManager } from 'react-native-android-overlay';
import {
  useI18n,
  useSettingsStore,
  useVisibleLyrics,
} from '@lyricsdisplay/shared';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { LyricsDisplay } from '../components/LyricsDisplay';
import { SongInfo } from '../components/SongInfo';
import { SystemMediaManager } from '../modules/SystemMediaManager';
import { Layers, Settings, SkipBack, SkipForward } from 'lucide-react-native';
import { SettingsScreen } from './SettingsScreen';
import { useMobilePlayer } from '../hooks/useMobilePlayer';
import { DEFAULT_COLOR } from '@lyricsdisplay/shared/src/constants/config.ts';

const OVERLAY_SIZE = { width: 400, height: 60 };

const EqualizerMark: React.FC<{
  color: string;
  active?: boolean;
  size?: number;
}> = React.memo(({ color, active = false, size = 14 }) => {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.35))).current;
  const [motionAllowed, setMotionAllowed] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(enabled => mounted && setMotionAllowed(!enabled))
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!active || !motionAllowed) {
      bars.forEach((bar, i) => {
        Animated.timing(bar, {
          toValue: active ? 0.55 + i * 0.15 : 0.35,
          duration: 200,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 120),
          Animated.timing(bar, {
            toValue: 1,
            duration: 360,
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: 0.3,
            duration: 360,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    loops.forEach(loop => loop.start());
    return () => loops.forEach(loop => loop.stop());
  }, [active, motionAllowed, bars]);

  return (
    <View style={{ height: size }} className="flex-row items-end gap-[3px]">
      {bars.map((bar, i) => (
        <Animated.View
          key={i}
          style={{
            width: size * 0.1,
            height: size,
            backgroundColor: color,
            transform: [{ scaleY: bar }],
          }}
          className="rounded-[1.5px]"
        />
      ))}
    </View>
  );
});

const ScreenHeader: React.FC<{
  song: any;
  settings: any;
  accent: string;
  isPlaying: boolean;
  topInset: number;
  onOpenSettings: () => void;
  t: (key: string) => string;
}> = React.memo(({ song, settings, accent, isPlaying, onOpenSettings, t }) => (
  <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/10">
    <View className="px-2">
      <EqualizerMark color={accent} size={30} active={isPlaying} />
    </View>
    <View className="flex-1 px-4 py-2">
      <SongInfo
        song={song}
        showTitle={settings.showTitle}
        showArtists={settings.showArtists}
        showCover={settings.showCover}
        fontSize={settings.fontSize}
      />
    </View>

    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
      hitSlop={10}
      onPress={onOpenSettings}
      className="w-9 h-9 rounded-lg border border-white/10 items-center justify-center"
    >
      <Settings color="#F5F3EE" size={18} />
    </TouchableOpacity>
  </View>
));

const InfoBlock: React.FC<{
  accent: string;
  eyebrow: string;
  title?: string;
  body: string;
  footnote?: React.ReactNode;
  action?: React.ReactNode;
}> = React.memo(({ accent, eyebrow, title, body, footnote, action }) => (
  <View className="max-w-[300px] px-8">
    <EqualizerMark color={accent} size={16} />
    <Text
      style={{ color: accent }}
      className="text-[15px] font-medium tracking-[1.2px] uppercase mt-[14px]"
    >
      {eyebrow}
    </Text>
    {title && (
      <Text className="color-[#F5F3EE] text-[19px] font-bold mt-1.5">
        {title}
      </Text>
    )}
    <Text className="color-[#F5F3EE]/55 text-[13px] leading-[19px] mt-2">
      {body}
    </Text>
    {footnote && <View className="mt-2.5">{footnote}</View>}
    {action && <View className="mt-[22px]">{action}</View>}
  </View>
));

const PermissionGate: React.FC<{ accent: string; t: (key: string) => string }> =
  React.memo(({ accent, t }) => (
    <InfoBlock
      accent={accent}
      eyebrow={t('permission.eyebrow')}
      title={t('permission.title')}
      body={t('permission.body')}
      footnote={
        <Text className="text-sm color-[#F5F3EE]/55">
          {t('permission.footnote')}{' '}
        </Text>
      }
      action={
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => SystemMediaManager.requestMediaAccess()}
          style={{ backgroundColor: accent }}
          className="self-start px-[22px] py-3 rounded-lg"
        >
          <Text className="text-white text-[13px] font-bold tracking-[0.4px]">
            {t('permission.grant-button')}
          </Text>
        </TouchableOpacity>
      }
    />
  ));

const PlaybackControls: React.FC<{
  isPlaying: boolean;
  accent: string;
  onPrev: () => void;
  onPlayPause: () => void;
  onNext: () => void;
}> = React.memo(({ isPlaying, accent, onPrev, onPlayPause, onNext }) => (
  <View className="flex-row items-center justify-center w-full my-2 gap-8">
    <TouchableOpacity accessibilityRole="button" hitSlop={14} onPress={onPrev}>
      <SkipBack color="#F5F3EE" size={22} />
    </TouchableOpacity>

    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPlayPause}
      style={{ backgroundColor: accent, shadowColor: accent }}
      className="w-[62px] h-[62px] rounded-full items-center justify-center shadow-lg elevation-5 active:scale-95"
    >
      {isPlaying ? (
        <View className="flex-row gap-[5px]">
          <View className="w-[5px] h-5 rounded-[1.5px] bg-white" />
          <View className="w-[5px] h-5 rounded-[1.5px] bg-white" />
        </View>
      ) : (
        <View className="w-0 h-0 ml-1 border-t-[11px] border-b-[11px] border-l-[18px] border-t-transparent border-b-transparent border-l-white" />
      )}
    </TouchableOpacity>

    <TouchableOpacity accessibilityRole="button" hitSlop={14} onPress={onNext}>
      <SkipForward color="#F5F3EE" size={22} />
    </TouchableOpacity>
  </View>
));

const OverlayToggleButton: React.FC<{
  active: boolean;
  accent: string;
  onPress: () => void;
  t: (key: string) => string;
}> = React.memo(({ active, accent, onPress, t }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    className="mt-7 mb-5 flex-row items-center p-4 rounded-xl bg-white/10"
  >
    <Layers color={active ? accent : DEFAULT_COLOR} size={14} />
    <Text
      style={{ color: active ? accent : DEFAULT_COLOR }}
      className="text-[15px] font-medium tracking-[1.2px] uppercase ml-3"
    >
      {active ? t('overlay.disable') : t('overlay.enable')}
    </Text>
  </TouchableOpacity>
));

export const LyricsScreen = () => {
  const { t } = useI18n();
  const { song, lyrics, centerIndex } = useMobilePlayer();
  const settings = useSettingsStore(state => state.settings);
  const accent = settings.color;
  const insets = useSafeAreaInsets();

  const [overlayActive, setOverlayActive] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [hasMediaAccess, setHasMediaAccess] = useState<boolean | null>(null);
  
  const slideAnim = useRef(new Animated.Value(Dimensions.get('window').height)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: settingsVisible ? 0 : Dimensions.get('window').height,
      duration: 350,
      useNativeDriver: true,
    }).start();
  }, [settingsVisible, slideAnim]);

  const isPlaying = song?.is_playing ?? false;

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        const ok = await SystemMediaManager.hasMediaAccess();
        if (mounted) setHasMediaAccess(ok);
      } catch (e) {
        console.error('[SystemMedia] Permission check failed', e);
      }
    };

    check();

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') check();
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    isPlaying ? SystemMediaManager.pause() : SystemMediaManager.play();
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    SystemMediaManager.skipToNext();
  }, []);

  const handlePrev = useCallback(() => {
    SystemMediaManager.skipToPrevious();
  }, []);

  const { visibleLyrics, startIndex } = useVisibleLyrics(
    lyrics,
    centerIndex,
    settings.maxLines
  );

  const hasOppositeAligned = useMemo(
    () => lyrics.some(line => line.oppositeAligned),
    [lyrics],
  );

  const toggleOverlay = useCallback(async () => {
    if (!overlayActive) {
      const hasOverlayPerm = await OverlayManager.hasPermission();
      if (!hasOverlayPerm) {
        OverlayManager.requestPermission();
        return;
      }
      OverlayManager.startOverlay('Overlay', {
        ...OVERLAY_SIZE,
        draggable: true,
        touchable: true,
        focusable: false,
        foreground: true,
      });
      setOverlayActive(true);
    } else {
      OverlayManager.stopOverlay();
      setOverlayActive(false);
    }
  }, [overlayActive]);

  const renderBody = () => {
    if (!hasMediaAccess) return <PermissionGate accent={accent} t={t} />;

    if (overlayActive) {
      return (
        <InfoBlock
          accent={accent}
          eyebrow={t('overlay.active-eyebrow')}
          body={t('overlay.active-body')}
        />
      );
    }

    if (!song?.item) {
      return (
        <InfoBlock
          accent={accent}
          eyebrow={t('empty.listening-eyebrow')}
          title={t('empty.waiting-title')}
          body={''}
        />
      );
    }

    return (
      <LyricsDisplay
        lyrics={visibleLyrics}
        oppositeAlign={hasOppositeAligned}
        centerIndex={centerIndex}
        startIndex={startIndex}
        fontSize={settings.fontSize}
        fontName={settings.fontName}
        color={accent}
      />
    );
  };

  return (
    <View className="flex-1 bg-[#0B0B0D]">
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0D" />

      <ScreenHeader
        song={song}
        settings={settings}
        accent={accent}
        isPlaying={isPlaying}
        topInset={insets.top}
        onOpenSettings={() => setSettingsVisible(true)}
        t={t}
      />

      <View className="flex-1 items-center justify-center">{renderBody()}</View>

      <View className="bg-black/25 p-6 w-full">
        <PlaybackControls
          isPlaying={isPlaying}
          accent={accent}
          onPrev={handlePrev}
          onPlayPause={handlePlayPause}
          onNext={handleNext}
        />

        <View className="items-center justify-center">
          <OverlayToggleButton
            active={overlayActive}
            accent={accent}
            onPress={toggleOverlay}
            t={t}
          />
        </View>
      </View>

      <Animated.View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 50,
          transform: [{ translateY: slideAnim }],
        }}
        pointerEvents={settingsVisible ? 'auto' : 'none'}
      >
        <SafeAreaProvider>
          <SettingsScreen onClose={() => setSettingsVisible(false)} />
        </SafeAreaProvider>
      </Animated.View>
    </View>
  );
};
