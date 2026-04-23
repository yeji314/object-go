export type Role = "admin" | "client";
export type ProjectStatus = "active" | "completed" | "paused";
export type ScheduleStatus = "pending" | "in_progress" | "done";
export type DecisionStatus = "pending" | "decided" | "confirmed";
export type SpecStatus = "pending" | "ordered" | "installed";
export type RefType = "schedule" | "cost_item" | "decision" | "general" | "switch_spec";

export type DecisionOption = {
  label: string;
  url?: string;
  note?: string;
};

export type Profile = {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: Role;
  created_at: string;
};

export type Project = {
  id: string;
  client_id: string;
  title: string;
  address: string | null;
  total_budget: number | null;
  start_date: string | null;
  end_date: string | null;
  status: ProjectStatus;
  created_at: string;
};

export type Schedule = {
  id: string;
  project_id: string;
  work_date: string;
  day_of_week: string | null;
  process_name: string;
  detail_items: string | null;
  duration_days: number | null;
  prep_schedule: string | null;
  estimated_cost: number | null;
  status: ScheduleStatus;
  notes: string | null;
  created_at: string;
};

export type CostItem = {
  id: string;
  project_id: string;
  category: string;
  item_name: string;
  spec: string | null;
  unit: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  memo: string | null;
  sort_order: number;
  created_at: string;
};

export type Decision = {
  id: string;
  project_id: string;
  category: string;
  title: string;
  description: string | null;
  options: DecisionOption[];
  selected_option: string | null;
  deadline: string | null;
  status: DecisionStatus;
  client_memo: string | null;
  created_at: string;
};

export type SwitchSpec = {
  id: string;
  project_id: string;
  item_type: "switch" | "outlet";
  space: string;
  brand_line: string | null;
  spec_detail: string | null;
  quantity: number | null;
  product_url: string | null;
  notes: string | null;
  status: SpecStatus;
  created_at: string;
};

export type Attachment = {
  id: string;
  project_id: string;
  ref_type: RefType;
  ref_id: string | null;
  storage_path: string;
  original_name: string | null;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type Comment = {
  id: string;
  project_id: string;
  ref_type: RefType | null;
  ref_id: string | null;
  author_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

// Minimal Database shape for the supabase client type param
export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, "id" | "email" | "name">; Update: Partial<Profile> };
      projects: { Row: Project; Insert: Partial<Project> & Pick<Project, "client_id" | "title">; Update: Partial<Project> };
      schedules: { Row: Schedule; Insert: Partial<Schedule> & Pick<Schedule, "project_id" | "work_date" | "process_name">; Update: Partial<Schedule> };
      cost_items: { Row: CostItem; Insert: Partial<CostItem> & Pick<CostItem, "project_id" | "category" | "item_name">; Update: Partial<CostItem> };
      decisions: { Row: Decision; Insert: Partial<Decision> & Pick<Decision, "project_id" | "category" | "title">; Update: Partial<Decision> };
      switch_specs: { Row: SwitchSpec; Insert: Partial<SwitchSpec> & Pick<SwitchSpec, "project_id" | "item_type" | "space">; Update: Partial<SwitchSpec> };
      attachments: { Row: Attachment; Insert: Partial<Attachment> & Pick<Attachment, "project_id" | "ref_type" | "storage_path">; Update: Partial<Attachment> };
      comments: { Row: Comment; Insert: Partial<Comment> & Pick<Comment, "project_id" | "author_id" | "body">; Update: Partial<Comment> };
    };
  };
};
