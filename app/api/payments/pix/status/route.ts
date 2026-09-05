import { NextResponse } from "next/server";
import { db, requireUser } from "@/lib";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Pagamento não informado." }, { status: 400 });
    const payment = await db.payment.findFirst({ where: { id, userId: user.id } });
    if (!payment) return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    return NextResponse.json({ status: payment.status, credits: payment.credits, paidAt: payment.paidAt });
  } catch { return NextResponse.json({ error: "Não autorizado." }, { status: 401 }); }
}
