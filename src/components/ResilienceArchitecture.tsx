import React, { useState } from 'react';
import {
  Database,
  GitMerge,
  KeyRound,
  RefreshCw,
  ArrowRight,
  Zap,
} from 'lucide-react';
import {
  PAYG_PLANS,
  PAYMENT_RAILS,
  SubscriberProfile,
  generateOpenPaygoToken,
} from '../data/ussdData';

export interface GatewayEvent {
  id: string;
  timestamp: string;
  category: string;
  summary: string;
  detail: string;
}

interface ResilienceArchitectureProps {
  events: GatewayEvent[];
  profiles: SubscriberProfile[];
  onTestWebhookToken: (meterId: string, days: number, railName: string, token: string) => void;
}

const RESILIENCE_PILLARS = [
  {
    id: 'msisdn',
    icon: Database,
    title: '01. MSISDN Auto-Binding Cache',
    mechanism: 'Telco SMPP/USSD Gateway Header -> Edge Redis Lookup',
    summary:
      'Every *347*88# request carries the caller MSISDN from MTN/Airtel/Glo/9mobile. A <4ms Redis lookup binds the caller to their saved EEDC 11kV feeder and OpenPAYGO meter ID so repeat sessions skip manual entry.',
    steps: [
      'USSD Gateway receives *347*88# with MSISDN 08034128891',
      'Edge lookup resolves feeder EKE-MKT-11KV and unit SP-AWK-8821',
      'Root menu renders pre-bound context in 124 GSM-7 chars',
    ],
  },
  {
    id: 'dedup',
    icon: GitMerge,
    title: '02. Crowd-Sourced Fault Deduplication',
    mechanism: '15-Minute Sliding Spatial Window per Transformer / Feeder',
    summary:
      'When 20+ Eke Awka traders dial *347*88*1# during a breaker trip, the ingestion engine hashes (feeder_id, fault_category, 15m_bucket) to merge all reports into a single canonical EEDC ticket.',
    steps: [
      'Normalize report to feeder TX-EKE-021 + fault bucket',
      'Increment MSISDN cluster set on existing ticket TKT-412',
      'Return merged count by SMS and subscribe caller to restore alert',
    ],
  },
  {
    id: 'openpaygo',
    icon: KeyRound,
    title: '03. Webhook -> OpenPAYGO Token Engine',
    mechanism: 'OPay / PalmPay / Bank USSD Push -> HMAC -> SipHash-2-4',
    summary:
      'To avoid holding scarce 2G USSD channels open during bank PIN entry, the USSD session terminates immediately after triggering the payment push. Upon settlement webhook, the engine derives a 9-digit OpenPAYGO token.',
    steps: [
      'USSD terminates cleanly (END) after OPay / *737# push dispatch',
      'Payment webhook verified via HMAC-SHA256 signature',
      'SipHash-2-4 derives 9-digit token (e.g. 482-910-374) -> SMS',
    ],
  },
  {
    id: 'fallback',
    icon: RefreshCw,
    title: '04. Dropped USSD -> Async SMS Fallback',
    mechanism: '45s Telco Radio Timeout Watchdog + 15m Recovery Lock',
    summary:
      'If 2G signal drops mid-payment before checkout completes, the gateway detects session termination without an END ACK, preserves checkout state for 15 minutes, and fires an automatic recovery SMS.',
    steps: [
      'Telco sends ABORT/TIMEOUT frame mid-PAYG selection',
      'Pending checkout locked in Redis (TTL 900s) with ref PAY-9921',
      'SMPP dispatches SMS: Dial *347*88*9# or reply PAY 1 to finish',
    ],
  },
];

export const ResilienceArchitecture: React.FC<ResilienceArchitectureProps> = ({
  events,
  profiles,
  onTestWebhookToken,
}) => {
  const [selectedMeter, setSelectedMeter] = useState<string>(profiles[0].solarMeterId);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('1d');
  const [selectedRailId, setSelectedRailId] = useState<string>('opay');
  const [generatedToken, setGeneratedToken] = useState<string>(() =>
    generateOpenPaygoToken(profiles[0].solarMeterId, 1, 1024)
  );

  const selectedPlan = PAYG_PLANS.find((p) => p.id === selectedPlanId) || PAYG_PLANS[0];
  const selectedRail = PAYMENT_RAILS.find((r) => r.id === selectedRailId) || PAYMENT_RAILS[0];

  const handleTriggerWebhook = () => {
    const salt = Date.now() % 100000;
    const token = generateOpenPaygoToken(selectedMeter, selectedPlan.days, salt);
    setGeneratedToken(token);
    onTestWebhookToken(selectedMeter, selectedPlan.days, selectedRail.shortName, token);
  };

  return (
    <div className="space-y-6">
      {/* Four Resilience Architecture Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {RESILIENCE_PILLARS.map((pillar) => {
          const Icon = pillar.icon;
          return (
            <div key={pillar.id} className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-xs font-mono text-emerald-700 font-medium">
                      {pillar.mechanism}
                    </div>
                    <h3 className="text-base font-semibold text-slate-900 mt-0.5">
                      {pillar.title}
                    </h3>
                  </div>
                  <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                </div>

                <p className="text-sm text-slate-600 leading-relaxed mb-4">
                  {pillar.summary}
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                {pillar.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                    <span className="font-mono text-slate-400 shrink-0">0{i + 1}.</span>
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Webhook -> OpenPAYGO Token Simulator + Event Trace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Webhook & OpenPAYGO Token Generator */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5">
          <h3 className="text-base font-semibold text-slate-900">
            Payment Webhook &rarr; OpenPAYGO Simulator
          </h3>
          <p className="text-xs text-slate-600 mt-0.5 mb-4">
            Simulate an asynchronous Nigerian payment webhook settling a solar micro-payment and generating a 9-digit OpenPAYGO keypad token.
          </p>

          <div className="space-y-3">
            <div>
              <label htmlFor="webhook-meter" className="block text-xs font-medium text-slate-700 mb-1">
                Solar Unit ID (Bound to MSISDN)
              </label>
              <select
                id="webhook-meter"
                value={selectedMeter}
                onChange={(e) => setSelectedMeter(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md"
              >
                {profiles.map((p) => (
                  <option key={p.solarMeterId} value={p.solarMeterId}>
                    {p.solarMeterId} · {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="webhook-plan" className="block text-xs font-medium text-slate-700 mb-1">
                  PAYG Plan (NGN)
                </label>
                <select
                  id="webhook-plan"
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
                >
                  {PAYG_PLANS.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} (N{plan.priceNgn.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="webhook-rail" className="block text-xs font-medium text-slate-700 mb-1">
                  Settlement Rail
                </label>
                <select
                  id="webhook-rail"
                  value={selectedRailId}
                  onChange={(e) => setSelectedRailId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
                >
                  {PAYMENT_RAILS.map((rail) => (
                    <option key={rail.id} value={rail.id}>
                      {rail.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTriggerWebhook}
              className="w-full py-2.5 px-4 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate Settlement Webhook &amp; Dispatch SMS</span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">Generated OpenPAYGO Token</div>
              <div className="font-mono text-lg font-bold text-slate-900 tracking-wider mt-0.5">
                {generatedToken}
              </div>
            </div>
            <div className="text-right font-mono text-xs text-slate-500">
              <div>+{selectedPlan.days}d credit</div>
              <div>
                N{(selectedPlan.priceNgn + selectedRail.feeNgn).toLocaleString()} total
              </div>
            </div>
          </div>
        </div>

        {/* Gateway Event Trace */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                USSD &amp; Webhook Execution Trace
              </h3>
              <p className="text-xs text-slate-500">
                Real-time log of simulator dials, deduplication merges, session drops, and OpenPAYGO token dispatches
              </p>
            </div>
            <span className="font-mono text-xs text-slate-500">{events.length} events</span>
          </div>

          <div className="divide-y divide-slate-200 max-h-[340px] overflow-y-auto">
            {events.map((ev) => (
              <div key={ev.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-semibold text-emerald-700 flex items-center gap-1.5">
                    <ArrowRight className="w-3 h-3" />
                    <span>{ev.category}</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{ev.timestamp}</span>
                </div>
                <div className="text-xs font-medium text-slate-900 mt-1">{ev.summary}</div>
                <div className="text-xs text-slate-600 mt-0.5 font-mono">{ev.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
