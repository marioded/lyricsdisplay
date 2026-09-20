import React, {useEffect, useState} from 'react';
import {MAXIMUM_VISIBLE_LINES, useI18n, useSettingsStore} from "@lyricsdisplay/shared";
import {invoke} from '@tauri-apps/api/core';
import {emit} from '@tauri-apps/api/event';
import {disable, enable, isEnabled} from '@tauri-apps/plugin-autostart';
import {PageWrapper} from "@/components/PageWrapper";
import {AlignLeft, Eye, Image as ImageIcon, MonitorPlay, Palette, Type, Users} from "lucide-react";

const COLORS = {
    bg: '#0B0B0D',
    card: '#151518',
    innerWell: '#1C1C20',
    text: '#F5F3EE',
    textMuted: '#A0A0A5',
    border: 'rgba(255,255,255,0.08)',
};

const SectionTitle: React.FC<{ icon: any }> = ({icon: Icon}) => (
    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center mr-3 mb-4">
        <Icon color={COLORS.text} size={16} strokeWidth={2.5}/>
    </div>

);

const FieldLabel: React.FC<{ children: string }> = ({children}) => (
    <div className="text-[#A0A0A5] text-[13px] font-semibold uppercase tracking-wider mb-2">
        {children}
    </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({children, className}) => (
    <div
        style={{backgroundColor: COLORS.card, borderColor: COLORS.border}}
        className={`border-[1px] rounded-3xl p-5 ${className || ''}`}
    >
        {children}
    </div>
);

const SettingsCard: React.FC<{ icon: any; children: React.ReactNode; className?: string }> = ({
                                                                                                  icon,
                                                                                                  children,
                                                                                                  className
                                                                                              }) => (
    <Card className={className}>
        <SectionTitle icon={icon}/>
        {children}
    </Card>
);

const SettingsSelect: React.FC<{
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string; }[];
}> = ({label, value, onChange, options}) => (
    <div className="mb-2">
        <FieldLabel>{label}</FieldLabel>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{backgroundColor: COLORS.innerWell, borderColor: COLORS.border}}
            className="w-full mt-2 p-3 rounded-2xl border-[1px] focus:outline-none focus:border-emerald-500 transition-all text-[#F5F3EE] cursor-pointer appearance-none"
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#1C1C20]">
                    {opt.label}
                </option>
            ))}
        </select>
    </div>
);

const SettingsSwitch: React.FC<{
    icon: any;
    label: string;
    value: boolean;
    accent: string;
    onChange: (val: boolean) => void;
}> = ({icon: Icon, label, value, accent, onChange}) => (
    <div className="flex items-center justify-between py-1 group cursor-pointer" onClick={() => onChange(!value)}>
        <div className="flex items-center">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center mr-3">
                <Icon color={COLORS.textMuted} size={16} strokeWidth={2.5}/>
            </div>
            <span className="text-[#F5F3EE] text-[15px] font-medium">{label}</span>
        </div>
        <button
            className={`relative w-12 h-6 rounded-full transition-all duration-300 border-[1px] ${
                value ? 'border-transparent' : 'border-white/10'
            }`}
            style={{backgroundColor: value ? accent : COLORS.innerWell}}
        >
      <span
          className={`absolute top-[1.5px] left-[1.5px] w-[19px] h-[19px] bg-white rounded-full shadow-lg transition-transform duration-300 ${
              value ? 'translate-x-[24px]' : 'translate-x-0'
          }`}
      />
        </button>
    </div>
);

export const SettingsView: React.FC = () => {
    const {settings, updateSettings: defaultUpdateSettings} = useSettingsStore();
    const updateSettings = async (newSettings: Partial<typeof settings>) => {
        defaultUpdateSettings(newSettings);

        await emit('update-settings', newSettings);
    }
    const {t, availableLanguages} = useI18n();
    const [installedFonts, setInstalledFonts] = useState<string[]>([]);
    const [autoStart, setAutoStart] = useState(false);

    useEffect(() => {
        invoke<string[]>('get_installed_fonts').then(setInstalledFonts).catch(console.error);
        isEnabled().then(setAutoStart).catch(console.error);
    }, []);

    const handleAutoStartChange = async (enabled: boolean) => {
        setAutoStart(enabled);
        if (enabled) {
            await enable().catch(console.error);
        } else {
            await disable().catch(console.error);
        }
    };

    const accent = settings.color || '#1DB954';

    return (
        <PageWrapper>
            <div className="w-full h-full overflow-y-auto no-scrollbar pt-16 px-8 grid grid-cols-2 gap-6">
                <SettingsCard icon={Palette}>
                    <div className="mb-6">
                        <FieldLabel>{t("settings.text-color")}</FieldLabel>
                        <div
                            style={{backgroundColor: COLORS.innerWell, borderColor: COLORS.border}}
                            className="mt-2 border-[1px] rounded-2xl p-3 flex items-center justify-between"
                        >
                            <span className="text-[#F5F3EE] font-medium text-sm">Accent Color</span>
                            <input
                                type="color"
                                value={settings.color}
                                onChange={(e) => updateSettings({color: e.target.value})}
                                className="w-16 h-10 rounded-lg cursor-pointer border-[1px] border-white/10 hover:border-white/20 transition-all bg-transparent p-1"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
                        <SettingsSelect
                            label={t("settings.locale")}
                            value={settings.language}
                            onChange={(val) => updateSettings({language: val})}
                            options={availableLanguages.map(lang => ({
                                value: lang,
                                label: t(`language.${lang}`)
                            }))}
                        />
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <FieldLabel>{t("settings.visible-lines")}</FieldLabel>
                            <div
                                style={{color: accent, backgroundColor: `${accent}1A`}}
                                className="text-[12px] font-bold px-2.5 py-1 rounded-md"
                            >
                                {settings.maxLines}
                            </div>
                        </div>
                        <div
                            style={{backgroundColor: COLORS.innerWell, borderColor: COLORS.border}}
                            className="border-[1px] rounded-2xl py-3 px-4 flex items-center"
                        >
                            <span className="text-[#A0A0A5] text-xs font-bold mr-4">1</span>
                            <input
                                type="range"
                                value={settings.maxLines}
                                onChange={(e) => updateSettings({maxLines: Number(e.target.value)})}
                                min={1}
                                max={MAXIMUM_VISIBLE_LINES}
                                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-[#A0A0A5] text-lg font-bold ml-4">{MAXIMUM_VISIBLE_LINES}</span>
                        </div>
                    </div>
                </SettingsCard>

                <SettingsCard icon={Type}>
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <FieldLabel>{t("settings.font-size")}</FieldLabel>
                            <div
                                style={{color: accent, backgroundColor: `${accent}1A`}}
                                className="text-[12px] font-bold px-2.5 py-1 rounded-md"
                            >
                                {settings.fontSize}px
                            </div>
                        </div>
                        <div
                            style={{backgroundColor: COLORS.innerWell, borderColor: COLORS.border}}
                            className="border-[1px] rounded-2xl py-3 px-4 flex items-center"
                        >
                            <span className="text-[#A0A0A5] text-xs font-bold mr-4">A</span>
                            <input
                                type="range"
                                value={settings.fontSize}
                                onChange={(e) => updateSettings({fontSize: Number(e.target.value)})}
                                min={12}
                                max={48}
                                className="flex-1 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <span className="text-[#A0A0A5] text-lg font-bold ml-4">A</span>
                        </div>
                    </div>

                    <div className="mb-6">
                        <SettingsSelect
                            label={t("settings.font")}
                            value={settings.fontName}
                            onChange={(val) => updateSettings({fontName: val})}
                            options={installedFonts.map(font => ({
                                value: font,
                                label: font
                            }))}
                        />
                    </div>

                    <div
                        style={{backgroundColor: COLORS.innerWell, borderColor: COLORS.border}}
                        className="rounded-xl p-6 text-center border-[1px] w-full flex items-center justify-center"
                    >
                        <p
                            style={{
                                fontFamily: settings.fontName,
                                fontSize: `${settings.fontSize}px`,
                                color: settings.color,
                            }}
                            className="transition-all duration-300 font-medium break-words"
                        >
                            {t('settings.preview-text')}
                        </p>
                    </div>
                </SettingsCard>

                <SettingsCard icon={AlignLeft} className="col-span-2">
                    <div className="grid grid-cols-2 gap-x-12 gap-y-3">
                        <SettingsSwitch
                            icon={Eye}
                            label={t("settings.show-title")}
                            value={settings.showTitle}
                            accent={accent}
                            onChange={(val) => updateSettings({showTitle: val})}
                        />
                        <SettingsSwitch
                            icon={Users}
                            label={t("settings.show-artists")}
                            value={settings.showArtists}
                            accent={accent}
                            onChange={(val) => updateSettings({showArtists: val})}
                        />
                        <SettingsSwitch
                            icon={ImageIcon}
                            label={t("settings.show-cover")}
                            value={settings.showCover}
                            accent={accent}
                            onChange={(val) => updateSettings({showCover: val})}
                        />
                        <SettingsSwitch
                            icon={MonitorPlay}
                            label={t("settings.auto-start")}
                            value={autoStart}
                            accent={accent}
                            onChange={handleAutoStartChange}
                        />
                    </div>
                </SettingsCard>
            </div>
        </PageWrapper>
    );
};
