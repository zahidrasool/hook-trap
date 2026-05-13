// Use empty string to make requests relative to the frontend origin,
// which lets Next.js rewrites proxy them to the backend (avoids CORS).
const API_BASE = "";

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async getToken(): Promise<string | null> {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("session_token");
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: "Request failed" }));
      const detail = error.detail;
      if (typeof detail === "string") {
        throw new Error(detail);
      }
      if (Array.isArray(detail) && detail.length > 0) {
        throw new Error(detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join("; "));
      }
      throw new Error("Request failed");
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async get(path: string): Promise<any> {
    return this.request(path);
  }

  async post(path: string, body?: any): Promise<any> {
    return this.request(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch(path: string, body?: any): Promise<any> {
    return this.request(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete(path: string): Promise<any> {
    return this.request(path, { method: "DELETE" });
  }
}

export const api = new ApiClient(API_BASE);
