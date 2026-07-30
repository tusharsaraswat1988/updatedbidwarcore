# Badminton Venue Scoreboard Audio — Design Spec

**Date:** 2026-07-30  
**Status:** Approved  
**Approach:** Display-derived SFX + remote `venueMusicPlaying` flag (auction LED pattern)

## Goal

Add venue LED scoreboard audio for badminton:

1. **Custom loop music** — Control Center On/Pause; loops while on; anytime (hype/crowd).
2. **Auto SFX** — Game Point, Match Point, Deuce from scoring state edges.
3. Venue LED only (not OBS overlay).

## Architecture

```
Control Center
  → PATCH broadcast-presentation { venueMusicPlaying }
  → branding / tournament SSE

Venue LED display
  → BadmintonAudioManager
  → loop: flag On = play/loop, Off = pause
  → SFX: match_state edges (game_point / match_point / deuce)
  → on SFX: pause loop → play stinger → resume if flag still On
```

No dedicated “play sound” SSE event. Displays derive SFX from `match_state` like auction LED derives countdown/sold from session state.

## Data model

Store under `scoringSettingsJson.broadcast`:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `venueMusicPlaying` | boolean | `false` | Remote On/Pause for loop music |
| `venueMusicUrl` | string \| null | `null` | Badminton override track |
| `venueMusicVolume` | number 0–100 | `80` | Loop volume |

Exposed on `BadmintonBranding` as the same fields.

**Music URL resolve order (display):**

1. `venueMusicUrl` if set  
2. Tournament auction `breakEndMusicUrl`  
3. Platform default break music  

Settings UI: upload new track **or** “Import from auction” (copy auction break URL into `venueMusicUrl`). If neither set, display falls through to auction → platform default without writing a copy.

## API

Extend `PATCH /broadcast-presentation`:

- Accept optional `venueMusicPlaying: boolean`
- Refine: at least one of `overlayScene`, `venueScene`, `venueMusicPlaying`
- Include `venueMusicPlaying` in branding JSON + `broadcastTournamentUpdate` payload

Extend branding PATCH (or dedicated audio settings endpoint on branding page) for `venueMusicUrl` / `venueMusicVolume` + import-from-auction action.

## Components

| Piece | Location |
|-------|----------|
| `BadmintonAudioManager` | `artifacts/auction-platform/src/lib/badminton-audio-manager.ts` |
| `useBadmintonBroadcastAudio` | hook on venue display only |
| Audio unlock button | reuse auction pattern on display |
| Audio leader | reuse / adapt display audio leader so multi tabs don’t double-play |
| Play/Pause UI | Mission Control / Control Center ops rail (primary live match context) |
| Settings | Badminton branding / settings — upload + import from auction |

## Auto SFX triggers

Use existing core helpers (`detectGamePointSide`, `detectMatchPointSide`, `isInDeuce`):

| Cue | Edge |
|-----|------|
| Game Point | side enters game-point (not match-point) |
| Match Point | side enters match-point |
| Deuce | `isInDeuce` becomes true |

Dedupe with refs (score signature / banner key). Built-in synth or platform default short stingers only (no custom SFX upload in v1).

Priority if both game and match point apply: play **Match Point** only.

## Loop vs SFX interaction

When an SFX fires and music is playing: pause loop → play SFX → if `venueMusicPlaying` still true, resume loop. Operator Pause during SFX leaves music paused.

## Out of scope (v1)

- OBS overlay audio  
- Per-match Live Control music buttons  
- Custom Game/Match/Deuce SFX uploads  
- Game Won / Match Won / Interval / Court Change stingers (future)

## Testing

- Unit: branding parse for `venueMusicPlaying` / URL resolve order  
- Unit: SFX edge detection dedupe (game vs match point priority, deuce enter once)  
- Manual: Control Center On/Pause on venue LED; score to game/match/deuce; unlock click
