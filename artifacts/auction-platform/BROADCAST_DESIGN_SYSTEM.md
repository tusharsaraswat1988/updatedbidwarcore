# BidWar Broadcast Design System

A professional, broadcast-grade design system for sports auction platforms. Built to deliver real-time auction experiences with the visual impact of professional sports broadcasting.

## Overview

The BidWar broadcast design system is designed with inspiration from professional sports broadcasting control rooms and IPL-style auction environments. It prioritizes:

- **Real-time visual feedback** — Bid tickers, state badges, and animations that communicate momentum
- **Broadcast quality** — Professional color grading, typography, and component spacing
- **Accessibility** — Respects `prefers-reduced-motion`, keyboard navigation, WCAG AA contrast
- **Performance** — GPU-safe animations, no layout shifts, responsive across devices

## Color Palette

### Primary Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Dark Base** | `#0F1117` | Page background, broadcast control room aesthetic |
| **IPL Gold** | `#F5B301` | Primary brand color, call-to-action, highlights |
| **Ember Orange** | `#FF6B35` | Live state, active auctions, real-time indicators |
| **Emerald Green** | `#10B981` | Sold state, success states, completed actions |
| **Cyan** | `#06B6D4` | Upcoming/next state, real-time data indicators |

### Neutral Palette

| Shade | Hex |
|-------|-----|
| White | `#FFFFFF` |
| Gray 100 | `#F3F4F6` |
| Gray 500 | `#6B7280` |
| Gray 700 | `#374151` |
| Gray 900 | `#111827` |

## Typography

All type scales are defined in `src/lib/broadcast-theme.ts`:

- **Display Font**: Space Grotesk (headings, badges, lower-third text)
- **Body Font**: Inter (body text, descriptions)
- **Mono Font**: Menlo (data, codes, technical info)

### Scale

```
H1: 3.5rem / font-weight 700
H2: 2.5rem / font-weight 700
H3: 1.875rem / font-weight 700
Body: 1rem / font-weight 400
Caption: 0.75rem / font-weight 500 (tracking: 0.05em)
```

## Core Components

### AuctionCardHero

A broadcast-grade component for displaying live player auction data.

**Location**: `src/components/auction-card-hero.tsx`

**Features**:
- Animated bid ticker (respects `prefers-reduced-motion`)
- State badges (live, sold, unsold, upcoming)
- Team information display
- Real-time bid increment percentage
- Live bidding indicator stripe
- Sold stamp overlay with spring animation

**Usage**:

```tsx
import { AuctionCardHero } from "@/components/auction-card-hero";

<AuctionCardHero
  playerName="Virat Kohli"
  playerRole="Batter"
  currentBid={1800000}
  basePrice={500000}
  team="Mumbai Hawks"
  state="live"
  animationsEnabled={true}
/>
```

**Props**:

| Prop | Type | Description |
|------|------|-------------|
| `playerName` | string | Display name of the player |
| `playerRole` | string | Player role (e.g., "Batter", "Bowler") |
| `currentBid` | number | Current bid amount in rupees |
| `basePrice` | number | Base/reserve price for comparison |
| `team` | string | Team name that placed the bid |
| `state` | `"live" \| "sold" \| "unsold" \| "upcoming"` | Current auction state |
| `imageSrc` | string | Optional player image URL |
| `imageAlt` | string | Alt text for image |
| `animationsEnabled` | boolean | Enable animations (default: true) |

**States**:

- **live**: Orange badge, pulsing indicator, bid ticker animates
- **sold**: Green checkmark overlay, state finalized
- **unsold**: Gray badge, neutral state
- **upcoming**: Cyan badge, next in queue

### AuctionCardMini

Compact version for carousels and showcases.

**Usage**:

```tsx
<AuctionCardMini
  playerName="Jasprit Bumrah"
  currentBid={1600000}
  state="sold"
  imageSrc="/player-bumrah.jpg"
/>
```

## Theme Constants

**Location**: `src/lib/broadcast-theme.ts`

Provides:
- `BROADCAST_THEME` — Complete theme object
- `getAuctionStateStyling()` — Helper for state colors/badges
- `getBroadcastColor()` — Direct color access

**Example**:

```tsx
import { getAuctionStateStyling, BROADCAST_THEME } from "@/lib/broadcast-theme";

const styling = getAuctionStateStyling("live");
// Returns: { bg: "bg-orange/10", border: "border-orange", text: "text-orange", badge: "Live", animation: "pulse" }

const gold = BROADCAST_THEME.colors.gold; // "#F5B301"
```

## Landing Page Integration

The broadcast design system is integrated throughout the landing page:

### Enhanced Sections

1. **Hero Section**
   - Primary gold glow text effect
   - Broadcast-style hero visual with live auction mockup
   - Dark base background for contrast

2. **Features Section**
   - Hover gradient overlays
   - Enhanced icon backgrounds
   - Broadcast-inspired card styling

3. **Auction Card Showcase** (NEW)
   - Three broadcast auction cards showing live/sold/upcoming states
   - Animated bid tickers (with motion preferences)
   - Real-world player examples

4. **Why BidWar Section**
   - Card-based layout for each benefit point
   - Hover effects and focus states
   - Gold accent borders

5. **Pricing Section**
   - Emphasized one-time license model
   - Gold text shadow on "No Monthly Fees"
   - Limited-time discount banner

6. **Use Cases & Gallery**
   - Gradient overlay effects on hover
   - Broadcast-quality gallery cards
   - Icon highlights with gradient backgrounds

## Accessibility Features

### Motion Preferences

All animations automatically disable for users with `prefers-reduced-motion: reduce`:

```tsx
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

if (!prefersReducedMotion) {
  // Animation runs
} else {
  // Static state, no animation
}
```

### Color Contrast

- Minimum WCAG AA compliance (4.5:1 for normal text, 3:1 for large text)
- Gold against dark backgrounds: 8.2:1 ratio
- All interactive elements have visible focus states

### Keyboard Navigation

- All buttons and links are keyboard accessible
- Focus indicators use gold primary color
- Tab order follows logical reading order

## Animation Patterns

### GPU-Safe Animations

Use `transform` and `opacity` only (no layout-triggering properties):

```css
/* Good */
@keyframes slideIn {
  from { transform: translateX(-10px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

/* Avoid */
@keyframes badSlide {
  from { left: -10px; width: 100px; }
  to { left: 0; width: 110px; }
}
```

### Framer Motion Examples

**Bid Ticker Animation**:
```tsx
<motion.div
  key={displayBid}
  animate={{ y: [10, 0], opacity: [0.5, 1] }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
  ₹{displayBid.toLocaleString("en-IN")}
</motion.div>
```

**Sold Stamp**:
```tsx
<motion.div
  initial={{ scale: 0, rotate: -45 }}
  animate={{ scale: 1, rotate: 0 }}
  transition={{
    type: "spring",
    stiffness: 200,
    damping: 15
  }}
>
  ✓
</motion.div>
```

**Pulse Effect**:
```tsx
<motion.div
  animate={{ opacity: [1, 0.6, 1] }}
  transition={{ duration: 2, repeat: Infinity }}
/>
```

## Responsive Design

Built mobile-first, then enhanced for larger screens:

```css
/* Base (mobile) */
grid-cols-1

/* Medium screens (768px+) */
md:grid-cols-2

/* Large screens (1024px+) */
lg:grid-cols-3
```

## Usage in New Components

When creating new components, follow these patterns:

### 1. Import the theme

```tsx
import { getAuctionStateStyling, BROADCAST_THEME } from "@/lib/broadcast-theme";
```

### 2. Use semantic color variables

```tsx
// Good
className="bg-card/30 border-border hover:border-primary/40"

// Less maintainable
className="bg-[#161B22]/30 border-[#30363D] hover:border-[#F5B301]/40"
```

### 3. Respect motion preferences

```tsx
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const shouldAnimate = animationsEnabled && !prefersReducedMotion;
```

### 4. Use consistent spacing

Reference `BROADCAST_THEME.spacing` for Tailwind scale:
- xs: 0.25rem
- sm: 0.5rem
- md: 1rem (default)
- lg: 1.5rem
- xl: 2rem

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari 14+, Chrome Mobile)

**Note**: Framer Motion requires ES6 support. No IE11 support.

## Performance Considerations

1. **Bundle Size**: Theme constants are tree-shakeable (~2KB gzipped)
2. **Animation Performance**: Use GPU-accelerated properties only
3. **Image Loading**: Lazy-load images in carousel/gallery
4. **Network**: Colors use CSS variables (no runtime calculation)

## Future Enhancements

- [ ] Dark/light mode toggle
- [ ] Custom theme builder UI
- [ ] Storybook integration
- [ ] Design tokens export to Figma
- [ ] E2E animation testing suite

---

**Last Updated**: 2026-07-15
**Version**: 1.0.0
**Maintained By**: BidWar Design Team
