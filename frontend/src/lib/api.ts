import { TriageResponse, MetricSummary } from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function triageTweet(text: string): Promise<TriageResponse> {
  const res = await fetch(`${API_BASE}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchMetrics(): Promise<MetricSummary[]> {
  const res = await fetch(`${API_BASE}/api/metrics`);
  if (!res.ok) {
    throw new Error(`Failed to load benchmark metrics`);
  }
  return res.json();
}