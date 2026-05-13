export interface Sandbox {
  id: string;
  user_id: string;
  name: string;
  email_prefix: string;
  email_address: string;
  description: string | null;
  tags: string[];
  is_active: boolean;
  email_retention_days: number | null;
  created_at: string;
  updated_at: string;
  email_count: number;
  unread_count: number;
}

export interface SandboxListResponse {
  data: Sandbox[];
  total: number;
}

export interface SandboxCredentials {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  email_address: string;
  connection_url: string;
}

export interface SandboxEmailSummary {
  id: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  is_read: boolean;
  received_at: string;
  raw_size: number;
  has_attachments: boolean;
}

export interface SandboxEmail {
  id: string;
  sandbox_id: string;
  message_id: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, string>;
  attachments: { filename: string; content_type: string; size: number; content_base64?: string }[];
  raw_size: number;
  is_read: boolean;
  received_at: string;
}

export interface SandboxEmailListResponse {
  data: SandboxEmailSummary[];
  total: number;
  unread_count: number;
}

export interface PrefixCheckResponse {
  available: boolean;
  suggestion: string | null;
}
