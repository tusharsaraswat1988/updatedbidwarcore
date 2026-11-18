# BIDWAR Fan Platform — UI/UX Design Brief

## Design Philosophy (Foundation Phase)
- **Premium Sports-Tech:** High-impact, dark-mode/light-mode (system preference), accessible, fast.
- **Persistent Shell:** Navigation, theme toggle, and audio controls are always available.

## Key UI Components
- **Homepage:** Premium identity, live ticker, featured live tournament, search, sport/city filters.
- **Unified Shell:** Navigation, audio controls (always-visible), tournament context.
- **Stream Embed:** Safe, sandboxed iframe player (provider allowlist) with status fallback.

## Implementation Details
- Themes must persist across sessions via local storage.
- Audio control MUST be visible at all times to allow fans to mute live stream audio immediately.
