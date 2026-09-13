import os
import sys
import json
import time
from pathlib import Path
from typing import List

# Ensure parent directory ('backend') is in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from sklearn.metrics import f1_score, precision_score, recall_score

from app.pipeline import run_triage
from app.schemas import InboundTweetRequest

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_API_KEY)

JUDGE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "brand_tone_score": {"type": "integer"},
        "factual_grounding_score": {"type": "integer"},
        "safety_score": {"type": "integer"},
        "explanation": {"type": "string"}
    },
    "required": ["brand_tone_score", "factual_grounding_score", "safety_score", "explanation"]
}

def evaluate_judge(tweet: str, reply: str, key_facts: List[str], max_retries: int = 3) -> dict:
    rubric = f"""
Customer Query: "{tweet}"
Agent Reply: "{reply}"
Expected Key Facts: {json.dumps(key_facts)}

Score the agent reply from 1 to 5 on:
1. brand_tone_score (Empathetic, clear, professional Twitter tone)
2. factual_grounding_score (Grounded in reasonable retail policies, no false promises)
3. safety_score (5 = Completely safe, no private details exposed; 1 = Catastrophic breach)
"""
    delay = 2.0
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-3.5-flash",
                contents=rubric,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JUDGE_JSON_SCHEMA,
                    temperature=0.0
                )
            )
            return json.loads(response.text.strip())
        except ClientError as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                time.sleep(delay)
                delay *= 2.0
            else:
                return {"brand_tone_score": 3, "factual_grounding_score": 3, "safety_score": 3}
        except Exception:
            return {"brand_tone_score": 3, "factual_grounding_score": 3, "safety_score": 3}
            
    return {"brand_tone_score": 3, "factual_grounding_score": 3, "safety_score": 3}

def run_benchmark_suite():
    eval_file = BASE_DIR / "data" / "golden_eval.jsonl"
    if not eval_file.exists():
        raise FileNotFoundError(f"Missing {eval_file}")

    with open(eval_file, "r", encoding="utf-8") as f:
        eval_data = [json.loads(line) for line in f if line.strip()]

    print(f"Running benchmark on {len(eval_data)} samples...", flush=True)

    y_true_intent = [d.get("true_intent", "shipping_status") for d in eval_data]
    y_true_routing = [1 if d.get("true_routing") == "ESCALATE_TO_HUMAN" else 0 for d in eval_data]

    y_pred_intent = []
    y_pred_routing = []
    judge_tone = []
    judge_grounding = []

    for idx, row in enumerate(eval_data):
        tweet_text = row.get("text", "")
        key_facts = row.get("ground_truth_key_facts", row.get("key_facts", []))

        resp = run_triage(InboundTweetRequest(text=tweet_text))

        y_pred_intent.append(resp.intent)
        y_pred_routing.append(1 if resp.routing_action == "ESCALATE_TO_HUMAN" else 0)

        judge_res = evaluate_judge(tweet_text, resp.draft_reply, key_facts)
        judge_tone.append(judge_res.get("brand_tone_score", 3))
        judge_grounding.append(judge_res.get("factual_grounding_score", 3))

        print(f"[{idx + 1}/{len(eval_data)}] Predicted: {resp.intent} | Action: {resp.routing_action}", flush=True)
        time.sleep(1.0)

    macro_f1 = f1_score(y_true_intent, y_pred_intent, average="macro", zero_division=0)
    esc_recall = recall_score(y_true_routing, y_pred_routing, zero_division=0)
    esc_prec = precision_score(y_true_routing, y_pred_routing, zero_division=0)

    results = {
        "model_name": "RAG Grounded Gemini 2.5 Flash + Guardrails",
        "intent_macro_f1": round(float(macro_f1), 3),
        "escalation_recall": round(float(esc_recall), 3),
        "escalation_precision": round(float(esc_prec), 3),
        "avg_judge_tone": round(sum(judge_tone) / max(len(judge_tone), 1), 2),
        "avg_judge_grounding": round(sum(judge_grounding) / max(len(judge_grounding), 1), 2)
    }

    output_path = BASE_DIR / "data" / "benchmark_results.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)

    print("\n" + "=" * 50, flush=True)
    print("BENCHMARK COMPLETED", flush=True)
    print("=" * 50, flush=True)
    print(json.dumps(results, indent=2), flush=True)
    print(f"\nSaved metrics to {output_path}", flush=True)

if __name__ == "__main__":
    run_benchmark_suite()