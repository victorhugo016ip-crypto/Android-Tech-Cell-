import {NextResponse} from "next/server";
import {db,requireAdmin} from "@/lib";

export async function GET(){
  try{
    await requireAdmin();
    const coupons=await db.coupon.findMany({orderBy:{createdAt:"desc"}});
    return NextResponse.json({coupons});
  }catch{
    return NextResponse.json({error:"Acesso negado"},{status:403});
  }
}

export async function POST(req:Request){
  try{
    await requireAdmin();
    const d=await req.json();
    const code=String(d.code||"").trim().toUpperCase().slice(0,50);
    const type=d.type==="PERCENT"?"PERCENT":"FIXED";
    const value=Math.max(0,Math.trunc(Number(d.value)));
    const maxUses=d.maxUses==null||d.maxUses===""?null:Math.max(1,Math.trunc(Number(d.maxUses)));
    const expiresAt=d.expiresAt?new Date(d.expiresAt):null;
    if(!code||!Number.isFinite(value)||value<=0)return NextResponse.json({error:"Dados inválidos"},{status:400});
    if(type==="PERCENT"&&value>100)return NextResponse.json({error:"Percentual inválido"},{status:400});
    const coupon=await db.coupon.create({data:{code,type,value,maxUses,expiresAt}});
    return NextResponse.json({coupon});
  }catch{
    return NextResponse.json({error:"Não foi possível criar o cupom"},{status:400});
  }
}
