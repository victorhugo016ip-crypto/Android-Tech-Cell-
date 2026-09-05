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
    const { credits, couponCode } = await req.json();

    const pack = PACKS.find((p) => p.credits === Number(credits));
    if (!pack) {
      return NextResponse.json({ error: "Pacote inválido." }, { status: 400 });
    }

    let coupon: any = null;
    let finalAmountCents = pack.amountCents;

    const code = String(couponCode || "").trim().toUpperCase();

    if (code) {
      coupon = await db.coupon.findUnique({ where: { code } });

      if (!coupon || !coupon.active) {
        return NextResponse.json({ error: "Cupom inválido ou inativo." }, { status: 400 });
      }

      if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= Date.now()) {
        return NextResponse.json({ error: "Este cupom está expirado." }, { status: 400 });
      }

      if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
        return NextResponse.json({ error: "Este cupom atingiu o limite de usos." }, { status: 400 });
      }

      if (coupon.type === "PERCENT") {
        finalAmountCents = Math.round(pack.amountCents * (100 - coupon.value) / 100);
      } else {
        finalAmountCents = pack.amountCents - coupon.value;
      }

      finalAmountCents = Math.max(100, finalAmountCents);
    }

    const payment = await db.payment.create({
      data: {
        userId: user.id,
        provider: "MERCADOPAGO",
        amountCents: finalAmountCents,
        credits: pack.credits,
        couponId: coupon?.id || null,
      },
    });

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const appUrl = process.env.APP_URL?.replace(/\/$/, "");

    if (!accessToken || !appUrl) {
      await db.payment.delete({ where: { id: payment.id } });
      return NextResponse.json(
        { error: "Mercado Pago ainda não configurado no servidor." },
        { status: 503 }
      );
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
        transaction_amount: finalAmountCents / 100,
        description: `Android Tech Cell - ${pack.credits} créditos${coupon ? ` - Cupom ${coupon.code}` : ""}`,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: payment.id,
        notification_url: `${appUrl}/api/payments/pix/webhook`,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.id) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: "CANCELLED" },
      });

      return NextResponse.json(
        { error: data?.message || "Mercado Pago recusou a criação do PIX." },
        { status: 502 }
      );
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
        couponId: updated.couponId,
        couponCode: coupon?.code || null,
        originalAmountCents: pack.amountCents,
        discountCents: pack.amountCents - finalAmountCents,
        copyPaste: updated.copyPaste,
        qrCodeBase64: tx?.qr_code_base64 || null,
        status: updated.status,
      },
      mode: "MERCADOPAGO",
    });
  } catch {
    return NextResponse.json(
      { error: "Não foi possível criar o PIX." },
      { status: 400 }
    );
  }
}
