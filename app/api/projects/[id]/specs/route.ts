import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { data, error } = await supabase
    .from("switch_specs")
    .select("*")
    .eq("project_id", params.id)
    .order("item_type")
    .order("space");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const body = await req.json();
  const { data, error } = await supabase
    .from("switch_specs")
    .insert({ ...body, project_id: params.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
