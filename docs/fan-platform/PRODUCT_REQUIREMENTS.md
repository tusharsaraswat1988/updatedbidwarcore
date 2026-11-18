# BIDWAR Fan Platform — Product Requirements

## Overview
The BIDWAR Fan Platform is a public-facing, high-scale sports technology product providing a unified experience for tournament followers. It supports Auction-only, Scoring-only, and combined Auction+Scoring tournament modes through a single, consistent application shell.

## Core Requirements

### 1. Unified Application Shell
- **Consistency:** One design system, navigation architecture, and public API boundary.
- **Independence:** Decoupled from organiser frontend internals to support future standalone deployment.
- **Responsiveness:** Premium, mobile-first design for all device types.
- **Performance:** Client-side routing for seamless navigation between modules.

### 2. Tournament Modes
- **Mode A (Auction Only):** Focus on auction interface, real-time bidding, and player valuation.
- **Mode B (Auction + Scoring):** Integrated experience, allowing fans to switch between auction/scoring data.
- **Mode C (Scoring Only):** Focus on match fixtures, live scoring, scorecards, and standings.

### 3. Public User Experience (Foundation Phase)
- **Homepage:** Premium sports-tech identity, live activity ticker, featured live tournament, search, sport/city filters.
- **Tournament Discovery:** "Live Now", "Starting Soon", "Completed" lists.
- **Theming:** Full dark/light mode support, persisted per user.

### 4. Scalability & Security (P0)
- **Data Projection:** Strict separation between public API and organiser systems.
- **Authentication:** Authoritative server-side entitlement service to gate data based on trial vs. licensed status. Independent Fan Session.
- **Realtime:** Efficient event distribution using Redis Streams to handle thousands of concurrent spectators without database bottleneck.

### 5. Deployment
- **Routing:** Public access behind `/fan/*` with path-based tournament identification (`/fan/:publicSlug`).
- **Isolation:** Cookie isolation, CORS protection, and secure API boundaries.
