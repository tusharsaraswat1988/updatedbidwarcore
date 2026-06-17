export const PLATFORM_AUDIO_SETTING_KEYS = {
  countdownSoundUrl: "default_countdown_sound_url",
  soldSoundUrl: "default_sold_sound_url",
  breakEndMusicUrl: "default_break_end_sound_url",
} as const;

export type PlatformAudioDefaults = {
  countdownSoundUrl: string | null;
  soldSoundUrl: string | null;
  breakEndMusicUrl: string | null;
};

export const EMPTY_PLATFORM_AUDIO_DEFAULTS: PlatformAudioDefaults = {
  countdownSoundUrl: null,
  soldSoundUrl: null,
  breakEndMusicUrl: null,
};

/** Tournament custom URL wins; otherwise platform default; otherwise null (built-in synth). */
export function resolveBroadcastAudioUrl(
  tournamentUrl: string | null | undefined,
  platformUrl: string | null | undefined,
): string | null {
  const custom = tournamentUrl?.trim();
  if (custom) return custom;
  const platform = platformUrl?.trim();
  if (platform) return platform;
  return null;
}

export function resolveBroadcastAudioUrls(
  tournament: {
    countdownSoundUrl?: string | null;
    soldSoundUrl?: string | null;
    breakEndMusicUrl?: string | null;
  },
  platform: PlatformAudioDefaults,
): PlatformAudioDefaults {
  return {
    countdownSoundUrl: resolveBroadcastAudioUrl(tournament.countdownSoundUrl, platform.countdownSoundUrl),
    soldSoundUrl: resolveBroadcastAudioUrl(tournament.soldSoundUrl, platform.soldSoundUrl),
    breakEndMusicUrl: resolveBroadcastAudioUrl(tournament.breakEndMusicUrl, platform.breakEndMusicUrl),
  };
}
