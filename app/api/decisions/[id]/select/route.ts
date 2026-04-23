import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;
  const { selected_option, client_memo } = await req.json();
  const patch: Record<string, unknown> = {};
  if (selected_option !== undefined) {
    patch.selected_option = selected_option;
    patch.status = "decided";
  }
  if (client_memo !== undefined) patch.client_memo = client_memo;
  const { data, error } = await supabase.from("decisions").update(patch).eq("id", params.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
