"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { MAX_PHOTO_MB } from "@/lib/attachments";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
};

export function PendingPhotoPicker({ files, onChange, max = 10 }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const picked = Array.from(e.target.files || []);
    e.target.value = "";
    const valid: File[] = [];
    for (const f of picked) {
      if (!f.type.startsWith("image/")) {
        setError("이미지 파일만 추가할 수 있습니다.");
        continue;
      }
      if (f.size > MAX_PHOTO_MB * 1024 * 1024) {
        setError(`파일은 ${MAX_PHOTO_MB}MB 이하여야 합니다.`);
        continue;
      }
      valid.push(f);
    }
    const combined = [...files, ...valid].slice(0, max);
    if (files.length + valid.length > max) {
      setError(`사진은 최대 ${max}장까지 추가할 수 있습니다.`);
    }
    onChange(combined);
  }

  function removeAt(i: number) {
    onChange(files.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {files.map((f, i) => (
          <div key={`${f.name}-${i}`} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[i]} alt={f.name} className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => removeAt(i)}
              className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1"
              aria-label="삭제"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square border border-dashed border-slate-300 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50"
            aria-label="사진 선택"
          >
            <Upload size={20} />
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePick} />
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
