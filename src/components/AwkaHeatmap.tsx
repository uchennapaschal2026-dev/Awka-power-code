import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Search,
  Wrench,
  Zap,
  PlusCircle,
} from 'lucide-react';
import { FaultTicket, FeederNode, GridStatus } from '../data/ussdData';

interface AwkaHeatmapProps {
  feeders: FeederNode[];
  tickets: FaultTicket[];
  onSimulateCrowdReport: (feederId: string) => void;
  onDispatchCrew: (ticketId: string) => void;
  onRestoreFeeder: (feederId: string) => void;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AwkaHeatmap: React.FC<AwkaHeatmapProps> = ({
  feeders,
  tickets,
  onSimulateCrowdReport,
  onDispatchCrew,
  onRestoreFeeder,
}) => {
  const [selectedFeederId, setSelectedFeederId] = useState<string>('eke-awka');
  const [statusFilter, setStatusFilter] = useState<'ALL' | GridStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const selectedFeeder = feeders.find((f) => f.id === selectedFeederId) || feeders[0];
  const selectedTicket = tickets.find(
    (t) => t.feederId === selectedFeeder.id && t.status !== 'RESOLVED'
  );

  const filteredFeeders = feeders.filter((f) => {
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      f.name.toLowerCase().includes(q) ||
      f.code.toLowerCase().includes(q) ||
      f.transformerId.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const getStatusLabel = (status: GridStatus) => {
    if (status === 'ON') return 'Online';
    if (status === 'LOAD_SHED') return 'Load Shed';
    return 'Outage';
  };

  const getStatusTextColor = (status: GridStatus) => {
    if (status === 'ON') return 'text-emerald-700';
    if (status === 'LOAD_SHED') return 'text-amber-700';
    return 'text-red-700';
  };

  const getNodeColor = (status: GridStatus) => {
    if (status === 'ON') return '#16A34A';
    if (status === 'LOAD_SHED') return '#D97706';
    return '#DC2626';
  };

  return (
    <div className="space-y-6">
      {/* Top 2-Column Heatmap + Feeder Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Awka Outage Thermal Map */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Awka EEDC 11kV Regional Outage Heatmap
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Spatial intensity weighted by deduplicated *347*88# fault clusters and affected market stalls
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#DC2626] inline-block" />
                Outage
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#D97706] inline-block" />
                Load Shed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#16A34A] inline-block" />
                Online
              </span>
            </div>
          </div>

          {/* Interactive SVG Spatial Grid */}
          <div className="relative bg-slate-950 rounded-lg border border-slate-800 overflow-hidden aspect-[16/10] w-full">
            <svg viewBox="0 0 100 100" className="w-full h-full select-none" role="img" aria-label="Awka Regional Outage Heatmap">
              <defs>
                <radialGradient id="heat-outage" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#DC2626" stopOpacity="0.65" />
                  <stop offset="55%" stopColor="#DC2626" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#DC2626" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-shed" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.50" />
                  <stop offset="60%" stopColor="#D97706" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="heat-on" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#16A34A" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Subtle 10-unit topographic coordinate grid */}
              <g stroke="#1E293B" strokeWidth="0.25">
                {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((v) => (
                  <React.Fragment key={v}>
                    <line x1={v} y1="0" x2={v} y2="100" />
                    <line x1="0" y1={v} x2="100" y2={v} />
                  </React.Fragment>
                ))}
              </g>

              {/* Major Awka Corridors: Enugu-Onitsha Expressway & Zik Avenue */}
              <path
                d="M 8 86 Q 42 56 88 22"
                fill="none"
                stroke="#334155"
                strokeWidth="1.2"
                strokeDasharray="2 1.5"
              />
              <text x="63" y="39" fill="#64748B" fontSize="2.3" transform="rotate(-33 63 39)">
                Enugu-Onitsha Expy
              </text>

              <path
                d="M 14 76 Q 38 62 66 56"
                fill="none"
                stroke="#334155"
                strokeWidth="0.9"
              />
              <text x="23" y="72" fill="#64748B" fontSize="2.2" transform="rotate(-18 23 72)">
                Zik Avenue
              </text>

              {/* 33/11kV Injection Substation Links */}
              <g stroke="#475569" strokeWidth="0.4" strokeDasharray="1 1">
                <line x1="82" y1="50" x2="54" y2="18" />
                <line x1="82" y1="50" x2="74" y2="28" />
                <line x1="52" y1="48" x2="64" y2="64" />
                <line x1="52" y1="48" x2="34" y2="60" />
                <line x1="34" y1="60" x2="20" y2="78" />
              </g>

              {/* Thermal Outage Heat Radii */}
              {feeders.map((f) => {
                const radius =
                  f.status === 'OUTAGE'
                    ? Math.min(28, 16 + f.activeFaultReports * 0.45)
                    : f.status === 'LOAD_SHED'
                      ? 16
                      : 11;
                const grad =
                  f.status === 'OUTAGE'
                    ? 'url(#heat-outage)'
                    : f.status === 'LOAD_SHED'
                      ? 'url(#heat-shed)'
                      : 'url(#heat-on)';
                return (
                  <circle
                    key={`heat-${f.id}`}
                    cx={f.mapX}
                    cy={f.mapY}
                    r={radius}
                    fill={grad}
                    className="pointer-events-none"
                  />
                );
              })}

              {/* Interactive Feeder Nodes */}
              {feeders.map((f) => {
                const isSelected = f.id === selectedFeeder.id;
                const nodeColor = getNodeColor(f.status);
                return (
                  <g
                    key={f.id}
                    onClick={() => setSelectedFeederId(f.id)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${f.name} feeder status ${f.status}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedFeederId(f.id);
                      }
                    }}
                  >
                    {isSelected && (
                      <circle
                        cx={f.mapX}
                        cy={f.mapY}
                        r="4.8"
                        fill="none"
                        stroke="#F8FAFC"
                        strokeWidth="0.6"
                      />
                    )}
                    <circle
                      cx={f.mapX}
                      cy={f.mapY}
                      r="2.6"
                      fill={nodeColor}
                      stroke="#0F172A"
                      strokeWidth="0.7"
                    />
                    <text
                      x={f.mapX}
                      y={f.mapY - 4.4}
                      textAnchor="middle"
                      fill={isSelected ? '#FFFFFF' : '#CBD5E1'}
                      fontSize="2.7"
                      fontWeight={isSelected ? '700' : '500'}
                    >
                      {f.shortName}
                    </text>
                    <text
                      x={f.mapX}
                      y={f.mapY + 5.8}
                      textAnchor="middle"
                      fill="#94A3B8"
                      fontSize="2.1"
                    >
                      {f.status === 'OUTAGE'
                        ? `${f.activeFaultReports} rpts`
                        : `${f.weeklyUptimeHours.toFixed(0)}h/7d`}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Selected Feeder Telemetry & Dispatch Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
              <div>
                <div className="font-mono text-xs text-slate-500">
                  {selectedFeeder.code} · {selectedFeeder.transformerId}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mt-0.5">
                  {selectedFeeder.name}
                </h3>
                <div className="text-xs text-slate-500 mt-0.5">
                  {selectedFeeder.substation}
                </div>
              </div>
              <div className={`text-xs font-semibold flex items-center gap-1.5 ${getStatusTextColor(selectedFeeder.status)}`}>
                {selectedFeeder.status === 'ON' && <CheckCircle2 className="w-4 h-4" />}
                {selectedFeeder.status === 'LOAD_SHED' && <Clock className="w-4 h-4" />}
                {selectedFeeder.status === 'OUTAGE' && <AlertTriangle className="w-4 h-4" />}
                <span>{getStatusLabel(selectedFeeder.status)}</span>
              </div>
            </div>

            {/* Key Feeder Figures */}
            <div className="grid grid-cols-3 gap-4 py-4 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">7-Day Uptime</div>
                <div className="font-mono text-base font-semibold text-slate-900 mt-0.5">
                  {selectedFeeder.weeklyUptimeHours.toFixed(1)}h
                </div>
                <div className="text-[11px] text-slate-500">of 168h</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Crowd Reports</div>
                <div className="font-mono text-base font-semibold text-slate-900 mt-0.5">
                  {selectedFeeder.activeFaultReports}
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedFeeder.deduplicatedTickets} ticket
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Est. Traders</div>
                <div className="font-mono text-base font-semibold text-slate-900 mt-0.5">
                  {selectedFeeder.affectedTradersEst.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">
                  {selectedFeeder.loadMw.toFixed(1)} MW load
                </div>
              </div>
            </div>

            {/* 7-Day Daily Uptime Bar Chart */}
            <div className="py-4 border-b border-slate-200">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-medium text-slate-700">7-Day Daily Supply Hours</span>
                <span className="font-mono text-slate-500">Last ON: {selectedFeeder.lastRestored}</span>
              </div>
              <div className="grid grid-cols-7 gap-2 items-end h-24">
                {selectedFeeder.dailyUptime.map((hrs, idx) => {
                  const pct = Math.min(100, Math.round((hrs / 16) * 100));
                  return (
                    <div key={DAY_LABELS[idx]} className="flex flex-col items-center gap-1 h-full justify-end">
                      <span className="font-mono text-[10px] text-slate-600">{hrs.toFixed(1)}</span>
                      <div className="w-full bg-slate-100 rounded-sm h-14 flex items-end overflow-hidden">
                        <div
                          className={`w-full rounded-sm ${
                            hrs >= 10
                              ? 'bg-emerald-600'
                              : hrs >= 7
                                ? 'bg-amber-500'
                                : 'bg-red-600'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500">{DAY_LABELS[idx]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Fault Summary */}
            {selectedFeeder.faultSummary && (
              <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
                <span className="font-semibold text-slate-900">Feeder Note: </span>
                {selectedFeeder.faultSummary}
                {selectedTicket && (
                  <div className="font-mono text-[11px] text-slate-500 mt-1">
                    {selectedTicket.id} · Status: {selectedTicket.status} · Created {selectedTicket.createdAt}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Operational Actions */}
          <div className="pt-4 mt-4 border-t border-slate-200 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSimulateCrowdReport(selectedFeeder.id)}
              className="px-3 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Simulate USSD Report</span>
            </button>

            {selectedTicket && selectedTicket.status === 'OPEN' && (
              <button
                type="button"
                onClick={() => onDispatchCrew(selectedTicket.id)}
                className="px-3 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Dispatch EEDC Crew</span>
              </button>
            )}

            {selectedFeeder.status !== 'ON' && (
              <button
                type="button"
                onClick={() => onRestoreFeeder(selectedFeeder.id)}
                className="px-3 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Restore &amp; Send SMS</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High-Density Feeder Telemetry Ledger */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(['ALL', 'OUTAGE', 'LOAD_SHED', 'ON'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL'
                  ? 'All Feeders'
                  : st === 'OUTAGE'
                    ? 'Outage'
                    : st === 'LOAD_SHED'
                      ? 'Load Shed'
                      : 'Online'}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search feeder or transformer..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                <th className="py-2.5 px-4">Neighborhood / Feeder</th>
                <th className="py-2.5 px-4">Transformer</th>
                <th className="py-2.5 px-4">Grid Status</th>
                <th className="py-2.5 px-4 text-right">7d Uptime</th>
                <th className="py-2.5 px-4 text-right">Load (MW)</th>
                <th className="py-2.5 px-4 text-right">Reports</th>
                <th className="py-2.5 px-4">Fast-Dial Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredFeeders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No feeders match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFeeders.map((f, idx) => {
                  const feederNum = feeders.findIndex((item) => item.id === f.id) + 1;
                  const isSelected = f.id === selectedFeeder.id;
                  return (
                    <tr
                      key={f.id}
                      onClick={() => setSelectedFeederId(f.id)}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{f.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{f.code}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{f.transformerId}</td>
                      <td className={`py-2.5 px-4 font-semibold ${getStatusTextColor(f.status)}`}>
                        {getStatusLabel(f.status)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-900">
                        {f.weeklyUptimeHours.toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {f.loadMw.toFixed(1)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-700">
                        {f.activeFaultReports}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-emerald-700">
                        *347*88*2*{feederNum}#
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
