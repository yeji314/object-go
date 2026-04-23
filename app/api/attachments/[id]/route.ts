import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase } = g;

  const { data: att } = await supabase.from("attachments").select("*").eq("id", params.id).maybeSingle();
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await supabase.storage.from("attachments").remove([att.storage_path]);
  const { error } = await supabase.from("attachments").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
