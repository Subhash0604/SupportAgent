import os
import time
import polars as pl
from dotenv import load_dotenv
from google import genai
from google.genai import types
from google.genai.errors import ClientError
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, PointStruct, VectorParams

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
QDRANT_PATH = os.getenv("QDRANT_PATH", "data/qdrant_storage")
BRAND = os.getenv("BRAND_NAME", "AmazonHelp")

client = genai.Client(api_key=GEMINI_API_KEY)


def load_pairs() -> pl.DataFrame:
  parquet_path = "data/processed/brand_pairs.parquet"
  if not os.path.exists(parquet_path):
    raise FileNotFoundError(f"Missing {parquet_path}. Please create it first.")

  df = pl.read_parquet(parquet_path)
  # Limit to 600 high-quality historical pairs (fits easily in 7-10 API calls)
  sampled = df.head(600)
  print(f"Loaded {len(sampled)} exemplars for indexing.")
  return sampled


def embed_with_retry(texts: list[str], max_retries: int = 5):
  """Sends a batch to Gemini with exponential backoff on 429 errors."""
  delay = 5.0
  for attempt in range(max_retries):
    try:
      response = client.models.embed_content(
          model="gemini-embedding-001",
          contents=texts,
          config=types.EmbedContentConfig(
              task_type="RETRIEVAL_DOCUMENT", output_dimensionality=768
          ),
      )
      return response.embeddings
    except ClientError as e:
      if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
        print(f"\n[Rate Limit] Sleeping {delay:.1f}s before retry...")
        time.sleep(delay)
        delay *= 2.0
      else:
        raise e
  raise RuntimeError("Exceeded maximum retries for embedding batch.")


def index_into_qdrant(df: pl.DataFrame):
  os.makedirs(QDRANT_PATH, exist_ok=True)
  qdrant = QdrantClient(path=QDRANT_PATH)

  vector_size = 768
  collection_name = "brand_history"

  if qdrant.collection_exists(collection_name):
    qdrant.delete_collection(collection_name)

  qdrant.create_collection(
      collection_name=collection_name,
      vectors_config=VectorParams(size=vector_size, distance=Distance.COSINE),
  )

  rows = df.to_dicts()
  # 64 texts per single API call (600 items = only ~10 API calls total)
  batch_size = 64
  total_indexed = 0

  print(
      f"Embedding and indexing {len(rows)} items in batches of {batch_size}..."
  )

  for i in range(0, len(rows), batch_size):
    batch = rows[i : i + batch_size]
    texts = [item["customer_text"] for item in batch]

    embeddings = embed_with_retry(texts)

    points = []
    for idx, (row, embedding_obj) in enumerate(zip(batch, embeddings)):
      points.append(
          PointStruct(
              id=i + idx,
              vector=embedding_obj.values,
              payload={
                  "customer_tweet_id": row["customer_tweet_id"],
                  "customer_text": row["customer_text"],
                  "brand_reply": row["brand_text"],
              },
          )
      )

    qdrant.upsert(collection_name=collection_name, points=points)
    total_indexed += len(batch)
    print(f"Indexed {total_indexed}/{len(rows)} items into Qdrant...")

    # Polite pause between batch calls to stay well below 100 requests/min
    time.sleep(1.5)

  qdrant.close()
  print("Qdrant indexing successfully completed!")


if __name__ == "__main__":
  data = load_pairs()
  index_into_qdrant(data)