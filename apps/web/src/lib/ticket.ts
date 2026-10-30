import QRCode from "qrcode";

export interface TicketData {
  event: string;
  date: string;
  time: string;
  place: string;
  name: string;
  team: string;
  role: string;
  code: string;
  url: string;
}

export const ticketCode = (userId: string) => `HK-${userId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

export const qrDataUrl = (text: string, size = 220) =>
  QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: "#0c0b2b", light: "#ffffff" } });

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Desenha o ticket em PNG 1080×1350 (formato bom para feed e stories) para baixar ou compartilhar. */
export async function renderTicketPng(d: TicketData): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('800 56px "Plus Jakarta Sans"'), document.fonts.load('500 24px "JetBrains Mono"'), document.fonts.load('500 28px "Inter"')]);
  } catch { /* usa fontes de reserva */ }

  const W = 1080, H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0d0d12"); bg.addColorStop(1, "#231d5c");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.5;
  const glow = ctx.createRadialGradient(W * 0.8, 120, 10, W * 0.8, 120, 520);
  glow.addColorStop(0, "#34e0a1"); glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  // cartão
  const x = 90, y = 130, w = 900, h = 1060;
  ctx.save(); ctx.shadowColor = "rgba(0,0,0,.45)"; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
  roundRect(ctx, x, y, w, h, 44); ctx.fillStyle = "#f6f7fc"; ctx.fill(); ctx.restore();
  ctx.save(); roundRect(ctx, x, y, w, h, 44); ctx.clip();
  const head = ctx.createLinearGradient(x, y, x + w, y + 380);
  head.addColorStop(0, "#6c84f5"); head.addColorStop(1, "#8b6cf7");
  ctx.fillStyle = head; ctx.fillRect(x, y, w, 380);
  ctx.restore();

  ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.font = '500 24px "JetBrains Mono", monospace'; ctx.fillText("E-TICKET · HACKATHON", x + 56, y + 80);
  ctx.fillStyle = "#fff"; ctx.font = '800 58px "Plus Jakarta Sans", Inter, sans-serif';
  wrap(ctx, d.event, w - 112).slice(0, 3).forEach((l, i) => ctx.fillText(l, x + 56, y + 168 + i * 68));

  const field = (label: string, value: string, fx: number, fy: number, maxW = 380) => {
    ctx.fillStyle = "#6b7090"; ctx.font = '500 22px "JetBrains Mono", monospace'; ctx.fillText(label.toUpperCase(), fx, fy);
    ctx.fillStyle = "#0c0b2b"; ctx.font = '700 34px "Plus Jakarta Sans", Inter, sans-serif';
    wrap(ctx, value, maxW).slice(0, 2).forEach((l, i) => ctx.fillText(l, fx, fy + 44 + i * 40));
  };
  field("Participante", d.name, x + 56, y + 470);
  field("Equipe", d.team || "—", x + 484, y + 470);
  field("Data", d.date, x + 56, y + 620);
  field("Horário", d.time, x + 484, y + 620);
  field("Local", d.place, x + 56, y + 770, 780);
  field("Perfil", d.role, x + 484, y + 770);

  // picote
  const cy = y + 850;
  ctx.fillStyle = "#0d0d12"; ctx.beginPath(); ctx.arc(x, cy, 28, 0, Math.PI * 2); ctx.arc(x + w, cy, 28, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#c9cce0"; ctx.setLineDash([12, 10]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 50, cy); ctx.lineTo(x + w - 50, cy); ctx.stroke(); ctx.setLineDash([]);

  const qr = new Image();
  qr.src = await qrDataUrl(`${d.url}?ticket=${d.code}`, 360);
  await new Promise((r) => { qr.onload = r; qr.onerror = r; });
  ctx.drawImage(qr, x + 56, cy + 36, 150, 150);
  ctx.fillStyle = "#6b7090"; ctx.font = '500 22px "JetBrains Mono", monospace'; ctx.fillText("CÓDIGO", x + 240, cy + 90);
  ctx.fillStyle = "#0c0b2b"; ctx.font = '700 44px "JetBrains Mono", monospace'; ctx.fillText(d.code, x + 240, cy + 144);

  ctx.fillStyle = "#fff"; ctx.font = '700 38px "Plus Jakarta Sans", Inter, sans-serif'; ctx.fillText("Estou dentro! ", 90, 1262);
  const short = d.event.length > 30 ? `${d.event.slice(0, 29)}…` : d.event;
  ctx.fillStyle = "#34e0a1"; ctx.fillText(short, 90 + ctx.measureText("Estou dentro! ").width, 1262);
  ctx.fillStyle = "rgba(255,255,255,.55)"; ctx.font = '500 24px "JetBrains Mono", monospace'; ctx.fillText("venn · plataforma de hackathons", 90, 1306);

  return await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("png"))), "image/png"));
}
