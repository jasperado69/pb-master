# Pickleball 4.0 Tracker

A lightweight offline-first web app for tracking pickleball drills, training history, and weekly progress reviews.

## Features

- Dashboard with total sessions, average success percentage, average mastery, and weekly review counts.
- Drill logger with built-in 4.0-focused drill benchmarks from `drills.json`.
- Editable local training history stored in the browser with `localStorage`.
- Weekly assessment journal for focus skills, goals, metrics, and notes.
- Progressive Web App assets and service worker cache for offline use after first load.

## Run locally

```bash
python3 -m http.server 4173
```

Then open <http://127.0.0.1:4173/>.
