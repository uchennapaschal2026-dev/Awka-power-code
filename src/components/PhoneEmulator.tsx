import React, { useState, useEffect } from 'react';
import {
  Phone,
  PhoneOff,
  MessageSquare,
  Signal,
  Battery,
  RotateCcw,
  WifiOff,
  Send,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import {
  FeederNode,
  PAYG_PLANS,
  PAYMENT_RAILS,
  SubscriberProfile,
  SmsMessage,
  analyzeGsm7,
  generateOpenPaygoToken,
} from '../data/ussdData';

export interface DroppedSessionState {
  refId: string;
  planId: string;
  railId: string;
  amountNgn: number;
  msisdn: string;
  createdAt: string;
}

interface PhoneEmulatorProps {
  feeders: FeederNode[];
  activeProfile: SubscriberProfile;
  profiles: SubscriberProfile[];
  onSelectProfile: (msisdn: string) => void;
  onReportFault: (feederId: string, faultType: string, msisdn: string) => { ticketId: string; reportCount: number };
  onCompletePayment: (planId: string, railId: string, token: string, amountNgn: number, refId: string) => void;
  onBindFeeder: (msisdn: string, feederId: string) => void;
  smsInbox: SmsMessage[];
  onPushSms: (msg: Omit<SmsMessage, 'id' | 'gsm7Length'>) => void;
  onLogEvent: (category: string, summary: string, detail: string) => void;
  droppedSession: DroppedSessionState | null;
  onSetDroppedSession: (session: DroppedSessionState | null) => void;
}

type ScreenId =
  | 'IDLE'
  | 'ROOT'
  | 'REPORT_FEEDER'
  | 'REPORT_TYPE'
  | 'REPORT_CONFIRM'
  | 'UPTIME_FEEDER'
  | 'UPTIME_DETAIL'
  | 'PAYG_PLAN'
  | 'PAYG_RAIL'
  | 'PAYG_BANK'
  | 'PAYG_CONFIRMED'
  | 'BIND_FEEDER'
  | 'BIND_SAVED'
  | 'RESUME_DROPPED'
  | 'ERROR';

const FAULT_TYPES = [
  'Feeder Off / No Light',
  'Transformer Spark/Oil',
  'Fallen Pole / Wire',
  'Low Voltage',
];

const FAST_DIAL_SHORTCUTS = [
  { label: 'Main Menu', code: '*347*88#' },
  { label: 'Report Fault', code: '*347*88*1#' },
  { label: '7d Uptime', code: '*347*88*2#' },
  { label: '1d Solar N250', code: '*347*88*3*1#' },
  { label: 'Resume Drop', code: '*347*88*9#' },
];

export const PhoneEmulator: React.FC<PhoneEmulatorProps> = ({
  feeders,
  activeProfile,
  profiles,
  onSelectProfile,
  onReportFault,
  onCompletePayment,
  onBindFeeder,
  smsInbox,
  onPushSms,
  onLogEvent,
  droppedSession,
  onSetDroppedSession,
}) => {
  const [phoneTab, setPhoneTab] = useState<'USSD' | 'SMS'>('USSD');
  const [dialBuffer, setDialBuffer] = useState<string>('*347*88#');
  const [inputBuffer, setInputBuffer] = useState<string>('');
  const [screenId, setScreenId] = useState<ScreenId>('IDLE');
  const [selectedFeederId, setSelectedFeederId] = useState<string>(activeProfile.savedFeederId);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('1d');
  const [selectedRailId, setSelectedRailId] = useState<string>('opay');
  const [lastFaultResult, setLastFaultResult] = useState<{ ticketId: string; count: number; feederName: string } | null>(null);
  const [lastPayRef, setLastPayRef] = useState<string>('PAY-9921');
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number>(45);
  const [moSmsText, setMoSmsText] = useState<string>('PAY 1');
  const [selectedSmsId, setSelectedSmsId] = useState<string | null>(null);

  useEffect(() => {
    setSelectedFeederId(activeProfile.savedFeederId);
  }, [activeProfile.savedFeederId]);

  // Countdown USSD 45s 2G radio timeout when session active
  useEffect(() => {
    if (screenId === 'IDLE' || screenId === 'ERROR') return;
    setSessionSecondsLeft(45);
    const timer = setInterval(() => {
      setSessionSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [screenId]);

  const savedFeeder = feeders.find((f) => f.id === activeProfile.savedFeederId) || feeders[0];
  const inspectedFeeder = feeders.find((f) => f.id === selectedFeederId) || savedFeeder;
  const activePlan = PAYG_PLANS.find((p) => p.id === selectedPlanId) || PAYG_PLANS[0];
  const activeRail = PAYMENT_RAILS.find((r) => r.id === selectedRailId) || PAYMENT_RAILS[0];

  const getCurrentScreenText = (): { text: string; sessionType: 'CON' | 'END' | 'IDLE'; fastDial: string } => {
    const savedIndex = feeders.findIndex((f) => f.id === activeProfile.savedFeederId);
    const feederListLines = feeders
      .map((f, idx) => `${idx + 1}. ${f.shortName}${idx === savedIndex ? ' (Saved)' : ''}`)
      .join('\n');

    switch (screenId) {
      case 'IDLE':
        return {
          text: `MTN NG · 2G GSM\n${activeProfile.msisdn}\n\nDial *347*88# or enter fast-dial code below and press Call.`,
          sessionType: 'IDLE',
          fastDial: dialBuffer || '*347*88#',
        };
      case 'ROOT':
        return {
          text: `AwkaGrid *347*88#\nSaved: ${savedFeeder.shortName} | ${activeProfile.solarMeterId}\n1. Report Outage/Fault\n2. 7-Day Feeder Uptime\n3. Solar PAYG (N250+)\n4. Change Feeder/Meter\n0. Exit`,
          sessionType: 'CON',
          fastDial: '*347*88#',
        };
      case 'REPORT_FEEDER':
        return {
          text: `Report Fault - Feeder:\n${feederListLines}\n0. Back`,
          sessionType: 'CON',
          fastDial: '*347*88*1#',
        };
      case 'REPORT_TYPE':
        return {
          text: `${inspectedFeeder.shortName} Fault Type:\n1. Feeder Off / No Light\n2. Transformer Spark/Oil\n3. Fallen Pole / Wire\n4. Low Voltage\n0. Back`,
          sessionType: 'CON',
          fastDial: `*347*88*1*${feeders.findIndex((f) => f.id === inspectedFeeder.id) + 1}#`,
        };
      case 'REPORT_CONFIRM':
        return {
          text: `Logged: ${lastFaultResult?.feederName ?? inspectedFeeder.shortName} (${lastFaultResult?.ticketId ?? 'TKT-412'}).\n${lastFaultResult?.count ?? 1} trader reports merged in 15m. EEDC notified.\nSMS ticket sent.`,
          sessionType: 'END',
          fastDial: `*347*88*1*${feeders.findIndex((f) => f.id === inspectedFeeder.id) + 1}*1#`,
        };
      case 'UPTIME_FEEDER':
        return {
          text: `Grid Status & 7d Uptime:\n${feederListLines}\n0. Back`,
          sessionType: 'CON',
          fastDial: '*347*88*2#',
        };
      case 'UPTIME_DETAIL': {
        const statusLabel =
          inspectedFeeder.status === 'ON'
            ? 'ON'
            : inspectedFeeder.status === 'LOAD_SHED'
              ? 'LOAD SHED'
              : 'OUTAGE';
        return {
          text: `${inspectedFeeder.code}: ${statusLabel}\n7-Day Uptime: ${inspectedFeeder.weeklyUptimeHours.toFixed(1)}h / 168h\nLast ON: ${inspectedFeeder.lastRestored}\nReports: ${inspectedFeeder.activeFaultReports} active\nDial *347*88# for menu`,
          sessionType: 'END',
          fastDial: `*347*88*2*${feeders.findIndex((f) => f.id === inspectedFeeder.id) + 1}#`,
        };
      }
      case 'PAYG_PLAN':
        return {
          text: `Solar PAYG (${activeProfile.solarMeterId}):\n1. 1 Day Basic - N250\n2. 3 Days Market - N700\n3. 7 Days Stall - N1,500\n4. 30 Days Home - N5,800\n0. Back`,
          sessionType: 'CON',
          fastDial: '*347*88*3#',
        };
      case 'PAYG_RAIL':
        return {
          text: `Pay N${activePlan.priceNgn.toLocaleString()} (${activePlan.name}):\n1. OPay Wallet\n2. PalmPay Wallet\n3. Moniepoint (N10 fee)\n4. Bank USSD (*737#/*901#)\n0. Back`,
          sessionType: 'CON',
          fastDial: activePlan.fastDial,
        };
      case 'PAYG_BANK':
        return {
          text: `Select Bank (N${activePlan.priceNgn.toLocaleString()}+N20 fee):\n1. GTBank (*737#)\n2. Access (*901#)\n3. Zenith (*966#)\n4. FirstBank (*894#)\n0. Back`,
          sessionType: 'CON',
          fastDial: `${activePlan.fastDial.slice(0, -1)}*4#`,
        };
      case 'PAYG_CONFIRMED': {
        const total = activePlan.priceNgn + activeRail.feeNgn;
        return {
          text: `${activeRail.shortName} push sent for N${total.toLocaleString()}.\nEnter PIN on prompt.\nOpenPAYGO token for ${activeProfile.solarMeterId} arrives by SMS.\nRef: ${lastPayRef}`,
          sessionType: 'END',
          fastDial: `${activePlan.fastDial.slice(0, -1)}*${activeRail.code}#`,
        };
      }
      case 'BIND_FEEDER':
        return {
          text: `Link ${activeProfile.msisdn} Feeder:\n${feeders
            .map((f, idx) => `${idx + 1}. ${f.shortName}`)
            .join('\n')}\n0. Back`,
          sessionType: 'CON',
          fastDial: '*347*88*4#',
        };
      case 'BIND_SAVED':
        return {
          text: `Saved! ${activeProfile.msisdn} linked to ${inspectedFeeder.shortName} (${inspectedFeeder.code}) & ${activeProfile.solarMeterId}.\nSMS alerts active.`,
          sessionType: 'END',
          fastDial: `*347*88*4*${feeders.findIndex((f) => f.id === inspectedFeeder.id) + 1}#`,
        };
      case 'RESUME_DROPPED':
        if (!droppedSession) {
          return {
            text: `No dropped payment session found for ${activeProfile.msisdn}.\nDial *347*88# for main menu.`,
            sessionType: 'END',
            fastDial: '*347*88*9#',
          };
        }
        return {
          text: `Resume ${droppedSession.refId}:\nN${droppedSession.amountNgn.toLocaleString()} Solar PAYG\n1. Confirm & Send Push\n2. Cancel Session\n0. Main Menu`,
          sessionType: 'CON',
          fastDial: '*347*88*9#',
        };
      case 'ERROR':
        return {
          text: `Invalid MMI or option.\nDial *347*88# to restart AwkaGrid USSD session.`,
          sessionType: 'END',
          fastDial: dialBuffer,
        };
    }
  };

  const screenInfo = getCurrentScreenText();
  const gsmAnalysis = analyzeGsm7(screenInfo.text);

  const finalizePayment = (planId: string, railId: string, refIdOverride?: string) => {
    const plan = PAYG_PLANS.find((p) => p.id === planId) || PAYG_PLANS[0];
    const rail = PAYMENT_RAILS.find((r) => r.id === railId) || PAYMENT_RAILS[0];
    const refId = refIdOverride || `PAY-${Math.floor(1000 + Math.random() * 8999)}`;
    const total = plan.priceNgn + rail.feeNgn;
    const token = generateOpenPaygoToken(activeProfile.solarMeterId, plan.days, Date.now() % 10000);
    setLastPayRef(refId);
    onCompletePayment(plan.id, rail.id, token, total, refId);
    onLogEvent(
      'WEBHOOK_PAYG',
      `${rail.shortName} webhook verified (${refId})`,
      `N${total.toLocaleString()} settled · OpenPAYGO token ${token} queued via SMPP to ${activeProfile.msisdn}`
    );
    setTimeout(() => {
      onPushSms({
        timestamp: 'Just now',
        sender: 'AwkaGrid',
        body: `AwkaGrid PAYG: N${total.toLocaleString()} paid via ${rail.shortName}. Token ${token} for ${activeProfile.solarMeterId} (${plan.days}d). Ref: ${refId}`,
        tag: 'PAYG_TOKEN',
      });
    }, 550);
  };

  const executeFastDial = (rawCode: string) => {
    const clean = rawCode.trim();
    setPhoneTab('USSD');
    setInputBuffer('');
    if (!clean.startsWith('*347*88') || !clean.endsWith('#')) {
      setScreenId('ERROR');
      return;
    }

    const inner = clean.slice('*347*88'.length, -1); // e.g. "" or "*3*1"
    const parts = inner.split('*').filter(Boolean);

    onLogEvent('USSD_DIAL', `Dialed ${clean}`, `MSISDN ${activeProfile.msisdn} auto-bound to ${savedFeeder.shortName}`);

    if (parts.length === 0) {
      setScreenId('ROOT');
      return;
    }

    const [b1, b2, b3, b4] = parts;

    if (b1 === '1') {
      if (!b2) {
        setScreenId('REPORT_FEEDER');
        return;
      }
      const fIdx = Number(b2) - 1;
      const targetFeeder = feeders[fIdx];
      if (!targetFeeder) {
        setScreenId('ERROR');
        return;
      }
      setSelectedFeederId(targetFeeder.id);
      if (!b3) {
        setScreenId('REPORT_TYPE');
        return;
      }
      const ftIdx = Number(b3) - 1;
      const faultLabel = FAULT_TYPES[ftIdx];
      if (!faultLabel) {
        setScreenId('ERROR');
        return;
      }
      const res = onReportFault(targetFeeder.id, faultLabel, activeProfile.msisdn);
      setLastFaultResult({ ticketId: res.ticketId, count: res.reportCount, feederName: targetFeeder.shortName });
      onPushSms({
        timestamp: 'Just now',
        sender: 'AwkaGrid',
        body: `AwkaGrid: ${targetFeeder.shortName} fault logged (${res.ticketId}). ${res.reportCount} reports merged. EEDC alerted. Status: *347*88*2*${fIdx + 1}#`,
        tag: 'FAULT',
      });
      setScreenId('REPORT_CONFIRM');
      return;
    }

    if (b1 === '2') {
      if (!b2) {
        setScreenId('UPTIME_FEEDER');
        return;
      }
      const fIdx = Number(b2) - 1;
      const targetFeeder = feeders[fIdx];
      if (!targetFeeder) {
        setScreenId('ERROR');
        return;
      }
      setSelectedFeederId(targetFeeder.id);
      setScreenId('UPTIME_DETAIL');
      return;
    }

    if (b1 === '3') {
      if (!b2) {
        setScreenId('PAYG_PLAN');
        return;
      }
      const plan = PAYG_PLANS[Number(b2) - 1];
      if (!plan) {
        setScreenId('ERROR');
        return;
      }
      setSelectedPlanId(plan.id);
      if (!b3) {
        setScreenId('PAYG_RAIL');
        return;
      }
      if (b3 === '4') {
        if (!b4) {
          setScreenId('PAYG_BANK');
          return;
        }
        const bank = PAYMENT_RAILS.filter((r) => r.type === 'BANK_USSD')[Number(b4) - 1];
        if (!bank) {
          setScreenId('ERROR');
          return;
        }
        setSelectedRailId(bank.id);
        finalizePayment(plan.id, bank.id);
        setScreenId('PAYG_CONFIRMED');
        return;
      }
      const wallet = PAYMENT_RAILS.filter((r) => r.type === 'WALLET')[Number(b3) - 1];
      if (!wallet) {
        setScreenId('ERROR');
        return;
      }
      setSelectedRailId(wallet.id);
      finalizePayment(plan.id, wallet.id);
      setScreenId('PAYG_CONFIRMED');
      return;
    }

    if (b1 === '4') {
      if (!b2) {
        setScreenId('BIND_FEEDER');
        return;
      }
      const targetFeeder = feeders[Number(b2) - 1];
      if (!targetFeeder) {
        setScreenId('ERROR');
        return;
      }
      setSelectedFeederId(targetFeeder.id);
      onBindFeeder(activeProfile.msisdn, targetFeeder.id);
      onPushSms({
        timestamp: 'Just now',
        sender: 'AwkaGrid',
        body: `AwkaGrid: ${activeProfile.msisdn} linked to ${targetFeeder.shortName} (${targetFeeder.code}) & ${activeProfile.solarMeterId}. Alerts ON.`,
        tag: 'BINDING',
      });
      setScreenId('BIND_SAVED');
      return;
    }

    if (b1 === '9') {
      setScreenId('RESUME_DROPPED');
      return;
    }

    setScreenId('ERROR');
  };

  const handleUssdOptionSubmit = (value: string) => {
    const choice = value.trim();
    setInputBuffer('');
    if (!choice) return;

    if (screenId === 'IDLE') {
      executeFastDial(choice);
      return;
    }

    if (screenId === 'ROOT') {
      if (choice === '1') setScreenId('REPORT_FEEDER');
      else if (choice === '2') setScreenId('UPTIME_FEEDER');
      else if (choice === '3') setScreenId('PAYG_PLAN');
      else if (choice === '4') setScreenId('BIND_FEEDER');
      else if (choice === '0') setScreenId('IDLE');
      return;
    }

    if (screenId === 'REPORT_FEEDER') {
      if (choice === '0') {
        setScreenId('ROOT');
        return;
      }
      const f = feeders[Number(choice) - 1];
      if (f) {
        setSelectedFeederId(f.id);
        setScreenId('REPORT_TYPE');
      }
      return;
    }

    if (screenId === 'REPORT_TYPE') {
      if (choice === '0') {
        setScreenId('REPORT_FEEDER');
        return;
      }
      const faultLabel = FAULT_TYPES[Number(choice) - 1];
      if (faultLabel) {
        const fIdx = feeders.findIndex((f) => f.id === inspectedFeeder.id);
        const res = onReportFault(inspectedFeeder.id, faultLabel, activeProfile.msisdn);
        setLastFaultResult({ ticketId: res.ticketId, count: res.reportCount, feederName: inspectedFeeder.shortName });
        onPushSms({
          timestamp: 'Just now',
          sender: 'AwkaGrid',
          body: `AwkaGrid: ${inspectedFeeder.shortName} fault logged (${res.ticketId}). ${res.reportCount} reports merged. EEDC alerted. Status: *347*88*2*${fIdx + 1}#`,
          tag: 'FAULT',
        });
        setScreenId('REPORT_CONFIRM');
      }
      return;
    }

    if (screenId === 'UPTIME_FEEDER') {
      if (choice === '0') {
        setScreenId('ROOT');
        return;
      }
      const f = feeders[Number(choice) - 1];
      if (f) {
        setSelectedFeederId(f.id);
        setScreenId('UPTIME_DETAIL');
      }
      return;
    }

    if (screenId === 'PAYG_PLAN') {
      if (choice === '0') {
        setScreenId('ROOT');
        return;
      }
      const plan = PAYG_PLANS[Number(choice) - 1];
      if (plan) {
        setSelectedPlanId(plan.id);
        setScreenId('PAYG_RAIL');
      }
      return;
    }

    if (screenId === 'PAYG_RAIL') {
      if (choice === '0') {
        setScreenId('PAYG_PLAN');
        return;
      }
      if (choice === '4') {
        setScreenId('PAYG_BANK');
        return;
      }
      const wallet = PAYMENT_RAILS.filter((r) => r.type === 'WALLET')[Number(choice) - 1];
      if (wallet) {
        setSelectedRailId(wallet.id);
        finalizePayment(activePlan.id, wallet.id);
        setScreenId('PAYG_CONFIRMED');
      }
      return;
    }

    if (screenId === 'PAYG_BANK') {
      if (choice === '0') {
        setScreenId('PAYG_RAIL');
        return;
      }
      const bank = PAYMENT_RAILS.filter((r) => r.type === 'BANK_USSD')[Number(choice) - 1];
      if (bank) {
        setSelectedRailId(bank.id);
        finalizePayment(activePlan.id, bank.id);
        setScreenId('PAYG_CONFIRMED');
      }
      return;
    }

    if (screenId === 'BIND_FEEDER') {
      if (choice === '0') {
        setScreenId('ROOT');
        return;
      }
      const f = feeders[Number(choice) - 1];
      if (f) {
        setSelectedFeederId(f.id);
        onBindFeeder(activeProfile.msisdn, f.id);
        onPushSms({
          timestamp: 'Just now',
          sender: 'AwkaGrid',
          body: `AwkaGrid: ${activeProfile.msisdn} linked to ${f.shortName} (${f.code}) & ${activeProfile.solarMeterId}. Alerts ON.`,
          tag: 'BINDING',
        });
        setScreenId('BIND_SAVED');
      }
      return;
    }

    if (screenId === 'RESUME_DROPPED') {
      if (choice === '1' && droppedSession) {
        finalizePayment(droppedSession.planId, droppedSession.railId, droppedSession.refId);
        onSetDroppedSession(null);
        setScreenId('PAYG_CONFIRMED');
      } else if (choice === '2') {
        onSetDroppedSession(null);
        setScreenId('IDLE');
      } else if (choice === '0') {
        setScreenId('ROOT');
      }
      return;
    }

    // END screens reset to IDLE
    setScreenId('IDLE');
  };

  const handleSimulateSessionDrop = () => {
    const refId = `PAY-${Math.floor(1000 + Math.random() * 8999)}`;
    const plan = activePlan;
    const rail = activeRail;
    const total = plan.priceNgn + rail.feeNgn;

    const pending: DroppedSessionState = {
      refId,
      planId: plan.id,
      railId: rail.id,
      amountNgn: total,
      msisdn: activeProfile.msisdn,
      createdAt: 'Just now',
    };
    onSetDroppedSession(pending);
    setScreenId('IDLE');
    setInputBuffer('');

    onLogEvent(
      'SESSION_DROP',
      `2G USSD radio drop mid-checkout (${refId})`,
      `Session state persisted in Redis (15m TTL). Auto-triggered SMS fallback to ${activeProfile.msisdn}.`
    );

    onPushSms({
      timestamp: 'Just now',
      sender: 'AwkaGrid',
      body: `AwkaGrid: Your N${total.toLocaleString()} ${rail.shortName} session dropped. Dial *347*88*9# in 15m to resume ${refId} or reply PAY 1.`,
      tag: 'FALLBACK',
    });
    setPhoneTab('SMS');
  };

  const handleSendMoSms = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = moSmsText.trim().toUpperCase();
    if (!cmd) return;

    if (cmd.startsWith('PAY')) {
      const planCode = cmd.split(/\s+/)[1] || '1';
      const plan = PAYG_PLANS.find((p) => p.code === planCode) || PAYG_PLANS[0];
      const refId = droppedSession?.refId || `PAY-${Math.floor(1000 + Math.random() * 8999)}`;
      onSetDroppedSession(null);
      finalizePayment(plan.id, 'opay', refId);
      onLogEvent('MO_SMS_RECOVERY', `Inbound SMS "${cmd}" processed`, `Recovered/executed ${plan.name} via SMS fallback for ${activeProfile.msisdn}.`);
    } else if (cmd.startsWith('FAULT')) {
      const res = onReportFault(savedFeeder.id, 'No Power / Feeder Off (MO SMS)', activeProfile.msisdn);
      onPushSms({
        timestamp: 'Just now',
        sender: 'AwkaGrid',
        body: `AwkaGrid: ${savedFeeder.shortName} fault logged (${res.ticketId}). ${res.reportCount} reports merged. EEDC alerted.`,
        tag: 'FAULT',
      });
    }
    setMoSmsText('');
  };

  const handleKeypadPress = (key: string) => {
    if (phoneTab !== 'USSD') setPhoneTab('USSD');
    if (screenId === 'IDLE') {
      setDialBuffer((prev) => (prev.length < 22 ? prev + key : prev));
    } else if (screenInfo.sessionType === 'CON') {
      setInputBuffer((prev) => (prev.length < 4 ? prev + key : prev));
    }
  };

  const isInPaygCheckout = screenId === 'PAYG_RAIL' || screenId === 'PAYG_BANK' || screenId === 'PAYG_PLAN';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Feature Phone Hardware Emulator */}
      <div className="lg:col-span-5 flex flex-col items-center">
        {/* Subscriber Auto-Bind Selector */}
        <div className="w-full max-w-[360px] mb-4 bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label htmlFor="msisdn-select" className="text-xs font-medium text-slate-600">
              Caller MSISDN (Auto-Bound Profile)
            </label>
            <span className="font-mono text-xs text-emerald-700">{activeProfile.solarCreditDays}d solar left</span>
          </div>
          <select
            id="msisdn-select"
            value={activeProfile.msisdn}
            onChange={(e) => {
              onSelectProfile(e.target.value);
              setScreenId('IDLE');
              setInputBuffer('');
            }}
            className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {profiles.map((p) => {
              const f = feeders.find((fd) => fd.id === p.savedFeederId);
              return (
                <option key={p.msisdn} value={p.msisdn}>
                  {p.msisdn} · {p.name} ({f?.shortName})
                </option>
              );
            })}
          </select>
        </div>

        {/* 2G Feature Phone Casing */}
        <div className="w-full max-w-[360px] bg-slate-900 rounded-3xl p-4 border border-slate-700 shadow-sm text-slate-100">
          {/* Speaker Grille & Brand */}
          <div className="flex items-center justify-between px-2 pb-3">
            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <Signal className="w-3.5 h-3.5 text-emerald-400" />
              <span>MTN 2G</span>
            </div>
            <div className="w-14 h-1.5 bg-slate-800 rounded-full border border-slate-700" />
            <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
              <span>84%</span>
              <Battery className="w-3.5 h-3.5 text-slate-300" />
            </div>
          </div>

          {/* LCD Screen */}
          <div className="bg-[#DCE6D5] text-slate-900 rounded-lg border-2 border-slate-700 p-3 min-h-[248px] flex flex-col justify-between font-mono">
            {/* LCD Top Bar */}
            <div className="flex items-center justify-between text-[11px] border-b border-slate-900/15 pb-1 mb-2">
              <span className="font-semibold">
                {phoneTab === 'USSD'
                  ? screenId === 'IDLE'
                    ? 'STANDBY'
                    : `USSD ${screenInfo.sessionType}`
                  : `SMS INBOX (${smsInbox.length})`}
              </span>
              {phoneTab === 'USSD' && screenId !== 'IDLE' && (
                <span className={sessionSecondsLeft <= 10 ? 'text-red-700 font-semibold' : 'text-slate-700'}>
                  TTL {sessionSecondsLeft}s
                </span>
              )}
              {phoneTab === 'SMS' && <span className="text-slate-700">34788</span>}
            </div>

            {/* LCD Body */}
            {phoneTab === 'USSD' ? (
              <div className="flex-1 flex flex-col justify-between">
                <pre className="whitespace-pre-wrap text-[12px] leading-[1.4] font-mono text-slate-950">
                  {screenInfo.text}
                </pre>

                {screenId === 'IDLE' ? (
                  <div className="mt-3 pt-2 border-t border-slate-900/15">
                    <div className="text-[10px] text-slate-700 mb-0.5">Dial string:</div>
                    <div className="bg-white/60 border border-slate-900/20 rounded px-2 py-1 text-sm font-semibold tracking-wide min-h-[28px] flex items-center justify-between">
                      <span>{dialBuffer || ' '}</span>
                      {dialBuffer && (
                        <button
                          type="button"
                          onClick={() => setDialBuffer('')}
                          className="text-[10px] text-slate-600 hover:text-slate-950 px-1"
                        >
                          CLR
                        </button>
                      )}
                    </div>
                  </div>
                ) : screenInfo.sessionType === 'CON' ? (
                  <div className="mt-3 pt-2 border-t border-slate-900/15">
                    <div className="flex items-center justify-between gap-2 bg-white/60 border border-slate-900/20 rounded px-2 py-1">
                      <span className="text-[11px] text-slate-600">Reply:</span>
                      <input
                        type="text"
                        value={inputBuffer}
                        onChange={(e) => setInputBuffer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUssdOptionSubmit(inputBuffer);
                        }}
                        placeholder="1-9 or 0"
                        className="w-full bg-transparent text-xs font-semibold text-slate-950 focus:outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pt-2 border-t border-slate-900/15 flex items-center justify-between text-[11px] text-slate-700">
                    <span>Session ended</span>
                    <button
                      type="button"
                      onClick={() => setScreenId('ROOT')}
                      className="underline font-semibold text-slate-900"
                    >
                      Main Menu
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col gap-2 max-h-[195px] overflow-y-auto pr-1">
                {smsInbox.map((sms) => {
                  const isSelected = selectedSmsId === sms.id;
                  return (
                    <button
                      key={sms.id}
                      type="button"
                      onClick={() => setSelectedSmsId(isSelected ? null : sms.id)}
                      className="text-left p-1.5 rounded bg-white/55 hover:bg-white/80 border border-slate-900/15 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-700 mb-0.5">
                        <span className="font-semibold">{sms.sender} · {sms.tag}</span>
                        <span>{sms.gsm7Length}/160 · {sms.timestamp}</span>
                      </div>
                      <p className="text-[11px] leading-snug text-slate-950">
                        {sms.body}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Strict GSM-7 Character Count Bar Directly Below LCD Screen */}
          <div className="mt-2.5 px-2 py-1.5 bg-slate-800/80 rounded-md border border-slate-700 flex items-center justify-between text-[11px] font-mono">
            <span className={gsmAnalysis.underLimit && gsmAnalysis.isGsm7Safe ? 'text-emerald-400' : 'text-amber-400'}>
              {gsmAnalysis.length} / 160 chars ({gsmAnalysis.isGsm7Safe ? 'GSM-7 7-bit' : 'UCS-2 Alert'})
            </span>
            <span className="text-slate-400">
              {160 - gsmAnalysis.length} left
            </span>
          </div>

          {/* Softkeys: Switch USSD / SMS, Call, End */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                if (phoneTab === 'SMS') {
                  setPhoneTab('USSD');
                } else if (screenId === 'IDLE') {
                  executeFastDial(dialBuffer || '*347*88#');
                } else if (screenInfo.sessionType === 'CON') {
                  handleUssdOptionSubmit(inputBuffer);
                } else {
                  setScreenId('ROOT');
                }
              }}
              className="py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{screenId === 'IDLE' || phoneTab === 'SMS' ? 'Dial' : 'Send'}</span>
            </button>

            <button
              type="button"
              onClick={() => setPhoneTab(phoneTab === 'USSD' ? 'SMS' : 'USSD')}
              className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>SMS ({smsInbox.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPhoneTab('USSD');
                setScreenId('IDLE');
                setInputBuffer('');
              }}
              className="py-2 px-3 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End</span>
            </button>
          </div>

          {/* T9 Physical Keypad */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  if (screenId !== 'IDLE' && screenInfo.sessionType === 'CON' && k !== '*' && k !== '#') {
                    handleUssdOptionSubmit(k);
                  } else {
                    handleKeypadPress(k);
                  }
                }}
                className="py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100 font-mono text-sm font-semibold border border-slate-700/80 transition-colors"
              >
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Fast-Dial Shortcuts, Session Drop Tester & Offline SMS Fallback */}
      <div className="lg:col-span-7 space-y-6">
        {/* Fast-Dial Shortcuts */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Direct Fast-Dial USSD Shortcuts</h3>
              <p className="text-sm text-slate-600">
                Single-string dial codes bypass multi-step menus to conserve 2G radio slots and battery.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDialBuffer('*347*88#');
                executeFastDial('*347*88#');
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Session</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {FAST_DIAL_SHORTCUTS.map((sc) => (
              <button
                key={sc.code}
                type="button"
                onClick={() => {
                  setDialBuffer(sc.code);
                  executeFastDial(sc.code);
                }}
                className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors"
              >
                <div className="font-mono text-xs font-semibold text-emerald-700">{sc.code}</div>
                <div className="text-xs text-slate-700 mt-0.5">{sc.label}</div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const fIdx = feeders.findIndex((f) => f.id === activeProfile.savedFeederId) + 1;
                const code = `*347*88*2*${fIdx}#`;
                setDialBuffer(code);
                executeFastDial(code);
              }}
              className="text-left p-3 rounded-lg border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40 transition-colors"
            >
              <div className="font-mono text-xs font-semibold text-emerald-700">
                *347*88*2*{feeders.findIndex((f) => f.id === activeProfile.savedFeederId) + 1}#
              </div>
              <div className="text-xs text-slate-700 mt-0.5">Saved Feeder Uptime</div>
            </button>
          </div>
        </div>

        {/* Mid-Payment Session Drop & Automatic SMS Fallback Simulator */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Mid-Payment USSD Drop &amp; SMS Fallback Test
              </h3>
              <p className="text-sm text-slate-600 mt-0.5">
                Simulate a 2G tower handoff failure during solar checkout. The gateway holds payment state for 15 minutes and dispatches a recovery SMS.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimulateSessionDrop}
              className="px-4 py-2 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <WifiOff className="w-3.5 h-3.5" />
              <span>{isInPaygCheckout ? 'Drop Current Checkout' : 'Simulate Mid-Payment Drop'}</span>
            </button>
          </div>

          {droppedSession ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-amber-900">
                  Pending Recovery Session: <span className="font-mono">{droppedSession.refId}</span>
                </div>
                <div className="text-xs text-amber-800 mt-0.5 font-mono">
                  N{droppedSession.amountNgn.toLocaleString()} · {droppedSession.msisdn} · TTL 15m
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => executeFastDial('*347*88*9#')}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100 whitespace-nowrap"
                >
                  Dial *347*88*9#
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const ref = droppedSession.refId;
                    const planId = droppedSession.planId;
                    const railId = droppedSession.railId;
                    onSetDroppedSession(null);
                    finalizePayment(planId, railId, ref);
                    setPhoneTab('SMS');
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-emerald-700 text-white rounded-md hover:bg-emerald-800 whitespace-nowrap"
                >
                  Reply &quot;PAY 1&quot;
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
              <span>No dropped payment sessions in Redis recovery queue.</span>
              <span className="font-mono text-slate-500">TTL Window: 900s</span>
            </div>
          )}

          {/* Offline MO SMS Keyword Fallback */}
          <form onSubmit={handleSendMoSms} className="mt-4 pt-4 border-t border-slate-200">
            <label htmlFor="mo-sms-input" className="block text-xs font-medium text-slate-700 mb-1.5">
              Offline Mobile-Originated (MO) SMS Fallback to Shortcode <span className="font-mono">34788</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mo-sms-input"
                type="text"
                value={moSmsText}
                onChange={(e) => setMoSmsText(e.target.value)}
                placeholder="e.g. PAY 1 or FAULT EKE 2"
                className="flex-1 px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send MO SMS</span>
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
              <span>Supported commands:</span>
              <button
                type="button"
                onClick={() => setMoSmsText('PAY 1')}
                className="font-mono text-slate-700 hover:underline"
              >
                PAY 1
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setMoSmsText('FAULT EKE 2')}
                className="font-mono text-slate-700 hover:underline"
              >
                FAULT EKE 2
              </button>
            </div>
          </form>
        </div>

        {/* Quick Current Session Metadata */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">Bound Feeder &amp; Solar Unit</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {savedFeeder.name} ({savedFeeder.code}) · {activeProfile.solarMeterId}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Last OpenPAYGO Token</div>
              <div className="font-mono text-sm font-semibold text-emerald-700 mt-0.5 flex items-center justify-end gap-1">
                <Zap className="w-3.5 h-3.5" />
                <span>{activeProfile.lastToken}</span>
              </div>
            </div>
          </div>
          {screenId !== 'IDLE' && (
            <button
              type="button"
              onClick={() => handleUssdOptionSubmit('0')}
              className="mt-3 text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Step Back (Send 0)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
