export const PLATFORM_AUDIO_SETTING_KEYS = {
    countdownSoundUrl: "default_countdown_sound_url",
    soldSoundUrl: "default_sold_sound_url",
    breakEndMusicUrl: "default_break_end_sound_url",
};
export const EMPTY_PLATFORM_AUDIO_DEFAULTS = {
    countdownSoundUrl: null,
    soldSoundUrl: null,
    breakEndMusicUrl: null,
};
/** Tournament custom URL wins; otherwise platform default; otherwise null (built-in synth). */
export function resolveBroadcastAudioUrl(tournamentUrl, platformUrl) {
    const custom = tournamentUrl?.trim();
    if (custom)
        return custom;
    const platform = platformUrl?.trim();
    if (platform)
        return platform;
    return null;
}
export function resolveBroadcastAudioUrls(tournament, platform) {
    return {
        countdownSoundUrl: resolveBroadcastAudioUrl(tournament.countdownSoundUrl, platform.countdownSoundUrl),
        soldSoundUrl: resolveBroadcastAudioUrl(tournament.soldSoundUrl, platform.soldSoundUrl),
        breakEndMusicUrl: resolveBroadcastAudioUrl(tournament.breakEndMusicUrl, platform.breakEndMusicUrl),
    };
}
