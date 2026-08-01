/**
 * Draws the shareable "day won" card.
 *
 * Everything happens on the client, in a canvas — the tasks on this image are
 * the private contents of someone's day, and they should not travel to a server
 * to be turned into a picture. What gets shared is a file the browser made and
 * the person saw first.
 *
 * 1080×1350 is the 4:5 that Instagram, WhatsApp and X all display without
 * cropping; a square wastes vertical space and a story is too tall for a feed.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

export type CardInput = {
  /** Titles of what got done, already filtered for privacy by the caller. */
  done: string[];
  /** Total finished, which may exceed `done.length` once the list is trimmed. */
  doneCount: number;
  /** "Thursday, 30 July" — passed in so nothing here reads the clock. */
  dateLabel: string;
  name: string;
  /** Google profile picture, drawn beside the name when it loads. */
  picture?: string | null;
};

/**
 * The avatar for the canvas, or null. crossOrigin is the load-bearing part:
 * without it a Google photo taints the canvas and toBlob throws at the end,
 * which would cost the whole card rather than just the picture.
 */
function loadAvatar(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    setTimeout(() => resolve(null), 4000);
    img.src = url;
  });
}

/** The generated family names next/font puts on the document. */
function families(): { display: string; body: string } {
  const root = getComputedStyle(document.documentElement);
  const display = root.getPropertyValue("--font-display-serif").trim();
  const body = root.getPropertyValue("--font-body").trim();
  return {
    display: display || "Georgia, serif",
    body: body || "system-ui, sans-serif",
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** The Kairo mark: three rounded bars, the same geometry as the app icon. */
function drawMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  color: string
) {
  const h = size;
  const w = (size * 54) / 288;
  ctx.save();
  ctx.fillStyle = color;
  for (const deg of [0, 60, 120]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, w / 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Trims to fit, with an ellipsis, so a long task can't run off the card. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(out + "…").width > max) out = out.slice(0, -1);
  return out.trimEnd() + "…";
}

export async function drawShareCard(input: CardInput): Promise<HTMLCanvasElement> {
  // the fonts have to be resident before anything is measured, or the first
  // draw silently falls back and the layout is wrong
  await document.fonts.ready;

  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");

  const { display, body } = families();

  /* ---------------------------------------------------------- background */
  ctx.fillStyle = "#f4f7f6";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // two soft blooms, the same warm/cool pair the app's mesh background uses
  const warm = ctx.createRadialGradient(180, 170, 0, 180, 170, 900);
  warm.addColorStop(0, "rgba(240,169,90,0.30)");
  warm.addColorStop(1, "rgba(240,169,90,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const cool = ctx.createRadialGradient(980, 1180, 0, 980, 1180, 950);
  cool.addColorStop(0, "rgba(109,169,214,0.26)");
  cool.addColorStop(1, "rgba(109,169,214,0)");
  ctx.fillStyle = cool;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  /* -------------------------------------------------------------- header */
  ctx.textBaseline = "alphabetic";
  // the drawn mark, not the ✱ glyph — the same three bars as the app icon
  drawMark(ctx, 106, 112, 42, "#0c9384");
  ctx.fillStyle = "#1c2320";
  ctx.font = `700 38px ${body}`;
  ctx.fillText("kairo", 138, 126);

  /* --------------------------------------------------------------- title */
  ctx.fillStyle = "#1c2320";
  ctx.font = `600 128px ${display}`;
  ctx.fillText("Day won.", 84, 296);

  // clear of the descender on "Day won." — at 128px the y drops a long way
  ctx.fillStyle = "#5c6b64";
  ctx.font = `400 34px ${body}`;
  ctx.fillText(input.dateLabel, 88, 382);

  /* ----------------------------------------------------------- task card */
  const cardX = 84;
  const cardY = 444;
  const cardW = CARD_W - 168;
  const rowH = 84;
  const shown = input.done.slice(0, 6);
  const extra = input.doneCount - shown.length;
  const cardH = 56 + shown.length * rowH + (extra > 0 ? 62 : 0) + 24;

  ctx.save();
  ctx.shadowColor = "rgba(28,35,32,0.10)";
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, cardX, cardY, cardW, cardH, 44);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = "#8a9992";
  ctx.font = `700 22px ${body}`;
  ctx.fillText(`DONE TODAY · ${input.doneCount}`, cardX + 48, cardY + 62);

  shown.forEach((title, i) => {
    const y = cardY + 96 + i * rowH;

    // tick
    ctx.fillStyle = "#3f9a6a";
    ctx.beginPath();
    ctx.arc(cardX + 62, y + 12, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cardX + 53, y + 12);
    ctx.lineTo(cardX + 60, y + 19);
    ctx.lineTo(cardX + 72, y + 5);
    ctx.stroke();

    ctx.fillStyle = "#2b3833";
    ctx.font = `500 34px ${body}`;
    ctx.fillText(fit(ctx, title, cardW - 150), cardX + 100, y + 24);
  });

  if (extra > 0) {
    ctx.fillStyle = "#8a9992";
    ctx.font = `400 30px ${body}`;
    ctx.fillText(
      `+ ${extra} more`,
      cardX + 100,
      cardY + 96 + shown.length * rowH + 30
    );
  }

  /* -------------------------------------------------------------- footer */
  const footY = cardY + cardH + 96;

  // the face next to the claim: the photo when it loads, an initial otherwise
  const R = 42;
  const ax = 88 + R;
  const ay = footY + 4;
  const avatar = input.picture ? await loadAvatar(input.picture) : null;
  ctx.save();
  ctx.shadowColor = "rgba(28,35,32,0.14)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(ax, ay, R + 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (avatar) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, ax - R, ay - R, R * 2, R * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = "#0c9384";
    ctx.beginPath();
    ctx.arc(ax, ay, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 42px ${display}`;
    ctx.textAlign = "center";
    ctx.fillText((input.name.trim()[0] || "K").toUpperCase(), ax, ay + 15);
    ctx.textAlign = "left";
  }

  const textX = ax + R + 28;
  ctx.fillStyle = "#1c2320";
  ctx.font = `600 40px ${display}`;
  ctx.fillText(fit(ctx, `${input.name} finished the day.`, CARD_W - textX - 60), textX, footY);

  ctx.fillStyle = "#5c6b64";
  ctx.font = `400 30px ${body}`;
  ctx.fillText("Your turn.", textX, footY + 50);

  ctx.fillStyle = "#8a9992";
  ctx.font = `500 28px ${body}`;
  ctx.fillText("kairo.jaimansoni.com", 88, CARD_H - 80);

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not make the image"))), "image/png")
  );
}
