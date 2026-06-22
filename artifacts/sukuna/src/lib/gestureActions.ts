export type ActionLog = { id: number; text: string; emoji: string; time: number };

let actionCounter = 0;

export function createAction(text: string, emoji: string): ActionLog {
  return { id: ++actionCounter, text, emoji, time: Date.now() };
}

export function simulateKey(key: string, code: string) {
  const el = document.activeElement ?? document.body;
  const downEvt = new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true });
  const upEvt = new KeyboardEvent("keyup", { key, code, bubbles: true, cancelable: true });
  el.dispatchEvent(downEvt);
  setTimeout(() => el.dispatchEvent(upEvt), 80);
}

export function simulateMediaKey(key: "play" | "pause" | "volume-up" | "volume-down" | "next-track" | "prev-track") {
  const keyMap: Record<string, string> = {
    "play": "MediaPlayPause",
    "pause": "MediaPlayPause",
    "volume-up": "AudioVolumeUp",
    "volume-down": "AudioVolumeDown",
    "next-track": "MediaTrackNext",
    "prev-track": "MediaTrackPrevious",
  };
  const code = keyMap[key];
  if (!code) return;
  document.body.dispatchEvent(new KeyboardEvent("keydown", { key: code, code, bubbles: true }));
}

export function openYouTube() {
  window.open("https://www.youtube.com", "_blank");
}

export function getGestureEmoji(gesture: string): string {
  const map: Record<string, string> = {
    Closed_Fist: "✊",
    Open_Palm: "🖐️",
    Pointing_Up: "☝️",
    Thumb_Down: "👎",
    Thumb_Up: "👍",
    Victory: "✌️",
    ILoveYou: "🤟",
    None: "—",
    OK: "👌",
    Prayer: "🙏",
  };
  return map[gesture] ?? "👋";
}
