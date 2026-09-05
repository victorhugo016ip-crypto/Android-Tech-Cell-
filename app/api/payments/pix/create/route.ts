import { NextResponse } from "next/server";
import { db, requireUser } from "@/lib";
import crypto from "node:crypto";

const PACKS = [
  { credits: 50, amountCents: 2500 },
  { credits: 100, amountCents: 4500 },
  { credits: 250, amountCents: 10000 },
  { credits: 500, amountCents: 18000 },
];

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { credits } = await req.json();
    const pack = PACKS.find((p) => p.credits === Number(credits));
    if (!pack) return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });

    const payment = await db.payment.create({
      data: {
        userId: user.id,
        provider: "MERCADOPAGO",
        amountCents: pack.amountCents,
        credits: pack.credits,
      },
    });

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");
    if (!accessToken || !appUrl) {
      await db.payment.delete({ where: { id: payment.id } });
      return NextResponse.json({ error: "Mercado Pago ainda não configurado no servidor." }, { status: 503 });
    }

    const idem = crypto.randomUUID();
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idem,
      },
      body: JSON.stringify({
        transaction_amount: pack.amountCents / 100,
        description: `Android Tech Cell - ${pack.credits} créditos`,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: payment.id,
        notification_url: `${appUrl}/api/payments/pix/webhook`,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.id) {
      await db.payment.update({ where: { id: payment.id }, data: { status: "CANCELLED" } });
      return NextResponse.json({ error: data?.message || "Mercado Pago recusou a criação do PIX." }, { status: 502 });
    }

    const tx = data.point_of_interaction?.transaction_data;
    const updated = await db.payment.update({
      where: { id: payment.id },
      data: {
        externalId: String(data.id),
        txid: String(data.id),
        copyPaste: tx?.qr_code || null,
      },
    });

    return NextResponse.json({
      payment: {
        id: updated.id,
        externalId: updated.externalId,
        amountCents: updated.amountCents,
        credits: updated.credits,
        copyPaste: updated.copyPaste,
        qrCodeBase64: tx?.qr_code_base64 || null,
        status: updated.status,
      },
      mode: "MERCADOPAGO",
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível criar o PIX." }, { status: 400 });
  }
}
