import React, { useCallback, useMemo } from 'react';
import { ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import {
  MAXIMUM_VISIBLE_LINES,
  SettingsStore,
  useI18n,
  useSettingsStore,
} from '@lyricsdisplay/shared';
import {
  AlignLeft,
  Eye,
  Image as ImageIcon,
  Palette,
  Type,
  Users,
  X,
} from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { Picker } from '@react-native-picker/picker';
import ColorPicker, { HueSlider, Panel1 } from 'reanimated-color-picker';
import { useShallow } from 'zustand/react/shallow';

interface Props {
  onClose: () => void;
}

const withAlpha = (hex: string, alpha: string) => `${hex}${alpha}`;

const COLORS = {
  bg: '#0B0B0D',
  card: '#151518',
  innerWell: '#1C1C20',
  text: '#F5F3EE',
  textMuted: '#A0A0A5',
  border: 'rgba(255,255,255,0.08)',
};

const FONT_OPTIONS = [
  { label: 'Default', value: 'normal' },
  { label: 'Sans-Serif', value: 'sans-serif' },
  { label: 'Sans-Serif Light', value: 'sans-serif-light' },
  { label: 'Sans-Serif Medium', value: 'sans-serif-medium' },
  { label: 'Sans-Serif Condensed', value: 'sans-serif-condensed' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Sans-Serif Black', value: 'sans-serif-black' },
];

const VISIBLE_LINE_OPTIONS = Array.from(
  { length: MAXIMUM_VISIBLE_LINES },
  (_, i) => i + 1,
);

const SectionTitle = React.memo<{ icon: any }>(({ icon: Icon }) => (
  <View className="flex-row items-center mb-5">
    <View className="w-8 h-8 rounded-full bg-white/5 items-center justify-center mr-3">
      <Icon color={COLORS.text} size={16} strokeWidth={2.5} />
    </View>
  </View>
));

const FieldLabel = React.memo<{ children: string }>(({ children }) => (
  <Text className="text-white text-[13px] font-semibold uppercase tracking-wider py-2">
    {children}
  </Text>
));

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <View
    style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
    className={`border-[1px] rounded-3xl p-6 ${className || ''}`}
  >
    {children}
  </View>
);

const SettingsCard: React.FC<{
  icon: any;
  children: React.ReactNode;
  className?: string;
}> = ({ icon, children, className }) => (
  <Card className={className}>
    <SectionTitle icon={icon} />
    {children}
  </Card>
);

const Divider = React.memo(() => (
  <View style={{ backgroundColor: COLORS.border }} className="h-[1px] my-5" />
));

const SettingsSwitch = React.memo<{
  icon: any;
  label: string;
  value: boolean;
  accent: string;
  onValueChange: (val: boolean) => void;
}>(({ icon: Icon, label, value, accent, onValueChange }) => {
  const trackColor = useMemo(
    () => ({ false: COLORS.innerWell, true: accent }),
    [accent],
  );

  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-row items-center">
        <View className="w-8 h-8 rounded-lg bg-white/5 items-center justify-center mr-3">
          <Icon color={COLORS.textMuted} size={16} strokeWidth={2.5} />
        </View>
        <Text className="color-[#F5F3EE] text-[15px] font-medium">{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={trackColor}
        thumbColor="#ffffff"
      />
    </View>
  );
});

const VisibleLinesPicker = React.memo<{
  value: number;
  accent: string;
  onChange: (num: number) => void;
}>(({ value, accent, onChange }) => (
  <View
    style={{ backgroundColor: COLORS.innerWell, borderColor: COLORS.border }}
    className="flex-row border-[1px] rounded-xl p-1"
  >
    {VISIBLE_LINE_OPTIONS.map(num => {
      const isActive = value === num;
      return (
        <TouchableOpacity
          key={num}
          accessibilityRole="button"
          onPress={() => onChange(num)}
          style={
            isActive
              ? {
                  backgroundColor: accent,
                  shadowColor: accent,
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }
              : undefined
          }
          className="flex-1 py-2.5 items-center justify-center rounded-lg"
        >
          <Text
            style={
              isActive
                ? { color: '#FFFFFF', fontWeight: '800' }
                : { color: COLORS.textMuted, fontWeight: '600' }
            }
            className="text-[14px]"
          >
            {num}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
));

export const SettingsScreen: React.FC<Props> = ({ onClose }) => {
  const {
    color: accent,
    language,
    fontSize,
    fontName,
    maxLines,
    showTitle,
    showArtists,
    showCover,
  } = useSettingsStore(
    useShallow((state: SettingsStore) => ({
      color: state.settings.color,
      language: state.settings.language,
      fontSize: state.settings.fontSize,
      fontName: state.settings.fontName,
      maxLines: state.settings.maxLines,
      showTitle: state.settings.showTitle,
      showArtists: state.settings.showArtists,
      showCover: state.settings.showCover,
    })),
  );
  const updateSettings = useSettingsStore(state => state.updateSettings);
  const { t, availableLanguages } = useI18n();

  const onColorChange = useCallback(
    (color: { hex: string }) => updateSettings({ color: color.hex }),
    [updateSettings],
  );
  const onLanguageChange = useCallback(
    (val: string) => updateSettings({ language: val }),
    [updateSettings],
  );
  const onFontSizeChange = useCallback(
    (val: number) => updateSettings({ fontSize: val }),
    [updateSettings],
  );
  const onFontNameChange = useCallback(
    (val: string) => updateSettings({ fontName: val }),
    [updateSettings],
  );
  const onMaxLinesChange = useCallback(
    (num: number) => updateSettings({ maxLines: num }),
    [updateSettings],
  );
  const onShowTitleChange = useCallback(
    (val: boolean) => updateSettings({ showTitle: val }),
    [updateSettings],
  );
  const onShowArtistsChange = useCallback(
    (val: boolean) => updateSettings({ showArtists: val }),
    [updateSettings],
  );
  const onShowCoverChange = useCallback(
    (val: boolean) => updateSettings({ showCover: val }),
    [updateSettings],
  );

  const accentBadgeStyle = useMemo(
    () => ({ color: accent, backgroundColor: withAlpha(accent, '1A') }),
    [accent],
  );

  return (
    <View className="flex-1 w-full h-full bg-[#0B0B0D]">
      <View className="flex-row items-center justify-between p-6 border-b border-white/10">
        <FieldLabel>{t('settings.title')}</FieldLabel>
        <TouchableOpacity
          accessibilityRole="button"
          hitSlop={15}
          onPress={onClose}
          style={{ backgroundColor: COLORS.card, borderColor: COLORS.border }}
          className="rounded-lg border-[1px] items-center justify-center"
        >
          <X color={COLORS.textMuted} size={20} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
      >
        <SettingsCard icon={Palette} className="mb-5">
          <View className="mb-6">
            <FieldLabel>{t('settings.text-color')}</FieldLabel>
            <View
              style={{
                backgroundColor: COLORS.innerWell,
                borderColor: COLORS.border,
              }}
              className="mt-2 border-[1px] rounded-2xl p-3"
            >
              <ColorPicker
                value={accent}
                onCompleteJS={onColorChange}
                style={{ width: '100%' }}
              >
                <Panel1 />
                <HueSlider />
              </ColorPicker>
            </View>
          </View>

          <View className="mb-6">
            <FieldLabel>{t('settings.locale')}</FieldLabel>
            <View
              style={{
                backgroundColor: COLORS.innerWell,
                borderColor: COLORS.border,
              }}
              className="mt-2 border-[1px] rounded-2xl p-3"
            >
              <Picker
                selectedValue={language}
                onValueChange={onLanguageChange}
                style={{ color: COLORS.text }}
                dropdownIconColor={COLORS.text}
              >
                {availableLanguages.map(lang => (
                  <Picker.Item
                    key={lang}
                    label={t(`language.${lang}`)}
                    value={lang}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </SettingsCard>

        <SettingsCard icon={Type} className="mb-5">
          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <FieldLabel>{t('settings.font-size')}</FieldLabel>
              <Text
                style={accentBadgeStyle}
                className="text-[12px] font-bold px-2.5 py-1 rounded-md overflow-hidden"
              >
                {fontSize}px
              </Text>
            </View>
            <View
              style={{
                backgroundColor: COLORS.innerWell,
                borderColor: COLORS.border,
              }}
              className="border-[1px] rounded-2xl py-3 px-4 flex-row items-center"
            >
              <Text
                style={{ color: COLORS.textMuted }}
                className="text-xs font-bold mr-3"
              >
                A
              </Text>
              <Slider
                style={{ flex: 1, height: 40 }}
                minimumValue={12}
                maximumValue={48}
                step={1}
                value={fontSize}
                onValueChange={onFontSizeChange}
                minimumTrackTintColor={accent}
                maximumTrackTintColor={COLORS.border}
                thumbTintColor="#ffffff"
              />
              <Text
                style={{ color: COLORS.textMuted }}
                className="text-lg font-bold ml-3"
              >
                A
              </Text>
            </View>
          </View>

          <View>
            <FieldLabel>{t('settings.font')}</FieldLabel>
            <View
              style={{
                backgroundColor: COLORS.innerWell,
                borderColor: COLORS.border,
              }}
              className="mt-2 py-0 border-[1px] rounded-2xl overflow-hidden"
            >
              <Picker
                selectedValue={fontName}
                onValueChange={onFontNameChange}
                style={{ color: COLORS.text }}
                dropdownIconColor={COLORS.text}
              >
                {FONT_OPTIONS.map(f => (
                  <Picker.Item key={f.value} label={f.label} value={f.value} />
                ))}
              </Picker>
            </View>
          </View>
        </SettingsCard>

        <SettingsCard icon={AlignLeft}>
          <View className="mb-5">
            <FieldLabel>{t('settings.visible-lines')}</FieldLabel>
            <View className="mt-2">
              <VisibleLinesPicker
                value={maxLines}
                accent={accent}
                onChange={onMaxLinesChange}
              />
            </View>
          </View>

          <Divider />

          <SettingsSwitch
            icon={Eye}
            label={t('settings.show-title')}
            value={showTitle}
            accent={accent}
            onValueChange={onShowTitleChange}
          />
          <View className="h-3" />
          <SettingsSwitch
            icon={Users}
            label={t('settings.show-artists')}
            value={showArtists}
            accent={accent}
            onValueChange={onShowArtistsChange}
          />
          <View className="h-3" />
          <SettingsSwitch
            icon={ImageIcon}
            label={t('settings.show-cover')}
            value={showCover}
            accent={accent}
            onValueChange={onShowCoverChange}
          />
        </SettingsCard>
      </ScrollView>
    </View>
  );
};
