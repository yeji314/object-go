import { createClient } from "@/lib/supabase/server";
import { formatDateKr } from "@/lib/utils";
import { ClientListActions, CreateClientForm } from "./ClientListActions";

export const dynamic = "force-dynamic";

export default async function AdminClientsPage() {
  const supabase = createClient();
  const { data: clients } = await supabase
    .from("profiles")
    .select("id,name,email,phone,role,created_at")
    .eq("role", "client")
    .order("created_at", { ascending: false });

  const clientList = (clients ?? []) as unknown as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: string;
    created_at: string;
  }[];
  const ids = clientList.map((c) => c.id);
  const { data: projects } = ids.length
    ? await supabase.from("projects").select("id,title,client_id").in("client_id", ids)
    : { data: [] as { id: string; title: string; client_id: string }[] };

  const projectsByClient = new Map<string, { id: string; title: string }[]>();
  for (const p of (projects ?? []) as unknown as { id: string; title: string; client_id: string }[]) {
    if (!projectsByClient.has(p.client_id)) projectsByClient.set(p.client_id, []);
    projectsByClient.get(p.client_id)!.push({ id: p.id, title: p.title });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">고객 계정</h1>
          <p className="text-sm text-slate-500 mt-1">총 {clientList.length}명</p>
        </div>
        <CreateClientForm />
      </div>

      <ul className="space-y-2">
        {clientList.map((c) => (
          <li key={c.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-slate-500">
                  {c.email} {c.phone ? `· ${c.phone}` : ""}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">가입 {formatDateKr(c.created_at)}</p>
              </div>
              <ClientListActions email={c.email} />
            </div>
            {(projectsByClient.get(c.id) ?? []).length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {(projectsByClient.get(c.id) ?? []).map((p) => (
                  <li key={p.id}>
                    <a href={`/admin/project/${p.id}`} className="text-xs rounded-full px-3 py-1 bg-blue-50 text-blue-700">
                      {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
