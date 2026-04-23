"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Comment, RefType } from "@/lib/types/database";
import { formatDateKr } from "@/lib/utils";

export function CommentThread({
  projectId,
  refType,
  refId,
}: {
  projectId: string;
  refType: RefType;
  refId: string | null;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, [supabase]);

  useEffect(() => {
    let active = true;
    async function load() {
      let q = supabase
        .from("comments")
        .select("*")
        .eq("project_id", projectId)
        .eq("ref_type", refType)
        .order("created_at", { ascending: true });
      q = refId ? q.eq("ref_id", refId) : q.is("ref_id", null);
      const { data } = await q;
      if (active && data) setComments(data as unknown as Comment[]);
    }
    load();

    const channel = supabase
      .channel(`comments-${projectId}-${refType}-${refId ?? "none"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "comments", filter: `project_id=eq.${projectId}` },
        (payload) => {
          const c = payload.new as unknown as Comment;
          if (c.ref_type === refType && (c.ref_id ?? null) === (refId ?? null)) {
            setComments((prev) => (prev.some((p) => p.id === c.id) ? prev : [...prev, c]));
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [projectId, refType, refId, supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !me) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("comments")
      .insert({ project_id: projectId, ref_type: refType, ref_id: refId, author_id: me, body: body.trim() })
      .select()
      .single();
    setLoading(false);
    if (error) return alert(error.message);
    if (data) {
      setComments((prev) => (prev.some((p) => p.id === data.id) ? prev : [...prev, data as unknown as Comment]));
      setBody("");
    }
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {comments.length === 0 && <li className="text-xs text-slate-400">아직 남긴 메모/요청이 없습니다.</li>}
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{c.author_id === me ? "나" : "관리자/고객"}</span>
              <span>{formatDateKr(c.created_at)}</span>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="요청사항을 남겨주세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <button type="submit" disabled={loading || !body.trim()} className="btn-primary">
          등록
        </button>
      </form>
    </div>
  );
}
