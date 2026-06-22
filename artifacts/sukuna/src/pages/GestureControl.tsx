import { useEffect, useRef, useState, useCallback } from "react";
import { useGestureRecognizer, isPinch, isOKPose, isPrayer, type HandData, type GestureResult } from "@/hooks/useGestureRecognizer";
import { drawHandSkeleton } from "@/lib/drawHand";
import { createAction, simulateKey, openYouTube, getGestureEmoji, type ActionLog } from "@/lib/gestureActions";

type AppMode = "idle" | "cursor" | "navigation" | "volume";

const GESTURE_COOLDOWN = 800;
const FIST_HOLD_MS = 400;
const VOLUME_COOLDOWN = 300;
const NAV_COOLDOWN = 500;

const GUIDE = [
  { emoji: "👌🤏", gesture: "OK/Pinch + Move Hand", action: "Volume Up ↑ / Volume Down ↓" },
  { emoji: "✌️🤘🤟", gesture: "Victory / Rock / ILoveYou", action: "Play / Pause (Spacebar)" },
  { emoji: "☝️", gesture: "Pointing Up", action: "Virtual Cursor Mode (pinch = click)" },
  { emoji: "🖐️", gesture: "Open Palm + Move", action: "Navigation: Up / Down / Left / Right" },
  { emoji: "✊", gesture: "Closed Fist (hold 400ms)", action: "Select / Enter" },
  { emoji: "👍👎", gesture: "Thumbs Up / Down", action: "Back / Previous (Escape)" },
  { emoji: "🙏", gesture: "Prayer (both hands)", action: "Open YouTube" },
];

export default function GestureControl() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [mode, setMode] = useState<AppMode>("idle");
  const [currentGesture, setCurrentGesture] = useState("None");
  const [volume, setVolume] = useState(50);
  const [actionLog, setActionLog] = useState<ActionLog[]>([]);
  const [cursorPos, setCursorPos] = useState({ x: 0.5, y: 0.5 });
  const [isPinching, setIsPinching] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  const [navDirection, setNavDirection] = useState<string | null>(null);

  const lastActionTime = useRef<Record<string, number>>({});
  const fistStartTime = useRef<number | null>(null);
  const fistFiredRef = useRef(false);
  const prevWristRef = useRef<{ x: number; y: number } | null>(null);
  const okStartWristRef = useRef<{ x: number; y: number } | null>(null);
  const navCooldownRef = useRef<number>(0);
  const navDirectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { init, startDetection, stopDetection, isReady, isLoading, error } = useGestureRecognizer(videoRef);

  const addAction = useCallback((text: string, emoji: string) => {
    const action = createAction(text, emoji);
    setActionLog(prev => [action, ...prev].slice(0, 6));
  }, []);

  const canFire = useCallback((key: string, cooldown = GESTURE_COOLDOWN): boolean => {
    const now = Date.now();
    if (now - (lastActionTime.current[key] ?? 0) < cooldown) return false;
    lastActionTime.current[key] = now;
    return true;
  }, []);

  const processGesture = useCallback((result: GestureResult) => {
    const { hands } = result;
    if (!hands.length) {
      setCurrentGesture("None");
      fistStartTime.current = null;
      fistFiredRef.current = false;
      okStartWristRef.current = null;
      setMode(prev => (prev === "cursor" ? "cursor" : "idle"));
      return;
    }

    const primary = hands[0];
    const gesture = primary.gesture;
    setCurrentGesture(gesture);

    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      for (const hand of hands) {
        drawHandSkeleton(ctx, hand, canvasRef.current.width, canvasRef.current.height);
      }
    }

    // 🙏 Prayer → Open YouTube
    if (isPrayer(hands)) {
      if (canFire("prayer")) {
        openYouTube();
        addAction("Opening YouTube", "🙏");
      }
      return;
    }

    // ☝️ Pointing Up → Cursor mode
    if (gesture === "Pointing_Up") {
      setMode("cursor");
      const x = 1 - primary.indexTipX;
      const y = primary.indexTipY;
      setCursorPos({ x, y });

      const pinching = isPinch(primary);
      if (pinching && !isPinching) {
        if (canFire("pinch_click", 400)) {
          addAction("Click (pinch)", "🤌");
          const screenX = x * window.innerWidth;
          const screenY = y * window.innerHeight;
          const el = document.elementFromPoint(screenX, screenY);
          if (el) {
            (el as HTMLElement).click();
          }
        }
      }
      setIsPinching(pinching);

      // 🤞 J key: Skip backward / 🫰 L key: Skip forward via pinch direction
      const curWrist = { x: primary.wristX, y: primary.wristY };
      if (prevWristRef.current) {
        const dx = curWrist.x - prevWristRef.current.x;
        if (Math.abs(dx) > 0.05 && canFire("cursor_skip", 800)) {
          if (dx > 0) {
            simulateKey("j", "KeyJ");
            addAction("Skip backward 10s", "⏪");
          } else {
            simulateKey("l", "KeyL");
            addAction("Skip forward 10s", "⏩");
          }
        }
      }
      prevWristRef.current = curWrist;
      return;
    }

    // ✌️ 🤘 🤟 Victory / Rock / ILoveYou → Play/Pause
    if (gesture === "Victory" || gesture === "ILoveYou") {
      if (canFire("playpause")) {
        simulateKey("k", "KeyK");
        addAction("Play / Pause", "▶️");
      }
      setMode("idle");
      return;
    }

    // 👍 👎 Thumbs → Back
    if (gesture === "Thumb_Up" || gesture === "Thumb_Down") {
      if (canFire("back")) {
        simulateKey("Escape", "Escape");
        addAction("Back / Previous", gesture === "Thumb_Up" ? "👍" : "👎");
      }
      setMode("idle");
      return;
    }

    // ✊ Closed fist → Select (held)
    if (gesture === "Closed_Fist") {
      if (fistStartTime.current === null) {
        fistStartTime.current = Date.now();
        fistFiredRef.current = false;
      } else if (!fistFiredRef.current && Date.now() - fistStartTime.current > FIST_HOLD_MS) {
        fistFiredRef.current = true;
        simulateKey("Enter", "Enter");
        addAction("Select / Enter", "✊");
      }
      setMode("idle");
      return;
    } else {
      fistStartTime.current = null;
      fistFiredRef.current = false;
    }

    // 🖐️ Open palm → Navigation
    if (gesture === "Open_Palm") {
      setMode("navigation");
      const curWrist = { x: primary.wristX, y: primary.wristY };

      if (prevWristRef.current && Date.now() > navCooldownRef.current) {
        const dx = curWrist.x - prevWristRef.current.x;
        const dy = curWrist.y - prevWristRef.current.y;
        const threshold = 0.04;

        let dir: string | null = null;
        let key: string = "";
        let code: string = "";

        if (Math.abs(dy) > Math.abs(dx)) {
          if (dy > threshold) { dir = "Down"; key = "ArrowDown"; code = "ArrowDown"; }
          else if (dy < -threshold) { dir = "Up"; key = "ArrowUp"; code = "ArrowUp"; }
        } else {
          // Note: video is mirrored, so left/right are swapped
          if (dx > threshold) { dir = "Left"; key = "ArrowLeft"; code = "ArrowLeft"; }
          else if (dx < -threshold) { dir = "Right"; key = "ArrowRight"; code = "ArrowRight"; }
        }

        if (dir && canFire(`nav_${dir}`, NAV_COOLDOWN)) {
          simulateKey(key, code);
          addAction(`Navigate ${dir}`, dir === "Up" ? "⬆️" : dir === "Down" ? "⬇️" : dir === "Left" ? "⬅️" : "➡️");
          setNavDirection(dir);
          navCooldownRef.current = Date.now() + NAV_COOLDOWN;
          if (navDirectionTimeoutRef.current) clearTimeout(navDirectionTimeoutRef.current);
          navDirectionTimeoutRef.current = setTimeout(() => setNavDirection(null), 600);
        }
      }
      prevWristRef.current = curWrist;
      return;
    }

    // 👌 OK / pinch pose → Volume control via hand movement
    if (isOKPose(primary)) {
      setMode("volume");
      const curWrist = { x: primary.wristX, y: primary.wristY };

      if (okStartWristRef.current === null) {
        okStartWristRef.current = curWrist;
      } else {
        const dy = curWrist.y - okStartWristRef.current.y;
        if (Math.abs(dy) > 0.03 && canFire("volume", VOLUME_COOLDOWN)) {
          if (dy < 0) {
            setVolume(v => Math.min(100, v + 5));
            simulateKey("ArrowUp", "ArrowUp");
            addAction("Volume Up", "🔊");
          } else {
            setVolume(v => Math.max(0, v - 5));
            simulateKey("ArrowDown", "ArrowDown");
            addAction("Volume Down", "🔉");
          }
          okStartWristRef.current = curWrist;
        }
      }
      return;
    } else {
      okStartWristRef.current = null;
    }

    setMode("idle");
    prevWristRef.current = { x: primary.wristX, y: primary.wristY };
  }, [addAction, canFire, isPinching]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        await init();
      }
    } catch (e) {
      console.error("Camera error", e);
    }
  }, [init]);

  useEffect(() => {
    if (isReady && cameraActive) {
      startDetection(processGesture);
    }
    return () => stopDetection();
  }, [isReady, cameraActive, startDetection, stopDetection, processGesture]);

  useEffect(() => {
    return () => {
      if (navDirectionTimeoutRef.current) clearTimeout(navDirectionTimeoutRef.current);
    };
  }, []);

  const modeColors: Record<AppMode, string> = {
    idle: "bg-gray-800 text-gray-300",
    cursor: "bg-blue-900 text-blue-200",
    navigation: "bg-purple-900 text-purple-200",
    volume: "bg-red-900 text-red-200",
  };

  const modeLabel: Record<AppMode, string> = {
    idle: "Idle",
    cursor: "Cursor Mode",
    navigation: "Navigation Mode",
    volume: "Volume Mode",
  };

  return (
    <div className="min-h-screen bg-background sukuna-bg flex flex-col">
      {/* Header */}
      <header className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-2xl font-black tracking-tight text-primary" style={{ fontFamily: "Georgia, serif", letterSpacing: "0.05em" }}>
            SUKUNA
          </div>
          <div className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Gesture Control v1.4</div>
        </div>
        <button
          onClick={() => setShowGuide(g => !g)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border/40 px-3 py-1 rounded-md transition-colors"
        >
          {showGuide ? "Hide" : "Show"} Guide
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Camera & Canvas */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
          <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-2xl"
            style={{ width: 640, height: 480, maxWidth: "100%", aspectRatio: "4/3" }}>

            {!cameraActive ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-card gap-4">
                <div className="text-6xl mb-2">🖐️</div>
                <p className="text-foreground font-semibold text-lg">Sukuna Gesture Control</p>
                <p className="text-muted-foreground text-sm text-center max-w-xs">
                  Control your device with hand gestures using your camera
                </p>
                <button
                  onClick={startCamera}
                  disabled={isLoading}
                  className="mt-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 active-gesture transition-all disabled:opacity-50"
                >
                  {isLoading ? "Loading MediaPipe…" : "Enable Camera"}
                </button>
                {error && (
                  <p className="text-destructive text-sm mt-2 max-w-xs text-center">{error}</p>
                )}
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  style={{ transform: "scaleX(-1)" }}
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={480}
                  className="hand-skeleton-canvas w-full h-full"
                />
                {/* Mode badge */}
                <div className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${modeColors[mode]}`}>
                  {modeLabel[mode]}
                </div>
                {/* Gesture display */}
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full">
                  <span className="text-lg">{getGestureEmoji(currentGesture)}</span>
                  <span className="text-xs text-white/80 font-mono">{currentGesture.replace("_", " ")}</span>
                </div>
                {/* Navigation arrows overlay */}
                {mode === "navigation" && (
                  <div className="absolute bottom-4 right-4 grid grid-cols-3 gap-1 w-24">
                    {["Up", "Down", "Left", "Right"].map(dir => (
                      <div
                        key={dir}
                        className={`flex items-center justify-center rounded text-xs font-bold h-7 transition-all
                          ${dir === "Up" ? "col-start-2" : dir === "Down" ? "col-start-2" : dir === "Left" ? "col-start-1" : "col-start-3"}
                          ${navDirection === dir ? "bg-primary text-white scale-110" : "bg-black/40 text-white/50"}`}
                        style={{ gridRow: dir === "Up" ? 1 : dir === "Down" ? 3 : 2 }}
                      >
                        {dir === "Up" ? "▲" : dir === "Down" ? "▼" : dir === "Left" ? "◀" : "▶"}
                      </div>
                    ))}
                  </div>
                )}
                {/* Volume bar */}
                {mode === "volume" && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1">
                    <span className="text-xs text-white/70">Volume</span>
                    <div className="w-40 h-2 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all rounded-full"
                        style={{ width: `${volume}%` }}
                      />
                    </div>
                    <span className="text-white font-bold text-sm">{volume}%</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Virtual cursor overlay (full-screen, pointer-events-none) */}
          {mode === "cursor" && cameraActive && (
            <div
              ref={cursorRef}
              className="fixed pointer-events-none z-50"
              style={{
                left: `${cursorPos.x * 100}vw`,
                top: `${cursorPos.y * 100}vh`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className={`relative flex items-center justify-center`}>
                <div className={`w-8 h-8 rounded-full border-2 border-primary cursor-dot ${isPinching ? "bg-primary/60" : "bg-primary/20"}`} />
                <div className="absolute inset-0 flex items-center justify-center text-lg select-none">☝️</div>
              </div>
            </div>
          )}

          {/* Action log */}
          <div className="w-full max-w-[640px]">
            <div className="text-xs text-muted-foreground uppercase tracking-widest mb-2">Recent Actions</div>
            <div className="flex flex-wrap gap-2 min-h-[36px]">
              {actionLog.length === 0 && (
                <span className="text-muted-foreground text-sm italic">No actions yet — enable camera and gesture!</span>
              )}
              {actionLog.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border border-border/40 gesture-appear
                    ${i === 0 ? "bg-primary/20 text-primary border-primary/40" : "bg-card text-muted-foreground"}`}
                >
                  <span>{a.emoji}</span>
                  <span>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Guide panel */}
        {showGuide && (
          <aside className="w-80 border-l border-border/40 p-5 flex flex-col gap-4 overflow-y-auto">
            <div className="text-sm font-semibold text-foreground uppercase tracking-widest">Gesture Guide</div>
            <div className="flex flex-col gap-2">
              {GUIDE.map((g, i) => (
                <div key={i} className="rounded-lg border border-border/40 bg-card p-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{g.emoji}</span>
                    <span className="text-xs text-muted-foreground font-mono">{g.gesture}</span>
                  </div>
                  <div className="text-sm text-foreground font-medium">{g.action}</div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-4 border-t border-border/40">
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground/70">Tips:</p>
                <p>• Keep your hand well-lit and in frame</p>
                <p>• Move your hand clearly and deliberately</p>
                <p>• Hold fist for 0.4s to trigger Select</p>
                <p>• For prayer 🙏, bring both palms together</p>
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
