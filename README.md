# Sukuna Gesture Control v1.4

Control your browser and media with hand gestures using your webcam.

## Gestures

| Gesture | Action |
|---------|--------|
| 👌/🤏 + Move Up/Down | Volume Up / Down |
| ✌️🤘🤟 Victory/Rock | Play / Pause |
| ☝️ Pointing Up | Virtual Cursor Mode (pinch = click) |
| 🖐️ Open Palm + Move | Navigation (Up/Down/Left/Right) |
| ✊ Closed Fist (hold 0.4s) | Select / Enter |
| 👍/👎 Thumbs | Back / Escape |
| 🙏 Prayer (both hands) | Open YouTube |

## Tech Stack

- React + Vite + TypeScript
- MediaPipe Tasks Vision (Gesture Recognizer)
- Tailwind CSS

## Setup

```bash
pnpm install
pnpm --filter @workspace/sukuna run dev
```

MediaPipe models are loaded from Google CDN automatically.
