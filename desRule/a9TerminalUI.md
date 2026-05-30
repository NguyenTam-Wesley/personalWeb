# ARKNIGHTS_TERMINAL_UI_RULES.md

## Core Design Philosophy

This interface should feel like a professional operator terminal.

Users should feel:

* Efficient
* Focused
* In control
* Inside a command system

Not:

* Cozy
* Playful
* Social media
* Consumer app

The experience should resemble a mission control dashboard.

---

## Visual Identity

Keywords:

Industrial
Military
Technical
Minimal
Data-Oriented
High Information Density

Reference mood:

Arknights
Control (Remedy)
Ghost in the Shell
Military command software
Cyberpunk terminals

---

## Color System

Primary Background:
#0b0d10

Secondary Surface:
#12161d

Elevated Surface:
#1a1f29

Primary Text:
#e8edf2

Secondary Text:
#95a0ad

Accent:
#ffb400

Danger:
#ff5f57

Success:
#62d26f

Never use:

* Purple gradients
* Neon rainbow colors
* Bright gaming RGB effects

Accent colors should feel functional.

---

## Layout Philosophy

Everything aligns to a grid.

Use:

* Hard edges
* Sharp corners
* Rectangular modules

Avoid:

* Pill buttons
* Large border radius
* Floating cards

Preferred radius:

0px - 4px

---

## Information Density

High density is encouraged.

Users should see:

* Many songs
* Many playlists
* Many filters

without excessive scrolling.

Avoid giant empty spaces.

Avoid oversized components.

---

## Panel Architecture

UI should be composed of modules.

Example:

LEFT PANEL

* Navigation
* Playlist Tree

CENTER PANEL

* Song Database

RIGHT PANEL

* Now Playing
* Metadata
* Queue

TOP BAR

* Search
* User Status
* System Information

Every panel should feel like a subsystem.

---

## Typography

Use:

Inter
IBM Plex Sans
JetBrains Mono

Mono font should appear in:

* IDs
* Metadata
* Counters
* Timestamps

Headings should be bold and technical.

Avoid decorative fonts.

---

## Navigation

Navigation should resemble system sections.

Examples:

MUSIC_LIBRARY

ARTISTS_DATABASE

GENRE_INDEX

PLAYLIST_ARCHIVE

USER_PROFILE

SYSTEM_CONFIG

Prefer uppercase labels.

---

## Music Library

Primary display:

Table View

Columns:

TRACK_ID
TITLE
ARTIST
GENRE
REGION
LENGTH

Rows should resemble database records.

Avoid large album cards as default.

---

## Playlist Design

Playlist should resemble folders.

Display:

PLAYLIST_NAME

TRACK_COUNT

LAST_UPDATE

OWNER

Use tree-view hierarchy when possible.

---

## Search System

Search is a command center.

Search bar must be permanently visible.

Visual style:

Large width
Sharp borders
Terminal-inspired

Placeholder:

Search tracks, artists, genres...

---

## Data Visualization

Allowed:

Progress bars

Activity counters

Status indicators

Signal indicators

Queue length

Storage usage

Avoid:

Pie charts

Fancy dashboards

Decorative graphs

---

## Motion Design

Motion should be mechanical.

Allowed:

Slide

Fade

Panel reveal

Scan line effect

Subtle loading bars

Forbidden:

Bounce

Elastic motion

Cartoon transitions

Overly smooth floating effects

Duration:

120ms - 220ms

---

## Hover States

Hover should feel like targeting.

Examples:

Border highlight

Accent strip

Row illumination

Cursor tracking effects

Do not use glow explosions.

---

## Music Player

Player should feel like equipment.

Display:

TRACK STATUS

BITRATE

DURATION

QUEUE POSITION

PLAYBACK MODE

Use structured data blocks.

Avoid oversized album art.

Album art is secondary.

Information is primary.

---

## Guest Mode

Guests are observers.

Locked functions remain visible.

Display system notices:

ACCESS DENIED

LOGIN REQUIRED

PERMISSION LEVEL INSUFFICIENT

Never hide unavailable features.

---

## Decorative Elements

Allowed:

Grid overlays

Technical separators

Coordinates

Panel labels

System codes

Module identifiers

Examples:

MUS-001

PLY-024

USR-101

These elements should create immersion.

---

## AI Slop Prevention

Never generate:

Rounded SaaS dashboard

Glassmorphism

Marketing landing page

Gradient hero section

Centered giant title

Three feature cards

Modern startup aesthetic

The interface is a terminal system.

Every element must serve operational efficiency.
