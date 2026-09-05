import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib";

function validSignature(req: Request, dataId: string) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  const signature = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = Object.fromEntries(signature.split(",").map((x) => {
    const i = x.indexOf("=");
    return i > 0 ? [x.slice(0, i), x.slice(i + 1)] : [x, ""];
  }));
  if (!parts.ts || !parts.v1) return false;
  const manifest = `id:${dataId};request-id:${requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(parts.v1), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function processPayment(mpId: string) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente");
  const r = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(mpId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error("Falha ao consultar pagamento");
  const mp = await r.json();
  const payment = await db.payment.findFirst({ where: { externalId: String(mp.id) } });
  if (!payment) return;

  const status = mp.status === "approved" ? "PAID" : mp.status === "cancelled" || mp.status === "rejected" ? "CANCELLED" : "PENDING";
  if (status !== "PAID") {
    await db.payment.update({ where: { id: payment.id }, data: { status } });
    return;
  }

  await db.$transaction(async (tx) => {
    const fresh = await tx.payment.findUnique({ where: { id: payment.id } });
    if (!fresh || fresh.status === "PAID") return;
    await tx.payment.update({ where: { id: fresh.id }, data: { status: "PAID", paidAt: new Date() } });
    await tx.user.update({ where: { id: fresh.userId }, data: { credits: { increment: fresh.credits } } });
    await tx.creditTransaction.create({ data: { userId: fresh.userId, type: "PURCHASE", amount: fresh.credits, note: `PIX Mercado Pago ${fresh.id}` } });
  });
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const mpId = String(body?.data?.id || url.searchParams.get("data.id") || body?.id || "");
    const type = String(body?.type || url.searchParams.get("type") || "");
    if (!mpId || type !== "payment") return NextResponse.json({ ok: true });
    if (!validSignature(req, mpId)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    await processPayment(mpId);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "webhook error" }, { status: 500 });
  }
}
