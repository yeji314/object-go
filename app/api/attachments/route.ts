import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";

export const runtime = "nodejs";

const MAX_MB = 10;

export async function POST(req: NextRequest) {
  const g = await requireAuth();
  if ("error" in g) return g.error;
  const { supabase, user } = g;

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const projectId = String(form.get("project_id") ?? "");
  const refType = String(form.get("ref_type") ?? "general");
  const refIdRaw = form.get("ref_id");
  const refId = typeof refIdRaw === "string" && refIdRaw.length > 0 ? refIdRaw : null;
  const caption = form.get("caption") ? String(form.get("caption")) : null;

  if (!file || !projectId) return NextResponse.json({ error: "file, project_id 필수" }, { status: 400 });
  if (!file.type.startsWith("image/")) return NextResponse.json({ error: "이미지 파일만 허용됩니다." }, { status: 400 });
  if (file.size > MAX_MB * 1024 * 1024) return NextResponse.json({ error: "10MB 이하 파일만 허용됩니다." }, { status: 400 });

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${projectId}/${refType}/${refId ?? "general"}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("attachments").upload(path, bytes, {
    contentType: file.type,
    cacheControl: "3600",
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      project_id: projectId,
      ref_type: refType,
      ref_id: refId,
      storage_path: path,
      original_name: file.name,
      caption,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error) {
    await supabase.storage.from("attachments").remove([path]);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ data });
}
