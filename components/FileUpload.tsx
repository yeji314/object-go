"use client";

import { useRef, useState } from "react";
import { X, Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Attachment, RefType } from "@/lib/types/database";

type Props = {
  projectId: string;
  refType: RefType;
  refId: string | null;
  attachments: Attachment[];
  onChange: (items: Attachment[]) => void;
  canDelete?: (a: Attachment) => boolean;
  max?: number;
};

const MAX_MB = 10;

export function FileUpload({ projectId, refType, refId, attachments, onChange, canDelete, max = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    if (attachments.length + files.length > max) {
      setError(`사진은 최대 ${max}장까지 업로드할 수 있습니다.`);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      const uploaded: Attachment[] = [];

      for (const file of files) {
        if (!file.type.startsWith("image/")) {
          setError("이미지 파일만 업로드할 수 있습니다.");
          continue;
        }
        if (file.size > MAX_MB * 1024 * 1024) {
          setError(`파일은 ${MAX_MB}MB 이하여야 합니다.`);
          continue;
        }
        const ext = file.name.split(".").pop() || "jpg";
        const path = `${projectId}/${refType}/${refId ?? "general"}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("attachments").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
        if (upErr) {
          setError(upErr.message);
          continue;
        }
        const { data: inserted, error: dbErr } = await supabase
          .from("attachments")
          .insert({
            project_id: projectId,
            ref_type: refType,
            ref_id: refId,
            storage_path: path,
            original_name: file.name,
            uploaded_by: uid,
          })
          .select()
          .single();
        if (dbErr) {
          setError(dbErr.message);
          continue;
        }
        if (inserted) uploaded.push(inserted as unknown as Attachment);
      }
      if (uploaded.length) onChange([...attachments, ...uploaded]);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(a: Attachment) {
    if (!confirm("이 사진을 삭제하시겠습니까?")) return;
    await supabase.storage.from("attachments").remove([a.storage_path]);
    await supabase.from("attachments").delete().eq("id", a.id);
    onChange(attachments.filter((x) => x.id !== a.id));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {attachments.map((a) => (
          <Thumb key={a.id} attachment={a} onDelete={canDelete?.(a) !== false ? () => handleDelete(a) : undefined} />
        ))}
        {attachments.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50"
          >
            {uploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}

function Thumb({ attachment, onDelete }: { attachment: Attachment; onDelete?: () => void }) {
  const supabase = createClient();
  const [url, setUrl] = useState<string | null>(null);

  if (url === null) {
    supabase.storage
      .from("attachments")
      .createSignedUrl(attachment.storage_path, 60 * 60, { transform: { width: 400, height: 400, resize: "cover" } })
      .then(({ data }) => setUrl(data?.signedUrl ?? ""));
  }

  return (
    <div className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={attachment.original_name || ""} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full animate-pulse bg-slate-200" />
      )}
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1"
          aria-label="삭제"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
