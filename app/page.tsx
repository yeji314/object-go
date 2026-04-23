import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role === "admin") redirect("/admin");

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (project) redirect(`/project/${project.id}`);

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="card p-6 text-center">
        <h1 className="text-lg font-semibold">연결된 프로젝트가 아직 없습니다</h1>
        <p className="mt-2 text-sm text-slate-500">
          관리자가 공사 프로젝트를 연결해 드릴 때까지 잠시 기다려 주세요.
        </p>
      </div>
    </main>
  );
}
