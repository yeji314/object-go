import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const body = await req.json();
  const { data, error } = await supabase.from("schedules").update(body).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { error } = await supabase.from("schedules").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
