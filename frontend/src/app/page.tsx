"use client";

import { useState } from "react";
import {
  Loader2,
  Copy,
  Check,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle2,
  Inbox,
} from "lucide-react";
import { triageTweet } from "@/lib/api";
import { TriageResponse } from "@/types";

const EXAMPLES = [
  "Where is my order? 112-9988112",
  "Item arrived damaged, need a replacement ASAP",
  "How do I return this — order #114-2233445",
];

function formatIntent(intent: string) {
  return intent
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function WorkbenchPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TriageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await triageTweet(input);
      setResult(data);
    } catch (err) {
      setError("Couldn't reach the triage service. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.draft_reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isEscalate = result?.routing_action === "ESCALATE_TO_HUMAN";

  return (
    <div
      className="min-h-screen bg-[#F5F6F8] text-[#14171F]"
      style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-end justify-between pb-6 mb-8 border-b border-[#E2E5EA]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-[#2F3A8F] flex items-center justify-center shrink-0">
              <div className="w-2.5 h-2.5 rounded-sm bg-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-tight">Triage Workbench</h1>
              <p className="text-sm text-[#626A78]">
                AmazonHelp support agent · intent routing &amp; reply synthesis
              </p>
            </div>
          </div>

          <a
            href="/metrics"
            className="group flex items-center gap-1 text-sm font-medium text-[#2F3A8F] hover:text-[#262F73] transition-colors"
          >
            Benchmark metrics
            <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Composer */}
          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E2E5EA] rounded-lg p-5 lg:sticky lg:top-8">
              <h2 className="text-sm font-semibold mb-1">Customer tweet</h2>
              <p className="text-sm text-[#626A78] mb-4">
                Paste the message exactly as received, including any order or tracking numbers.
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  rows={5}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Where is my order? 112-9988112"
                  className="w-full p-3 bg-[#FAFBFC] border border-[#E2E5EA] rounded-md text-sm text-[#14171F] placeholder:text-[#9AA1AC] outline-none focus:ring-2 focus:ring-[#2F3A8F]/30 focus:border-[#2F3A8F] transition"
                  style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
                />

                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setInput(ex)}
                      className="text-xs px-2.5 py-1 rounded-full border border-[#E2E5EA] text-[#626A78] hover:border-[#2F3A8F] hover:text-[#2F3A8F] transition-colors"
                    >
                      {ex.length > 28 ? ex.slice(0, 28) + "…" : ex}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={loading || !input.trim()}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2F3A8F] text-white text-sm font-medium rounded-md hover:bg-[#262F73] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Running triage
                    </>
                  ) : (
                    "Triage & generate reply"
                  )}
                </button>
              </form>

              {error && (
                <div className="mt-3 flex items-start gap-2 p-3 bg-[#FBEAE7] border border-[#F0C9C2] rounded-md text-sm text-[#9A2F23]">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-7">
            {!result && !loading && (
              <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center bg-white border border-dashed border-[#E2E5EA] rounded-lg p-10">
                <Inbox className="w-8 h-8 text-[#9AA1AC] mb-3" />
                <p className="text-sm text-[#626A78] max-w-xs">
                  Submit a tweet to see the routing decision, drafted reply, and
                  the brand exemplars it was grounded on.
                </p>
              </div>
            )}

            {loading && (
              <div className="bg-white border border-[#E2E5EA] rounded-lg p-5 space-y-4 animate-pulse">
                <div className="h-5 w-40 bg-[#EEF0F3] rounded" />
                <div className="h-3 w-full bg-[#EEF0F3] rounded" />
                <div className="h-3 w-2/3 bg-[#EEF0F3] rounded" />
                <div className="h-16 w-full bg-[#EEF0F3] rounded" />
              </div>
            )}

            {result && !loading && (
              <div className="bg-white border border-[#E2E5EA] rounded-lg p-5 space-y-5">
                {/* Status row */}
                <div className="flex items-center justify-between pb-4 border-b border-[#E2E5EA]">
                  <span className="font-semibold text-base">
                    {formatIntent(result.intent)}
                  </span>
                  <span
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${
                      isEscalate
                        ? "bg-[#FBEAE7] text-[#9A2F23]"
                        : "bg-[#E6F4F2] text-[#0F766E]"
                    }`}
                  >
                    {isEscalate ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    {result.routing_action.replace(/_/g, " ")}
                  </span>
                </div>

                {/* Justification */}
                <div>
                  <h4 className="text-sm font-semibold mb-1">Why this route</h4>
                  <p className="text-sm text-[#414751] leading-relaxed">
                    {result.routing_reason}
                  </p>
                </div>

                {/* Draft reply */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-semibold">Drafted reply</h4>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs text-[#626A78] hover:text-[#2F3A8F] transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="p-3.5 bg-[#FAFBFC] border border-[#E2E5EA] rounded-md text-sm text-[#14171F] leading-relaxed">
                    {result.draft_reply}
                  </p>
                </div>

                {/* Metrics strip */}
                <div
                  className="flex items-center justify-between text-xs text-[#9AA1AC] pt-1"
                  style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
                >
                  <span>confidence {(result.confidence_score * 100).toFixed(1)}%</span>
                  <span>{result.latency_ms}ms</span>
                </div>

                {/* Exemplars */}
                <div className="pt-4 border-t border-[#E2E5EA]">
                  <h4 className="text-sm font-semibold mb-2">
                    Retrieved brand exemplars
                  </h4>
                  <div className="space-y-2">
                    {result.retrieved_contexts.map((ctx, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-[#FAFBFC] border border-[#E2E5EA] rounded-md text-xs space-y-1"
                      >
                        <p className="text-[#626A78]">
                          <span className="font-medium text-[#14171F]">Query — </span>
                          {ctx.historical_tweet}
                        </p>
                        <p className="text-[#626A78]">
                          <span className="font-medium text-[#14171F]">Reply — </span>
                          {ctx.historical_reply}
                        </p>
                        <p
                          className="text-[#2F3A8F] pt-0.5"
                          style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
                        >
                          sim {ctx.similarity.toFixed(3)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}