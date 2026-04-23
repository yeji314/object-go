import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/BottomNav";
import { ProjectHeader } from "@/components/ProjectHeader";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();

  const { data: project } = await supabase
    .from("projects")
    .select("*, profiles!projects_client_id_fkey(name)")
    .eq("id", params.id)
    .maybeSingle();

  if (!project) notFound();

  const adminLink = profile?.role === "admin" ? `/admin/project/${project.id}` : undefined;
  const clientName = (project as unknown as { profiles?: { name?: string } }).profiles?.name ?? "";

  return (
    <div className="min-h-screen safe-pb">
      <ProjectHeader title={project.title} subtitle={clientName ? `${clientName} 고객님` : undefined} adminLink={adminLink} />
      <div className="mx-auto max-w-xl px-4 py-4">{children}</div>
      <BottomNav projectId={project.id} />
    </div>
  );
}
