export interface Workspace {
  id: string;
  short_id: string;
  name: string;
  description: string | null;
  mock_base_url: string;
  owner_id: string;
  created_at: string;
  member_count: number;
  mock_count: number;
  role: string | null;
}

export interface WorkspaceMember {
  id: string;
  user_id: string;
  workspace_id: string;
  email: string | null;
  role: string;
  joined_at: string;
}
