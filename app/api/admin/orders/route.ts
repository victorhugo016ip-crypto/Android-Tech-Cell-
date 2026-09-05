import {NextResponse} from "next/server";import {db,requireAdmin} from "@/lib";
export async function GET(){try{await requireAdmin();const orders=await db.order.findMany({include:{user:{select:{name:true,email:true}},service:true},orderBy:{createdAt:"desc"},take:100});return NextResponse.json({orders})}catch{return NextResponse.json({error:"Acesso negado"},{status:403})}}
