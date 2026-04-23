import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const searchParams = req.nextUrl.searchParams;
  const refType = searchParams.get("ref_type");
  const refId = searchParams.get("ref_id");
  let q = supabase.from("comments").select("*").eq("project_id", params.id).order("created_at", { ascending: true });
  if (refType) q = q.eq("ref_type", refType);
  if (refId) q = q.eq("ref_id", refId);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase, user } = g;
  const body = await req.json();
  if (!body.body) return NextResponse.json({ error: "body 필수" }, { status: 400 });
  const { data, error } = await supabase
    .from("comments")
    .insert({
      project_id: params.id,
      ref_type: body.ref_type ?? "general",
      ref_id: body.ref_id ?? null,
      author_id: user.id,
      body: body.body,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
