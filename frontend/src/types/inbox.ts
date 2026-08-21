export interface InboxAttachment {
  filename: string;
  content_type: string;
  size: number;
  content_base64?: string;
}

export interface InboxEmailSummary {
  id: string;
  from_address: string;
  to_addresses: string[];
  subject: string | null;
  is_read: boolean;
  received_at: string;
  raw_size: number;
  has_attachments: boolean;
}

export interface InboxEmail {
  id: string;
  workspace_id: string;
  message_id: string | null;
  from_address: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  headers: Record<string, string>;
  attachments: InboxAttachment[];
  raw_size: number;
  is_read: boolean;
  received_at: string;
}

export interface InboxEmailSummaryList {
  data: InboxEmailSummary[];
  total: number;
  unread_count: number;
}

export interface SmtpCredentials {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  connection_url: string;
}
