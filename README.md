# Study Reviewer

Study Reviewer is a calm, local-first web application for organizing and
reviewing questions, terms, answers, and explanations. It is designed for
focused study without accounts, advertising, recommendations, or cloud-
dependent data storage.

## Current application

Study Reviewer currently provides:

- A dashboard with live category, topic, entry, focus-session, and focus-time
  summaries
- Recent category and topic activity with direct links back into the library
- Context-aware creation controls for categories, topics, and entries
- Category and topic management with search, sorting, counts, and safe deletion
- Question & Answer and Term & Definition entries with local persistence
- List Study Mode with column visibility, reveal controls, editing, and deletion
- Flashcard Study Mode with type-aware fronts, 3D flipping, keyboard controls,
  sliding navigation, swipe gestures, and session-only shuffle
- Settings for light, dark, and system themes, study defaults, flashcard
  orientation, entry-field copy/paste, spellcheck, and Pomodoro preferences
- JSON export and import for topic and category content, plus complete local
  backup and replacement restore in Settings
- Responsive navigation, breadcrumbs, visible focus states, and a persistent
  Pomodoro timer
- Direct local PDF export for the current topic or selected category topics

Study data remains in the current browser and device through `localStorage`; no
backend, account, cloud sync, remote API, remote font, or network-loaded core
asset is required. Offline installation remains a planned improvement.

## Technology

The project uses React, TypeScript, Vite, Tailwind CSS, shadcn/ui primitives,
and Bun for package management and local development. Vitest and Playwright
remain planned validation technologies and will be introduced when testing
work is explicitly requested.

## Local development

Prerequisite: [Bun](https://bun.sh/).

```sh
bun install
bun run dev
```

The available validation commands are:

```sh
bun run typecheck
bun run lint
bun run build
```

Study Reviewer keeps personal study data in the browser where it is created.
JSON backup and restore provide a portable way to preserve local study
materials and preferences as the library grows.

## Pomodoro web audio note

The web app can initialize browser audio and notifications through the Pomodoro
setup dialog, then automatically play the selected alarm or background ambience
when the corresponding preferences are enabled. Browser autoplay policies can
still block audible playback, in which case the app keeps the saved preferences
and offers an Enable sound action. Manual ambience playback through the floating
music control and the ambience preview in Settings remain available.
