import {NextResponse} from "next/server";
import {db,requireAdmin} from "@/lib";

export async function GET(){
  try{
    await requireAdmin();
    const payments=await db.payment.findMany({
      include:{user:{select:{name:true,email:true}}},
      orderBy:{createdAt:"desc"},
      take:100
    });
    return NextResponse.json({payments});
  }catch{
    return NextResponse.json({error:"Acesso negado"},{status:403});
  }
}
