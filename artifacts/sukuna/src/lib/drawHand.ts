import type { HandData } from "@/hooks/useGestureRecognizer";

const CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
];

export function drawHandSkeleton(
  ctx: CanvasRenderingContext2D,
  hand: HandData,
  width: number,
  height: number
) {
  const lm = hand.landmarks;
  ctx.save();
  ctx.strokeStyle = "rgba(220, 38, 38, 0.85)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(220, 38, 38, 0.6)";
  ctx.shadowBlur = 6;

  for (const [a, b] of CONNECTIONS) {
    if (!lm[a] || !lm[b]) continue;
    ctx.beginPath();
    ctx.moveTo((1 - lm[a].x) * width, lm[a].y * height);
    ctx.lineTo((1 - lm[b].x) * width, lm[b].y * height);
    ctx.stroke();
  }

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.shadowColor = "rgba(220, 38, 38, 0.8)";
  ctx.shadowBlur = 8;

  const tipIndices = [4, 8, 12, 16, 20];

  for (let i = 0; i < lm.length; i++) {
    const pt = lm[i];
    const isTip = tipIndices.includes(i);
    ctx.beginPath();
    ctx.arc((1 - pt.x) * width, pt.y * height, isTip ? 5 : 3, 0, Math.PI * 2);
    ctx.fillStyle = isTip ? "rgba(220, 38, 38, 1)" : "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  ctx.restore();
}
