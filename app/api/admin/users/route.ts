import {NextResponse} from "next/server";import {db,requireAdmin} from "@/lib";
export async function GET(){try{await requireAdmin();const users=await db.user.findMany({select:{id:true,name:true,email:true,role:true,credits:true,createdAt:true},orderBy:{createdAt:"desc"},take:100});return NextResponse.json({users})}catch{return NextResponse.json({error:"Acesso negado"},{status:403})}}
