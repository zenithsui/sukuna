import { useEffect, useRef, useCallback, useState } from "react";
import {
  GestureRecognizer,
  HandLandmarker,
  FilesetResolver,
  type GestureRecognizerResult,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

export type GestureCategory =
  | "None"
  | "Closed_Fist"
  | "Open_Palm"
  | "Pointing_Up"
  | "Thumb_Down"
  | "Thumb_Up"
  | "Victory"
  | "ILoveYou";

export interface HandData {
  gesture: GestureCategory;
  score: number;
  handedness: "Left" | "Right";
  landmarks: Array<{ x: number; y: number; z: number }>;
  worldLandmarks: Array<{ x: number; y: number; z: number }>;
  wristX: number;
  wristY: number;
  indexTipX: number;
  indexTipY: number;
  thumbTipX: number;
  thumbTipY: number;
  pinchDistance: number;
}

export interface GestureResult {
  hands: HandData[];
  timestamp: number;
}

const BASE_URL = import.meta.env.BASE_URL || "/";

export function useGestureRecognizer(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const animFrameRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resultCallbackRef = useRef<((result: GestureResult) => void) | null>(null);

  const init = useCallback(async () => {
    if (gestureRecognizerRef.current || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
      );

      const localModel = `${BASE_URL}models/gesture_recognizer.task`;
      const cdnModel = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";
      // Try local model first (from APK), fall back to CDN
      let modelPath = cdnModel;
      try {
        const resp = await fetch(localModel, { method: "HEAD" });
        if (resp.ok) modelPath = localModel;
      } catch { /* use CDN */ }

      gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      setIsReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("MediaPipe init error:", err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const startDetection = useCallback((callback: (result: GestureResult) => void) => {
    resultCallbackRef.current = callback;

    const detect = () => {
      const video = videoRef.current;
      const recognizer = gestureRecognizerRef.current;
      if (!video || !recognizer || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      try {
        const result: GestureRecognizerResult = recognizer.recognizeForVideo(video, Date.now());
        const hands: HandData[] = [];

        for (let i = 0; i < (result.landmarks?.length ?? 0); i++) {
          const landmarks = result.landmarks[i];
          const worldLandmarks = result.worldLandmarks?.[i] ?? [];
          const gesture = result.gestures?.[i]?.[0];
          const handedness = result.handednesses?.[i]?.[0];

          if (!landmarks || landmarks.length < 21) continue;

          const wrist = landmarks[0];
          const thumbTip = landmarks[4];
          const indexTip = landmarks[8];

          const pinchDistance = Math.sqrt(
            Math.pow(thumbTip.x - indexTip.x, 2) +
            Math.pow(thumbTip.y - indexTip.y, 2)
          );

          hands.push({
            gesture: (gesture?.categoryName ?? "None") as GestureCategory,
            score: gesture?.score ?? 0,
            handedness: (handedness?.categoryName ?? "Right") as "Left" | "Right",
            landmarks: landmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
            worldLandmarks: worldLandmarks.map(lm => ({ x: lm.x, y: lm.y, z: lm.z })),
            wristX: wrist.x,
            wristY: wrist.y,
            indexTipX: indexTip.x,
            indexTipY: indexTip.y,
            thumbTipX: thumbTip.x,
            thumbTipY: thumbTip.y,
            pinchDistance,
          });
        }

        resultCallbackRef.current?.({ hands, timestamp: Date.now() });
      } catch (e) {
        // Silently continue on frame errors
      }

      animFrameRef.current = requestAnimationFrame(detect);
    };

    animFrameRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  const stopDetection = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current);
    resultCallbackRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      gestureRecognizerRef.current?.close();
    };
  }, []);

  return { init, startDetection, stopDetection, isReady, isLoading, error };
}

export function isPinch(hand: HandData): boolean {
  return hand.pinchDistance < 0.06;
}

export function isOKPose(hand: HandData): boolean {
  const lm = hand.landmarks;
  if (lm.length < 21) return false;
  const thumbTip = lm[4];
  const indexTip = lm[8];
  const pinchDist = Math.sqrt(
    Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2)
  );
  const middleTip = lm[12];
  const ringTip = lm[16];
  const pinkyTip = lm[20];
  const middleBase = lm[9];
  const ringBase = lm[13];
  const pinkyBase = lm[17];
  const middleExtended = middleTip.y < middleBase.y;
  const ringExtended = ringTip.y < ringBase.y;
  const pinkyExtended = pinkyTip.y < pinkyBase.y;
  return pinchDist < 0.08 && middleExtended && ringExtended && pinkyExtended;
}

export function isPrayer(hands: HandData[]): boolean {
  if (hands.length < 2) return false;
  const [h1, h2] = hands;
  const dist = Math.sqrt(
    Math.pow(h1.wristX - h2.wristX, 2) + Math.pow(h1.wristY - h2.wristY, 2)
  );
  return dist < 0.25 && h1.gesture === "Open_Palm" && h2.gesture === "Open_Palm";
}
