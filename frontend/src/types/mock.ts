// Mock types - placeholder for Phase 4
export interface MockEndpoint {
  id: string;
  workspace_id: string;
  path: string;
  method: string;
  name: string | null;
  mock_url: string;
  is_active: boolean;
  request_count: number;
  response_status: number;
  created_at: string;
}
