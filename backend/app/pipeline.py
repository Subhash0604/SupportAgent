import os
import re
import json
import time
from typing import List
from dotenv import load_dotenv
from google import genai
from google.genai import types
from qdrant_client import QdrantClient

from app.schemas import (
    InboundTweetRequest,
    RetrievedContext,
    TriageResponse
)

load_dotenv()

QDRANT_PATH = os.getenv("QDRANT_PATH", "data/qdrant_storage")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
qdrant = QdrantClient(path=QDRANT_PATH)

# Deterministic PII and threat detectors
PII_PATTERNS = [
    re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"),  # Email
    re.compile(r"\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b"),                  # Phone
    re.compile(r"\b(?:\d[ -]*?){13,16}\b"),                              # Credit Card
    re.compile(r"\b\d{3}-\d{7}-\d{7}\b"),                                # Amazon Order ID
]

TRIAGE_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "intent": {
            "type": "string",
            "enum": [
                "shipping_status",
                "returns_refunds",
                "damaged_stolen",
                "account_access",
                "general_complaint",
                "out_of_scope"
            ]
        },
        "routing_action": {
            "type": "string",
            "enum": ["AUTO_REPLY", "ESCALATE_TO_HUMAN"]
        },
        "routing_reason": {
            "type": "string",
            "description": "Explicit 1-2 sentence justification for this routing."
        },
        "confidence_score": {
            "type": "number",
            "description": "Confidence from 0.0 to 1.0"
        },
        "draft_reply": {
            "type": "string",
            "description": "Concise, brand-aligned Twitter customer support reply under 280 chars."
        }
    },
    "required": ["intent", "routing_action", "routing_reason", "confidence_score", "draft_reply"]
}

def check_pii(text: str) -> bool:
    return any(pattern.search(text) for pattern in PII_PATTERNS)

def retrieve_exemplars(query_text: str, top_k: int = 3) -> List[RetrievedContext]:
    embed_response = gemini_client.models.embed_content(
        model="gemini-embedding-001",
        contents=query_text,
        config=types.EmbedContentConfig(
            task_type="RETRIEVAL_QUERY",
            output_dimensionality=768
        )
    )
    query_vector = embed_response.embeddings[0].values

    # Support both modern query_points() and legacy search()
    if hasattr(qdrant, "query_points"):
        response = qdrant.query_points(
            collection_name="brand_history",
            query=query_vector,
            limit=top_k
        )
        results = response.points
    else:
        results = qdrant.search(
            collection_name="brand_history",
            query_vector=query_vector,
            limit=top_k
        )

    exemplars = []
    for hit in results:
        payload = hit.payload or {}
        exemplars.append(
            RetrievedContext(
                historical_tweet=payload.get("customer_text", ""),
                historical_reply=payload.get("brand_reply", ""),
                similarity=float(hit.score) if hit.score is not None else 0.0
            )
        )
    return exemplars

def run_triage(payload: InboundTweetRequest) -> TriageResponse:
    start_time = time.perf_counter()
    raw_text = payload.text.strip()

    has_pii = check_pii(raw_text)
    exemplars = retrieve_exemplars(raw_text, top_k=3)

    exemplar_block = "\n---\n".join([
        f"Historical Inbound: {ex.historical_tweet}\nHistorical Reply: {ex.historical_reply}"
        for ex in exemplars
    ])

    system_instruction = (
        "You are the official Twitter customer service AI for AmazonHelp. Your role is to classify the intent "
        "of the incoming tweet, decide if it should be AUTO_REPLY or ESCALATE_TO_HUMAN, and draft a response "
        "matching company policy and tone. Never make promises about financial compensation on a public thread. "
        "Keep Twitter character limits (<280 chars) in mind."
    )

    prompt = f"""
Incoming Customer Tweet:
"{raw_text}"

Relevant Historical Resolution Exemplars:
{exemplar_block}

Classify the intent, determine routing action, give an explicit reason, and generate the grounded draft reply.
"""

    response = gemini_client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            response_mime_type="application/json",
            response_schema=TRIAGE_JSON_SCHEMA,
            temperature=0.0
        )
    )

    pred_data = json.loads(response.text.strip())

    final_intent = pred_data.get("intent", "general_complaint")
    final_routing = pred_data.get("routing_action", "AUTO_REPLY")
    final_reason = pred_data.get("routing_reason", "")
    confidence = float(pred_data.get("confidence_score", 0.85))
    draft_reply = pred_data.get("draft_reply", "")

    # Deterministic Safety Interlock overrides
    if has_pii:
        final_routing = "ESCALATE_TO_HUMAN"
        final_reason = "PII or sensitive credentials detected in tweet. Escalated for human review over secure channel."
    elif confidence < 0.70:
        final_routing = "ESCALATE_TO_HUMAN"
        final_reason = f"Classification confidence ({confidence:.2f}) is below standard threshold (0.70)."

    latency = (time.perf_counter() - start_time) * 1000.0

    return TriageResponse(
        intent=final_intent,
        routing_action=final_routing,
        routing_reason=final_reason,
        confidence_score=confidence,
        draft_reply=draft_reply,
        retrieved_contexts=exemplars,
        latency_ms=round(latency, 2)
    )