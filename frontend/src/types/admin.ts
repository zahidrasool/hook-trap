export interface AdminDashboardStats {
  total_users: number;
  active_users_30d: number;
  blocked_users: number;
  plan_breakdown: Record<string, number>;
  signups_last_7_days: { date: string; count: number }[];
  recent_signups: { id: string; email: string; plan: string; created_at: string }[];
}

export interface AdminUser {
  id: string;
  email: string;
  email_verified: boolean;
  plan: string;
  is_admin: boolean;
  is_blocked: boolean;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUserDetail extends AdminUser {
  workspace_count: number;
  endpoint_count: number;
  sandbox_count: number;
}

export interface AdminUserListResponse {
  data: AdminUser[];
  total: number;
  page: number;
  per_page: number;
}

export interface AdminPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  customer_email: string | null;
  description: string | null;
  created_at: string;
}

export interface AdminSubscription {
  id: string;
  customer_email: string | null;
  plan_name: string | null;
  amount: number;
  currency: string;
  status: string;
  current_period_end: string | null;
  created_at: string;
}

export interface AdminPaymentsResponse {
  payments: AdminPayment[];
  subscriptions: AdminSubscription[];
  total_revenue: number;
  active_subscription_count: number;
  currency: string;
  stripe_configured: boolean;
}
