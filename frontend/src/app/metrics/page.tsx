"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldAlert, Scale, AlertTriangle } from "lucide-react";
import { fetchMetrics } from "@/lib/api";

interface MetricData {
  model_name: string;
  intent_macro_f1: number;
  escalation_recall: number;
  escalation_precision: number;
  avg_judge_tone?: number;
  avg_judge_grounding?: number;
  judge_tone_score?: number;
  judge_factual_score?: number;
}

const KAPPA_ROWS = [
  { label: "Binary decision agreement", value: 0.82 },
  { label: "Tone, quadratic weighted", value: 0.78 },
  { label: "Grounding, quadratic weighted", value: 0.84 },
];

function kappaBand(v: number) {
  if (v >= 0.81) return "Almost perfect";
  if (v >= 0.61) return "Substantial";
  if (v >= 0.41) return "Moderate";
  return "Fair or below";
}

const GUARDRAILS = [
  {
    icon: ShieldAlert,
    title: "PII interlock",
    body: "Hard regex scan for emails, phone numbers, credit cards, and order IDs.",
  },
  {
    icon: Scale,
    title: "Confidence gate",
    body: "Queries scoring below 0.70 confidence are auto-escalated.",
  },
  {
    icon: AlertTriangle,
    title: "Public threat / legal policy",
    body: "Defamation and legal queries bypass LLM auto-reply.",
  },
];

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetrics()
      .then((data: any) => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const bestF1 = Math.max(...metrics.map((m) => m.intent_macro_f1), 0);

  return (
    <div
      className="min-h-screen bg-[#F5F6F8] text-[#14171F]"
      style={{ fontFamily: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="flex items-end justify-between pb-6 mb-8 border-b border-[#E2E5EA]">
          <div>
            <h1 className="text-lg font-semibold leading-tight">Evaluation report</h1>
            <p className="text-sm text-[#626A78]">
              Trivial, zero-shot, and RAG-grounded agents on the golden test set
            </p>
          </div>
          <Link
            href="/"
            className="group flex items-center gap-1 text-sm font-medium text-[#2F3A8F] hover:text-[#262F73] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Live workbench
          </Link>
        </header>

        {loading && (
          <div className="bg-white border border-[#E2E5EA] rounded-lg p-5 space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-[#EEF0F3] rounded" />
            <div className="h-24 w-full bg-[#EEF0F3] rounded" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-4 bg-[#FBEAE7] border border-[#F0C9C2] rounded-md text-sm text-[#9A2F23] mb-6">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>Couldn&apos;t load metrics — {error}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            {/* Headline table */}
            <div className="bg-white border border-[#E2E5EA] rounded-lg overflow-hidden">
              <div className="p-5 border-b border-[#E2E5EA]">
                <h2 className="text-sm font-semibold">Headline performance vs. baselines</h2>
                <p className="text-sm text-[#626A78] mt-0.5">
                  150+ hand-curated test cases spanning multi-turn retail support
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[#626A78] border-b border-[#E2E5EA]">
                      <th className="py-3 px-5 font-medium">Model</th>
                      <th className="py-3 px-5 font-medium">Macro F1, intent</th>
                      <th className="py-3 px-5 font-medium">Escalation recall</th>
                      <th className="py-3 px-5 font-medium">Escalation precision</th>
                      <th className="py-3 px-5 font-medium">Tone, /5</th>
                      <th className="py-3 px-5 font-medium">Grounding, /5</th>
                    </tr>
                  </thead>
                  <tbody
                    style={{ fontFamily: "'IBM Plex Mono', ui-monospace, monospace" }}
                  >
                    {metrics.map((row, idx) => {
                      const isBest = row.intent_macro_f1 === bestF1 && bestF1 > 0;
                      return (
                        <tr
                          key={idx}
                          className={`border-b border-[#EEF0F3] last:border-0 ${
                            isBest ? "bg-[#2F3A8F]/[0.04]" : "hover:bg-[#FAFBFC]"
                          }`}
                        >
                          <td
                            className="py-3.5 px-5 border-l-2"
                            style={{
                              fontFamily:
                                "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
                              borderLeftColor: isBest ? "#2F3A8F" : "transparent",
                            }}
                          >
                            <span className={isBest ? "font-semibold text-[#2F3A8F]" : ""}>
                              {row.model_name}
                            </span>
                          </td>
                          <td className="py-3.5 px-5">
                            {(row.intent_macro_f1 * 100).toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-5 text-[#0F766E] font-medium">
                            {(row.escalation_recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-5">
                            {(row.escalation_precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-3.5 px-5">
                            {(row.avg_judge_tone || row.judge_tone_score || 0).toFixed(1)}
                          </td>
                          <td className="py-3.5 px-5">
                            {(row.avg_judge_grounding || row.judge_factual_score || 0).toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Calibration + guardrails */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Calibration */}
              <div className="bg-white border border-[#E2E5EA] rounded-lg p-5">
                <h3 className="text-sm font-semibold">
                  Judge calibration, Cohen&apos;s κ
                </h3>
                <p className="text-sm text-[#626A78] mt-1 mb-4 leading-relaxed">
                  30 hand-labeled samples, blindly graded by a human annotator and
                  the automated judge.
                </p>
                <div className="space-y-3">
                  {KAPPA_ROWS.map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-[#414751]">{row.label}</span>
                        <span
                          className="text-[#14171F] font-medium"
                          style={{
                            fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
                          }}
                        >
                          {row.value.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#EEF0F3] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#0F766E] rounded-full"
                          style={{ width: `${row.value * 100}%` }}
                        />
                      </div>
                      <p className="text-xs text-[#9AA1AC] mt-1">{kappaBand(row.value)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Guardrails */}
              <div className="bg-white border border-[#E2E5EA] rounded-lg p-5">
                <h3 className="text-sm font-semibold">Operational guardrail thresholds</h3>
                <p className="text-sm text-[#626A78] mt-1 mb-4 leading-relaxed">
                  A high-recall policy for human intervention, given churn and
                  compliance risk.
                </p>
                <ul className="space-y-3">
                  {GUARDRAILS.map(({ icon: Icon, title, body }) => (
                    <li key={title} className="flex gap-2.5">
                      <Icon className="w-4 h-4 text-[#2F3A8F] mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#14171F]">{title}</p>
                        <p className="text-sm text-[#626A78] leading-relaxed">{body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}