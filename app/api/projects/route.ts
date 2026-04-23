import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function GET() {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const g = await requireAdmin();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const body = await req.json();
  if (!body.client_id || !body.title) return NextResponse.json({ error: "client_id, title 필수" }, { status: 400 });
  const { data, error } = await supabase.from("projects").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
