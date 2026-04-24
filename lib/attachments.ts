import type { SupabaseClient } from "@supabase/supabase-js";
import type { Attachment, RefType } from "@/lib/types/database";

export const MAX_PHOTO_MB = 10;

export async function uploadPendingPhotos(
  supabase: SupabaseClient,
  params: {
    projectId: string;
    refType: RefType;
    refId: string;
    userId: string | null;
    files: File[];
  }
): Promise<Attachment[]> {
  const { projectId, refType, refId, userId, files } = params;
  const results: Attachment[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) continue;
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${projectId}/${refType}/${refId}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (upErr) continue;
    const { data } = await supabase
      .from("attachments")
      .insert({
        project_id: projectId,
        ref_type: refType,
        ref_id: refId,
        storage_path: path,
        original_name: file.name,
        uploaded_by: userId,
      })
      .select()
      .single();
    if (data) results.push(data as unknown as Attachment);
  }
  return results;
}
