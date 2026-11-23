import React, { useState } from 'react';
import {
  Map,
  Smartphone,
  GitBranch,
  ShieldCheck,
  Menu,
  X,
} from 'lucide-react';
import {
  FaultTicket,
  FeederNode,
  INITIAL_FEEDERS,
  INITIAL_SMS_INBOX,
  INITIAL_TICKETS,
  SUBSCRIBER_PROFILES,
  SmsMessage,
  SubscriberProfile,
  analyzeGsm7,
} from './data/ussdData';
import { AwkaHeatmap } from './components/AwkaHeatmap';
import { DroppedSessionState, PhoneEmulator } from './components/PhoneEmulator';
import { MenuTreeAudit } from './components/MenuTreeAudit';
import { GatewayEvent, ResilienceArchitecture } from './components/ResilienceArchitecture';

type WorkspaceTab = 'HEATMAP' | 'SIMULATOR' | 'AUDIT' | 'RESILIENCE';

const NAV_ITEMS: { id: WorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'HEATMAP', label: 'Outage Heatmap', icon: Map },
  { id: 'SIMULATOR', label: '*347*88# Phone', icon: Smartphone },
  { id: 'AUDIT', label: 'Menu & GSM-7 Audit', icon: GitBranch },
  { id: 'RESILIENCE', label: 'Offline Resilience', icon: ShieldCheck },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('HEATMAP');
  const [mobileNavOpen, setMobileNavOpen] = useState<boolean>(false);
  const [feeders, setFeeders] = useState<FeederNode[]>(INITIAL_FEEDERS);
  const [tickets, setTickets] = useState<FaultTicket[]>(INITIAL_TICKETS);
  const [profiles, setProfiles] = useState<SubscriberProfile[]>(SUBSCRIBER_PROFILES);
  const [activeMsisdn, setActiveMsisdn] = useState<string>(SUBSCRIBER_PROFILES[0].msisdn);
  const [smsInbox, setSmsInbox] = useState<SmsMessage[]>(INITIAL_SMS_INBOX);
  const [droppedSession, setDroppedSession] = useState<DroppedSessionState | null>(null);
  const [paygRevenueNgn, setPaygRevenueNgn] = useState<number>(148500);
  const [lastBanner, setLastBanner] = useState<string | null>(null);
  const [events, setEvents] = useState<GatewayEvent[]>([
    {
      id: 'ev-init-1',
      timestamp: '09:14 WAT',
      category: 'DEDUP_MERGE',
      summary: '23 Eke Awka fault reports merged to TKT-412',
      detail: '15m sliding window prevented 22 duplicate EEDC dispatch tickets on TX-EKE-021',
    },
    {
      id: 'ev-init-2',
      timestamp: '08:40 WAT',
      category: 'WEBHOOK_PAYG',
      summary: 'OPay webhook settled N250 (PAY-8804)',
      detail: 'OpenPAYGO token 482-910-374 dispatched via SMPP to 08034128891',
    },
  ]);

  const activeProfile =
    profiles.find((p) => p.msisdn === activeMsisdn) || profiles[0];

  const showNotice = (msg: string) => {
    setLastBanner(msg);
    setTimeout(() => {
      setLastBanner((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const handleLogEvent = (category: string, summary: string, detail: string) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WAT`;
    setEvents((prev) => [
      {
        id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: ts,
        category,
        summary,
        detail,
      },
      ...prev,
    ]);
  };

  const handlePushSms = (msg: Omit<SmsMessage, 'id' | 'gsm7Length'>) => {
    const metrics = analyzeGsm7(msg.body);
    setSmsInbox((prev) => [
      {
        ...msg,
        id: `sms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gsm7Length: metrics.length,
      },
      ...prev,
    ]);
  };

  const handleReportFault = (
    feederId: string,
    faultType: string,
    msisdn: string
  ): { ticketId: string; reportCount: number } => {
    const targetFeeder = feeders.find((f) => f.id === feederId) || feeders[0];
    const existing = tickets.find(
      (t) => t.feederId === feederId && t.status !== 'RESOLVED'
    );

    if (existing) {
      const nextCount = existing.reportCount + 1;
      setTickets((prev) =>
        prev.map((t) =>
          t.id === existing.id
            ? {
                ...t,
                reportCount: nextCount,
                msisdnCluster: t.msisdnCluster.includes(msisdn)
                  ? t.msisdnCluster
                  : [...t.msisdnCluster, msisdn],
              }
            : t
        )
      );
      setFeeders((prev) =>
        prev.map((f) =>
          f.id === feederId
            ? {
                ...f,
                status: 'OUTAGE',
                loadMw: 0,
                activeFaultReports: f.activeFaultReports + 1,
                deduplicatedTickets: Math.max(1, f.deduplicatedTickets),
                faultSummary: `${faultType} · ${nextCount} reports merged to ${existing.id}.`,
              }
            : f
        )
      );
      handleLogEvent(
        'DEDUP_MERGE',
        `Merged ${msisdn} report into ${existing.id} (${targetFeeder.shortName})`,
        `15m window deduplication: ${nextCount} trader reports consolidated into 1 EEDC ticket`
      );
      showNotice(`Merged report into ${existing.id} (${targetFeeder.shortName}) and sent SMS confirmation.`);
      return { ticketId: existing.id, reportCount: nextCount };
    }

    const newTicketId = `TKT-${Math.floor(415 + Math.random() * 500)}`;
    const now = new Date();
    const createdAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WAT`;

    setTickets((prev) => [
      {
        id: newTicketId,
        feederId,
        feederName: targetFeeder.name,
        faultType,
        createdAt,
        reportCount: 1,
        msisdnCluster: [msisdn],
        status: 'OPEN',
      },
      ...prev,
    ]);

    setFeeders((prev) =>
      prev.map((f) =>
        f.id === feederId
          ? {
              ...f,
              status: 'OUTAGE',
              loadMw: 0,
              activeFaultReports: f.activeFaultReports + 1,
              deduplicatedTickets: f.deduplicatedTickets + 1,
              faultSummary: `${faultType} · Active ticket ${newTicketId}.`,
            }
          : f
      )
    );

    handleLogEvent(
      'FAULT_OPENED',
      `Created ${newTicketId} for ${targetFeeder.shortName}`,
      `${faultType} reported by ${msisdn} · SMS confirmation queued`
    );
    showNotice(`Opened ${newTicketId} for ${targetFeeder.shortName}.`);
    return { ticketId: newTicketId, reportCount: 1 };
  };

  const handleDispatchCrew = (ticketId: string) => {
    setTickets((prev) =>
      prev.map((t) => (t.id === ticketId ? { ...t, status: 'CREW_DISPATCHED' } : t))
    );
    handleLogEvent('EEDC_DISPATCH', `EEDC fault crew dispatched for ${ticketId}`, 'Linesmen en route to transformer sub-pole');
    showNotice(`EEDC maintenance crew dispatched for ${ticketId}.`);
  };

  const handleRestoreFeeder = (feederId: string) => {
    const target = feeders.find((f) => f.id === feederId);
    if (!target) return;

    setFeeders((prev) =>
      prev.map((f) =>
        f.id === feederId
          ? {
              ...f,
              status: 'ON',
              loadMw: 3.2,
              activeFaultReports: 0,
              deduplicatedTickets: 0,
              lastRestored: 'Just now',
              weeklyUptimeHours: Number((f.weeklyUptimeHours + 0.5).toFixed(1)),
              faultSummary: undefined,
            }
          : f
      )
    );
    setTickets((prev) =>
      prev.map((t) => (t.feederId === feederId ? { ...t, status: 'RESOLVED' } : t))
    );

    const smsBody = `AwkaGrid Alert: Power RESTORED on ${target.shortName} (${target.code}). 7d uptime: ${(target.weeklyUptimeHours + 0.5).toFixed(1)}h. Dial *347*88*2# for log.`;
    handlePushSms({
      timestamp: 'Just now',
      sender: 'AwkaGrid',
      body: smsBody,
      tag: 'RESTORED',
    });

    handleLogEvent(
      'GRID_RESTORED',
      `${target.shortName} (${target.code}) energized`,
      `Restoration SMS broadcast queued for bound MSISDNs (${analyzeGsm7(smsBody).length}/160 GSM-7 chars)`
    );
    showNotice(`${target.shortName} restored. Asynchronous restoration SMS dispatched.`);
  };

  const handleCompletePayment = (
    planId: string,
    railId: string,
    token: string,
    amountNgn: number,
    refId: string
  ) => {
    const daysAdded = planId === '1d' ? 1 : planId === '3d' ? 3 : planId === '7d' ? 7 : 30;
    setPaygRevenueNgn((prev) => prev + amountNgn);
    setProfiles((prev) =>
      prev.map((p) =>
        p.msisdn === activeMsisdn
          ? { ...p, solarCreditDays: p.solarCreditDays + daysAdded, lastToken: token }
          : p
      )
    );
    showNotice(`Payment ${refId} settled (N${amountNgn.toLocaleString()}). OpenPAYGO token ${token} sent via SMS.`);
  };

  const handleBindFeeder = (msisdn: string, feederId: string) => {
    const target = feeders.find((f) => f.id === feederId);
    setProfiles((prev) =>
      prev.map((p) => (p.msisdn === msisdn ? { ...p, savedFeederId: feederId } : p))
    );
    handleLogEvent(
      'MSISDN_BIND',
      `Bound ${msisdn} to ${target?.shortName ?? feederId}`,
      `Edge Redis profile updated · Auto-alerts active for ${target?.code}`
    );
    showNotice(`${msisdn} auto-bound to ${target?.shortName}.`);
  };

  const onlineCount = feeders.filter((f) => f.status === 'ON').length;
  const avgUptime =
    feeders.reduce((sum, f) => sum + f.weeklyUptimeHours, 0) / feeders.length;
  const totalRawReports = feeders.reduce((sum, f) => sum + f.activeFaultReports, 0);
  const openTicketsCount = tickets.filter((t) => t.status !== 'RESOLVED').length;

  const activeTabTitle = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Overview';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Left Workspace Sidebar (250px on lg) */}
      <aside className="lg:w-[252px] lg:shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col justify-between">
        <div>
          <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
              AwkaGrid *347*88#
            </span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="lg:hidden p-2 rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Toggle navigation"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className={`${mobileNavOpen ? 'block' : 'hidden'} lg:block p-3 space-y-1`}>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Gateway Context Summary in Sidebar Footer */}
        <div className="hidden lg:block p-4 border-t border-slate-200 text-xs text-slate-600 space-y-2">
          <div>
            <div className="text-slate-400">Short Code &amp; SMS Gateway</div>
            <div className="font-mono font-semibold text-slate-900 mt-0.5">*347*88# · SMPP 34788</div>
          </div>
          <div>
            <div className="text-slate-400">Encoding Standard</div>
            <div className="font-mono text-slate-800 mt-0.5">GSM-7 (&lt;160 chars)</div>
          </div>
          <div>
            <div className="text-slate-400">Region</div>
            <div className="text-slate-800 mt-0.5">Awka, Anambra · EEDC 11kV</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: Breadcrumb on Left, Single Primary Action on Right */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
          <div className="flex items-center gap-2 text-sm text-slate-500 min-w-0 truncate">
            <span className="font-medium text-slate-900 whitespace-nowrap">AwkaGrid Console</span>
            <span aria-hidden="true">/</span>
            <span className="truncate">{activeTabTitle}</span>
          </div>

          <button
            type="button"
            onClick={() =>
              setActiveTab(activeTab === 'SIMULATOR' ? 'HEATMAP' : 'SIMULATOR')
            }
            className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {activeTab === 'SIMULATOR' ? 'View Outage Heatmap' : 'Test *347*88# Phone'}
          </button>
        </header>

        <main className="flex-1 p-6 max-w-[1280px] w-full mx-auto space-y-6">
          {/* Action Feedback Notice */}
          {lastBanner && (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-900 flex items-center justify-between gap-4">
              <span>{lastBanner}</span>
              <button
                type="button"
                onClick={() => setLastBanner(null)}
                className="text-emerald-700 hover:text-emerald-950 font-mono"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* 4-Column KPI Strip (Tabular Figures, Single Elevation) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">EEDC Feeders Online</div>
              <div className="font-mono text-2xl font-semibold text-slate-900 mt-1">
                {onlineCount} / {feeders.length}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {feeders.filter((f) => f.status === 'OUTAGE').length} outage ·{' '}
                {feeders.filter((f) => f.status === 'LOAD_SHED').length} load shed
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Avg 7-Day Feeder Uptime</div>
              <div className="font-mono text-2xl font-semibold text-slate-900 mt-1">
                {avgUptime.toFixed(1)}h
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Out of 168.0h weekly window
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Fault Deduplication</div>
              <div className="font-mono text-2xl font-semibold text-slate-900 mt-1">
                {totalRawReports} &rarr; {openTicketsCount}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Raw USSD reports to active tickets
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="text-xs text-slate-500">Solar PAYG Volume (7d)</div>
              <div className="font-mono text-2xl font-semibold text-slate-900 mt-1">
                N{paygRevenueNgn.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                OPay, PalmPay, Moniepoint &amp; Bank USSD
              </div>
            </div>
          </div>

          {/* Active Workspace View */}
          {activeTab === 'HEATMAP' && (
            <AwkaHeatmap
              feeders={feeders}
              tickets={tickets}
              onSimulateCrowdReport={(feederId) => {
                handleReportFault(feederId, 'Feeder Off / No Light', activeMsisdn);
              }}
              onDispatchCrew={handleDispatchCrew}
              onRestoreFeeder={handleRestoreFeeder}
            />
          )}

          {activeTab === 'SIMULATOR' && (
            <PhoneEmulator
              feeders={feeders}
              activeProfile={activeProfile}
              profiles={profiles}
              onSelectProfile={setActiveMsisdn}
              onReportFault={handleReportFault}
              onCompletePayment={handleCompletePayment}
              onBindFeeder={handleBindFeeder}
              smsInbox={smsInbox}
              onPushSms={handlePushSms}
              onLogEvent={handleLogEvent}
              droppedSession={droppedSession}
              onSetDroppedSession={setDroppedSession}
            />
          )}

          {activeTab === 'AUDIT' && <MenuTreeAudit />}

          {activeTab === 'RESILIENCE' && (
            <ResilienceArchitecture
              events={events}
              profiles={profiles}
              onTestWebhookToken={(meterId, days, railName, token) => {
                const planPrice = days === 1 ? 250 : days === 3 ? 700 : days === 7 ? 1500 : 5800;
                const refId = `PAY-${Math.floor(1000 + Math.random() * 8999)}`;
                setPaygRevenueNgn((prev) => prev + planPrice);
                const smsBody = `AwkaGrid PAYG: N${planPrice.toLocaleString()} paid via ${railName}. Token ${token} for ${meterId} (${days}d). Ref: ${refId}`;
                handlePushSms({
                  timestamp: 'Just now',
                  sender: 'AwkaGrid',
                  body: smsBody,
                  tag: 'PAYG_TOKEN',
                });
                handleLogEvent(
                  'WEBHOOK_PAYG',
                  `${railName} webhook simulated (${refId})`,
                  `OpenPAYGO token ${token} generated for ${meterId} (${analyzeGsm7(smsBody).length}/160 GSM-7 chars)`
                );
                showNotice(`OpenPAYGO token ${token} generated and queued to SMS inbox.`);
              }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
