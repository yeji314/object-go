import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireAdmin } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { data, error } = await supabase
    .from("cost_items")
    .select("*")
    .eq("project_id", params.id)
    .order("category")
    .order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const grouped: Record<string, typeof data> = {};
  for (const row of data ?? []) {
    grouped[row.category] ||= [];
    grouped[row.category].push(row);
  }
  return NextResponse.json({ data, grouped });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const body = await req.json();
  const { data, error } = await supabase
    .from("cost_items")
    .insert({ ...body, project_id: params.id })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
