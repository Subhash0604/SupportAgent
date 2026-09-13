from typing import List, Literal
from pydantic import BaseModel, Field

IntentType = Literal[
    "shipping_status",
    "returns_refunds",
    "damaged_stolen",
    "account_access",
    "general_complaint",
    "out_of_scope",
]

RoutingAction = Literal["AUTO_REPLY", "ESCALATE_TO_HUMAN"]


class TriagePrediction(BaseModel):
  intent: IntentType = Field(
      ..., description="Classification category for inbound tweet."
  )
  routing_action: RoutingAction = Field(
      ...,
      description=(
          "AUTO_REPLY if issue is safe and solved via policy; ESCALATE_TO_HUMAN"
          " if private data, fraud, or high anger."
      ),
  )
  routing_reason: str = Field(
      ..., description="Explicit 1-2 sentence operational justification."
  )
  confidence_score: float = Field(
      ..., ge=0.0, le=1.0, description="Confidence in classification."
  )
  draft_reply: str = Field(
      ...,
      description=(
          "Professional reply matching historical tone and policy under 280"
          " chars."
      ),
  )


class RetrievedContext(BaseModel):
  historical_tweet: str
  historical_reply: str
  similarity: float


class InboundTweetRequest(BaseModel):
  text: str


class TriageResponse(BaseModel):
  intent: IntentType
  routing_action: RoutingAction
  routing_reason: str
  confidence_score: float
  draft_reply: str
  retrieved_contexts: List[RetrievedContext]
  latency_ms: float