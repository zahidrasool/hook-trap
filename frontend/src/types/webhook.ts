export interface Endpoint {
  id: string;
  short_id: string;
  name: string | null;
  description: string | null;
  endpoint_url: string;
  created_at: string;
}

export interface WebhookCapture {
  id: string;
  endpoint_id: string;
  http_method: string;
  path: string | null;
  query_params: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  body_size: number;
  content_type: string | null;
  source_ip: string | null;
  captured_at: string;
}
