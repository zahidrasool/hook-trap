export interface User {
  id: string;
  email: string;
  email_verified: boolean;
  is_admin?: boolean;
  is_blocked?: boolean;
  plan?: string;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
