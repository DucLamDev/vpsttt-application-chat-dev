import type { Id, ISODateTime } from "./api";

export type Department = {
  id: Id;
  workspace_id: Id;
  parent_id?: Id | null;
  slug: string;
  name: string;
  description?: string | null;
  created_by?: Id | null;
  created_at?: ISODateTime;
  updated_at?: ISODateTime;
};

export type CreateDepartmentInput = {
  parent_id?: Id;
  slug: string;
  name: string;
  description?: string;
};

export type UpdateDepartmentInput = {
  parent_id?: Id | null;
  name?: string;
  description?: string;
};

export type DepartmentMember = {
  department_id: Id;
  user_id: Id;
  email?: string;
  username?: string;
  display_name?: string;
  role: "lead" | "member" | string;
  created_at?: ISODateTime;
};
