# Ambient music

Клади сюда `cosmic-loop.mp3` (или любой mp3 на твой вкус, главное —
имя `cosmic-loop.mp3`). Vite автоматически копирует всё из
`src/renderer/public/` в bundle.

## Где взять

Хочешь Interstellar/Don't-Look-Up-style cosmic ambient? Варианты:

- **Suno.ai / Udio** — сгенерируй промптом «slow space ambient drone, no
  drums, 10 minutes, Interstellar style». Скачай как mp3.
- **freesound.org** — ищи `tag:ambient tag:space cc0`. CC0 = можно
  shipping в DMG без атрибуции.
- **Spitfire LABS** (бесплатно, royalty-free для personal use) — Hans
  Zimmer-style pads.
- Любой свой track, который ты владеешь.

После того как положил файл — просто `npm run dev`, ambient появится
в Dock'е (volume slider). По дефолту OFF — включи галочку чтобы заиграло.

## Если не хочешь ambient вообще

Не клади файл. `<audio>.onerror` тихо отключит, как будто его и нет.
