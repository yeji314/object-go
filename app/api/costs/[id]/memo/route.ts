import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { memo } = await req.json();
  const { data, error } = await supabase.from("cost_items").update({ memo }).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
