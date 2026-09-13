export type IntentType =
  | "shipping_status"
  | "returns_refunds"
  | "damaged_stolen"
  | "account_access"
  | "general_complaint"
  | "out_of_scope";

export type RoutingAction = "AUTO_REPLY" | "ESCALATE_TO_HUMAN";

export interface TriageResponse {
  tweet_id?: string;
  intent: IntentType;
  routing_action: RoutingAction;
  routing_reason: string;
  confidence_score: number;
  draft_reply: string;
  retrieved_contexts: Array<{
    historical_tweet: string;
    historical_reply: string;
    similarity: number;
  }>;
  latency_ms: number;
}

export interface MetricSummary {
  model_name: string;
  intent_macro_f1: number;
  escalation_recall: number;
  escalation_precision: number;
  judge_tone_score: number;
  judge_factual_score: number;
  cohens_kappa: number;
}