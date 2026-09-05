import { NextResponse } from "next/server";
import { db, requireAdmin } from "@/lib";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const d = await req.json();
    const data: any = {};

    if (d.code !== undefined) data.code = String(d.code).trim().toUpperCase().slice(0, 50);
    if (d.type !== undefined) data.type = d.type === "PERCENT" ? "PERCENT" : "FIXED";
    if (d.value !== undefined) data.value = Math.max(1, Math.trunc(Number(d.value)));
    if (d.maxUses !== undefined) data.maxUses = d.maxUses === null || d.maxUses === "" ? null : Math.max(1, Math.trunc(Number(d.maxUses)));
    if (d.expiresAt !== undefined) data.expiresAt = d.expiresAt ? new Date(d.expiresAt) : null;
    if (d.active !== undefined) data.active = !!d.active;

    if (data.type === "PERCENT" && data.value > 100) {
      return NextResponse.json({ error: "Percentual inválido." }, { status: 400 });
    }

    const coupon = await db.coupon.update({ where: { id }, data });
    return NextResponse.json({ coupon });
  } catch {
    return NextResponse.json({ error: "Não foi possível atualizar o cupom." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await db.coupon.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Não foi possível excluir o cupom." }, { status: 400 });
  }
}
