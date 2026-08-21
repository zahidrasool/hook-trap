export interface MockEndpoint {
  id: string;
  workspace_id: string;
  path: string;
  method: string;
  name: string | null;
  description: string | null;
  mock_url: string | null;
  is_active: boolean;
  priority: number;
  response_status: number;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  response_delay_ms: number;
  error_rate: number;
  error_status: number;
  error_body: string | null;
  static_data: any[] | null;
  is_immutable: boolean;
  request_count: number;
  created_at: string;
  rules?: MockRule[];
  sequences?: MockSequence[];
}

export interface MockRule {
  id: string;
  mock_endpoint_id: string;
  name: string | null;
  description: string | null;
  priority: number;
  is_active: boolean;
  match_conditions: MatchCondition[];
  response_status: number;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  response_delay_ms: number;
  created_at: string;
}

export interface MatchCondition {
  field: string;
  operator: string;
  value?: string;
}

export interface MockSequence {
  id: string;
  mock_endpoint_id: string;
  name: string | null;
  is_active: boolean;
  loop: boolean;
  current_step: number;
  steps: SequenceStep[];
  created_at: string;
}

export interface SequenceStep {
  id: string;
  step_order: number;
  response_status: number;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  response_delay_ms: number;
}

export interface MockRequestLog {
  id: string;
  mock_endpoint_id: string;
  method: string;
  path: string;
  query_params: Record<string, string>;
  headers: Record<string, string>;
  body: string | null;
  matched_rule_id: string | null;
  matched_sequence_id: string | null;
  response_status: number | null;
  response_delay_ms: number | null;
  contract_valid: boolean | null;
  received_at: string;
}
