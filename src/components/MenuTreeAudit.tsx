import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, Copy, Check } from 'lucide-react';
import {
  SMS_TEMPLATE_BLUEPRINTS,
  USSD_SCREEN_BLUEPRINTS,
  analyzeGsm7,
} from '../data/ussdData';

type CategoryFilter = 'ALL' | 'ROOT' | 'OUTAGE' | 'UPTIME' | 'PAYG' | 'BINDING' | 'SMS';

export const MenuTreeAudit: React.FC = () => {
  const [filter, setFilter] = useState<CategoryFilter>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sandboxText, setSandboxText] = useState<string>(
    `AwkaGrid PAYG: N250 paid via OPay.\nToken 482-910-374 for SP-AWK-8821 (1 Day).\nRef: PAY-9921`
  );

  const sandboxMetrics = analyzeGsm7(sandboxText);

  const filteredScreens =
    filter === 'SMS'
      ? []
      : USSD_SCREEN_BLUEPRINTS.filter((s) => filter === 'ALL' || s.category === filter);

  const showSms = filter === 'ALL' || filter === 'SMS';

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar & Summary */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'ALL', label: 'All Screens & SMS' },
              { id: 'ROOT', label: 'Root' },
              { id: 'OUTAGE', label: 'Outage Report' },
              { id: 'UPTIME', label: '7-Day Uptime' },
              { id: 'PAYG', label: 'Solar PAYG' },
              { id: 'BINDING', label: 'MSISDN Bind' },
              { id: 'SMS', label: 'SMS Templates' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="text-xs text-slate-600 font-mono">
          {USSD_SCREEN_BLUEPRINTS.length} USSD screens · {SMS_TEMPLATE_BLUEPRINTS.length} SMS templates · Max 159 GSM-7 chars
        </div>
      </div>

      {/* USSD Menu Tree Grid */}
      {filteredScreens.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              *347*88# USSD Menu Tree Blueprints
            </h2>
            <span className="text-xs text-slate-500">
              Numbered 1-9 navigation · 0 for Back/Exit · Single-frame GSM-7 compliant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredScreens.map((screen) => {
              const metrics = analyzeGsm7(screen.template);
              const pct = Math.min(100, Math.round((metrics.length / 160) * 100));
              return (
                <div
                  key={screen.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
                >
                  <div>
                    {/* Header Metadata (No pills) */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="text-xs font-mono text-emerald-700 font-semibold">
                          {screen.fastDial}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">
                          {screen.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          {screen.sessionType}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(screen.id, screen.template)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 rounded border border-slate-200"
                          aria-label={`Copy ${screen.title} template`}
                        >
                          {copiedId === screen.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Exact USSD Screen Payload */}
                    <pre className="bg-slate-950 text-emerald-100 rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap border border-slate-800">
                      {screen.template}
                    </pre>

                    {/* Strict Exact Character Count Directly Below Screen */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span
                          className={
                            metrics.underLimit && metrics.isGsm7Safe
                              ? 'text-emerald-700 font-semibold'
                              : 'text-red-700 font-semibold'
                          }
                        >
                          {metrics.length} / 160 chars ({metrics.isGsm7Safe ? 'GSM-7' : 'UCS-2'})
                        </span>
                        <span className="text-slate-500">{160 - metrics.length} byte margin</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            metrics.length < 140
                              ? 'bg-emerald-600'
                              : metrics.length < 160
                                ? 'bg-amber-500'
                                : 'bg-red-600'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    {screen.notes}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Asynchronous SMS Workflow Templates */}
      {showSms && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Asynchronous SMS Workflow &amp; Fallback Templates
            </h2>
            <span className="text-xs text-slate-500">
              Single-part SMPP MT/MO payloads · Strictly under 160 GSM-7 septets
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {SMS_TEMPLATE_BLUEPRINTS.map((sms) => {
              const metrics = analyzeGsm7(sms.template);
              const pct = Math.min(100, Math.round((metrics.length / 160) * 100));
              return (
                <div
                  key={sms.id}
                  className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {sms.direction === 'MT_GATEWAY' ? 'MT Outbound SMPP' : 'MO Inbound Fallback (34788)'} ·{' '}
                          {sms.trigger}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-900 mt-0.5">{sms.title}</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(sms.id, sms.template)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded border border-slate-200 shrink-0"
                        aria-label={`Copy ${sms.title}`}
                      >
                        {copiedId === sms.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <pre className="bg-slate-50 text-slate-900 rounded-md p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap border border-slate-200">
                      {sms.template}
                    </pre>

                    {/* Exact Character Count Directly Below SMS Template */}
                    <div className="mt-2.5">
                      <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            {metrics.length} / 160 chars ({metrics.isGsm7Safe ? 'Single-page GSM-7' : 'UCS-2'})
                          </span>
                        </span>
                        <span className="text-slate-500">{160 - metrics.length} left</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    {sms.notes}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Interactive GSM-7 Encoding & 160-Char Compliance Validator */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              GSM-7 Septet &amp; 160-Char Payload Linter
            </h3>
            <p className="text-xs text-slate-600 mt-0.5">
              Test USSD or SMS copy for hidden UCS-2 triggers (e.g., typing ₦ instead of ASCII N drops the limit from 160 to 70 chars on Nigerian GSM gateways).
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setSandboxText(
                `AwkaGrid PAYG: ₦250 paid via OPay. Token 482-910-374 for SP-AWK-8821.`
              )
            }
            className="px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-md whitespace-nowrap"
          >
            Test Unicode ₦ Trap
          </button>
        </div>

        <textarea
          rows={3}
          value={sandboxText}
          onChange={(e) => setSandboxText(e.target.value)}
          className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            {sandboxMetrics.isGsm7Safe && sandboxMetrics.underLimit ? (
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {sandboxMetrics.length} / 160 chars · GSM-7 7-bit compliant
                </span>
              </span>
            ) : (
              <span className="text-red-700 font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>
                  {sandboxMetrics.length} / {sandboxMetrics.isGsm7Safe ? 160 : 70} chars ·{' '}
                  {!sandboxMetrics.isGsm7Safe
                    ? `UCS-2 Triggered by [${sandboxMetrics.nonGsmChars.join(', ')}] — 70-char fragmentation risk`
                    : 'Exceeds 160-char single-frame USSD limit'}
                </span>
              </span>
            )}
          </div>
          <span className="text-slate-500">
            Extension chars (2 septets each): ^ &#123; &#125; \ [ ~ ] | €
          </span>
        </div>
      </section>
    </div>
  );
};
