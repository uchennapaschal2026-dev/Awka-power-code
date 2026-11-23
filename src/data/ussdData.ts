export type GridStatus = 'ON' | 'OUTAGE' | 'LOAD_SHED';

export interface FeederNode {
  id: string;
  code: string;
  name: string;
  shortName: string;
  substation: string;
  transformerId: string;
  status: GridStatus;
  weeklyUptimeHours: number;
  dailyUptime: number[]; // 7 days (Mon-Sun)
  lastRestored: string;
  activeFaultReports: number;
  deduplicatedTickets: number;
  loadMw: number;
  affectedTradersEst: number;
  mapX: number; // 0-100 SVG coordinate
  mapY: number; // 0-100 SVG coordinate
  faultSummary?: string;
}

export interface PaygPlan {
  id: string;
  code: string;
  name: string;
  days: number;
  priceNgn: number;
  fastDial: string;
}

export interface PaymentRail {
  id: string;
  code: string;
  name: string;
  shortName: string;
  type: 'WALLET' | 'BANK_USSD';
  ussdCode?: string;
  feeNgn: number;
}

export interface SubscriberProfile {
  msisdn: string;
  name: string;
  role: string;
  savedFeederId: string;
  solarMeterId: string;
  solarCreditDays: number;
  lastToken: string;
}

export interface UssdScreenBlueprint {
  id: string;
  title: string;
  category: 'ROOT' | 'OUTAGE' | 'UPTIME' | 'PAYG' | 'BINDING';
  fastDial: string;
  sessionType: 'CON' | 'END';
  template: string;
  options: { key: string; label: string; nextScreenId?: string }[];
  notes: string;
}

export interface SmsTemplateBlueprint {
  id: string;
  title: string;
  trigger: string;
  direction: 'MT_GATEWAY' | 'MO_FALLBACK';
  template: string;
  notes: string;
}

export interface SmsMessage {
  id: string;
  timestamp: string;
  sender: string;
  body: string;
  tag: 'FAULT' | 'PAYG_TOKEN' | 'FALLBACK' | 'RESTORED' | 'BINDING';
  gsm7Length: number;
}

export interface FaultTicket {
  id: string;
  feederId: string;
  feederName: string;
  faultType: string;
  createdAt: string;
  reportCount: number;
  msisdnCluster: string[];
  status: 'OPEN' | 'CREW_DISPATCHED' | 'RESOLVED';
}

// GSM-7 Basic + Extension character check (prevents accidental UCS-2 70-char downgrade)
const GSM7_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€";

export function analyzeGsm7(text: string): {
  length: number;
  isGsm7Safe: boolean;
  nonGsmChars: string[];
  underLimit: boolean;
} {
  let septets = 0;
  const nonGsmChars: string[] = [];

  for (const ch of text) {
    if (GSM7_BASIC.includes(ch)) {
      septets += 1;
    } else if (GSM7_EXT.includes(ch)) {
      septets += 2;
    } else {
      septets += 1;
      if (!nonGsmChars.includes(ch)) {
        nonGsmChars.push(ch);
      }
    }
  }

  return {
    length: septets,
    isGsm7Safe: nonGsmChars.length === 0,
    nonGsmChars,
    underLimit: septets < 160,
  };
}

export function generateOpenPaygoToken(meterId: string, days: number, salt: number): string {
  // Deterministic 9-digit OpenPAYGO-style token formatted XXX-XXX-XXX
  let hash = 2166136261;
  const seed = `${meterId}:${days}:${salt}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash) % 900000000 + 100000000;
  const str = String(num);
  return `${str.slice(0, 3)}-${str.slice(3, 6)}-${str.slice(6, 9)}`;
}

export const INITIAL_FEEDERS: FeederNode[] = [
  {
    id: 'ifite',
    code: 'IFITE-11KV-01',
    name: 'Ifite (Awka North)',
    shortName: 'Ifite',
    substation: 'Agu-Awka 33/11kV Inj. Sub',
    transformerId: 'TX-IFT-014',
    status: 'OUTAGE',
    weeklyUptimeHours: 48.2,
    dailyUptime: [7.5, 6.2, 8.0, 7.1, 6.4, 8.2, 4.8],
    lastRestored: 'Yesterday 22:15',
    activeFaultReports: 14,
    deduplicatedTickets: 1,
    loadMw: 0.0,
    affectedTradersEst: 1840,
    mapX: 54,
    mapY: 18,
    faultSummary: 'Breaker trip on Ifite 11kV feeder; 14 MSISDNs merged to TKT-409.',
  },
  {
    id: 'unizik',
    code: 'UNIZIK-11KV-02',
    name: 'UNIZIK / Temp Site',
    shortName: 'UNIZIK',
    substation: 'Agu-Awka 33/11kV Inj. Sub',
    transformerId: 'TX-UNZ-008',
    status: 'ON',
    weeklyUptimeHours: 74.0,
    dailyUptime: [11.2, 10.4, 9.8, 12.0, 10.5, 11.1, 9.0],
    lastRestored: 'Today 06:30',
    activeFaultReports: 1,
    deduplicatedTickets: 0,
    loadMw: 3.4,
    affectedTradersEst: 920,
    mapX: 74,
    mapY: 28,
  },
  {
    id: 'agu-awka',
    code: 'AGU-AWK-11KV',
    name: 'Agu-Awka Industrial',
    shortName: 'Agu-Awka',
    substation: 'Agu-Awka 132/33kV Transmission',
    transformerId: 'TX-AGU-003',
    status: 'ON',
    weeklyUptimeHours: 61.5,
    dailyUptime: [9.0, 8.5, 9.2, 7.8, 8.9, 9.6, 8.5],
    lastRestored: 'Today 05:10',
    activeFaultReports: 0,
    deduplicatedTickets: 0,
    loadMw: 4.8,
    affectedTradersEst: 610,
    mapX: 82,
    mapY: 50,
  },
  {
    id: 'aroma',
    code: 'AROMA-11KV-02',
    name: 'Aroma Junction',
    shortName: 'Aroma',
    substation: 'Nibo 33/11kV Inj. Sub',
    transformerId: 'TX-ARM-019',
    status: 'LOAD_SHED',
    weeklyUptimeHours: 67.6,
    dailyUptime: [10.1, 9.4, 10.8, 9.2, 8.7, 10.4, 9.0],
    lastRestored: 'Today 01:40',
    activeFaultReports: 3,
    deduplicatedTickets: 0,
    loadMw: 1.9,
    affectedTradersEst: 1150,
    mapX: 52,
    mapY: 48,
    faultSummary: 'Scheduled EEDC Band B load rotation until 18:00 WAT.',
  },
  {
    id: 'secretariat',
    code: 'SEC-11KV-04',
    name: 'State Secretariat',
    shortName: 'Secretariat',
    substation: 'Nibo 33/11kV Inj. Sub',
    transformerId: 'TX-SEC-002',
    status: 'ON',
    weeklyUptimeHours: 79.1,
    dailyUptime: [12.0, 11.5, 10.9, 11.8, 11.4, 11.0, 10.5],
    lastRestored: 'Today 07:00',
    activeFaultReports: 0,
    deduplicatedTickets: 0,
    loadMw: 3.1,
    affectedTradersEst: 480,
    mapX: 64,
    mapY: 64,
  },
  {
    id: 'eke-awka',
    code: 'EKE-MKT-11KV',
    name: 'Eke Awka Market',
    shortName: 'Eke Awka',
    substation: 'Awka Central 33/11kV Sub',
    transformerId: 'TX-EKE-021',
    status: 'OUTAGE',
    weeklyUptimeHours: 52.8,
    dailyUptime: [8.4, 7.6, 8.1, 6.9, 7.2, 8.8, 5.8],
    lastRestored: 'Yesterday 19:45',
    activeFaultReports: 23,
    deduplicatedTickets: 1,
    loadMw: 0.0,
    affectedTradersEst: 4200,
    mapX: 34,
    mapY: 60,
    faultSummary: 'Transformer oil leak & phase fuse blown at Zik Ave sub-pole.',
  },
  {
    id: 'amawbia',
    code: 'AMAWBIA-11KV',
    name: 'Amawbia / Bypass',
    shortName: 'Amawbia',
    substation: 'Nibo 33/11kV Inj. Sub',
    transformerId: 'TX-AMW-011',
    status: 'ON',
    weeklyUptimeHours: 82.4,
    dailyUptime: [12.4, 11.8, 12.1, 11.5, 11.9, 12.2, 10.5],
    lastRestored: 'Today 08:15',
    activeFaultReports: 2,
    deduplicatedTickets: 0,
    loadMw: 3.9,
    affectedTradersEst: 1320,
    mapX: 20,
    mapY: 78,
  },
];

export const PAYG_PLANS: PaygPlan[] = [
  { id: '1d', code: '1', name: '1 Day Basic', days: 1, priceNgn: 250, fastDial: '*347*88*3*1#' },
  { id: '3d', code: '2', name: '3 Days Market', days: 3, priceNgn: 700, fastDial: '*347*88*3*2#' },
  { id: '7d', code: '3', name: '7 Days Stall', days: 7, priceNgn: 1500, fastDial: '*347*88*3*3#' },
  { id: '30d', code: '4', name: '30 Days Home', days: 30, priceNgn: 5800, fastDial: '*347*88*3*4#' },
];

export const PAYMENT_RAILS: PaymentRail[] = [
  { id: 'opay', code: '1', name: 'OPay Wallet', shortName: 'OPay', type: 'WALLET', feeNgn: 0 },
  { id: 'palmpay', code: '2', name: 'PalmPay Wallet', shortName: 'PalmPay', type: 'WALLET', feeNgn: 0 },
  { id: 'moniepoint', code: '3', name: 'Moniepoint MFB', shortName: 'Moniepoint', type: 'WALLET', feeNgn: 10 },
  { id: 'gtb', code: '1', name: 'GTBank *737#', shortName: 'GTBank', type: 'BANK_USSD', ussdCode: '*737#', feeNgn: 20 },
  { id: 'access', code: '2', name: 'Access *901#', shortName: 'Access', type: 'BANK_USSD', ussdCode: '*901#', feeNgn: 20 },
  { id: 'zenith', code: '3', name: 'Zenith *966#', shortName: 'Zenith', type: 'BANK_USSD', ussdCode: '*966#', feeNgn: 20 },
  { id: 'firstbank', code: '4', name: 'FirstBank *894#', shortName: 'FirstBank', type: 'BANK_USSD', ussdCode: '*894#', feeNgn: 20 },
];

export const SUBSCRIBER_PROFILES: SubscriberProfile[] = [
  {
    msisdn: '08034128891',
    name: 'Chidi Okafor (Stall B14)',
    role: 'Eke Awka Provision Trader',
    savedFeederId: 'eke-awka',
    solarMeterId: 'SP-AWK-8821',
    solarCreditDays: 1,
    lastToken: '482-910-374',
  },
  {
    msisdn: '08167042219',
    name: 'Ngozi Nwosu (Cold Room)',
    role: 'Ifite Market Vendor',
    savedFeederId: 'ifite',
    solarMeterId: 'SP-AWK-4410',
    solarCreditDays: 0,
    lastToken: '719-304-882',
  },
  {
    msisdn: '07058913044',
    name: 'Emeka Eze (Tailoring)',
    role: 'Amawbia Bypass Resident',
    savedFeederId: 'amawbia',
    solarMeterId: 'SP-AWK-9103',
    solarCreditDays: 6,
    lastToken: '335-621-109',
  },
];

export const INITIAL_TICKETS: FaultTicket[] = [
  {
    id: 'TKT-412',
    feederId: 'eke-awka',
    feederName: 'Eke Awka Market',
    faultType: 'Transformer Spark / Oil Leak',
    createdAt: '09:14 WAT',
    reportCount: 23,
    msisdnCluster: ['08034128891', '08062219033', '08139045512'],
    status: 'CREW_DISPATCHED',
  },
  {
    id: 'TKT-409',
    feederId: 'ifite',
    feederName: 'Ifite (Awka North)',
    faultType: 'No Power / Feeder Off',
    createdAt: '07:42 WAT',
    reportCount: 14,
    msisdnCluster: ['08167042219', '09031128400'],
    status: 'OPEN',
  },
];

export const USSD_SCREEN_BLUEPRINTS: UssdScreenBlueprint[] = [
  {
    id: 'ROOT',
    title: 'Root Menu (*347*88#)',
    category: 'ROOT',
    fastDial: '*347*88#',
    sessionType: 'CON',
    template: `AwkaGrid *347*88#
Saved: Eke Awka | SP-AWK-8821
1. Report Outage/Fault
2. 7-Day Feeder Uptime
3. Solar PAYG (N250+)
4. Change Feeder/Meter
0. Exit`,
    options: [
      { key: '1', label: 'Report Outage/Fault', nextScreenId: 'REPORT_FEEDER' },
      { key: '2', label: '7-Day Feeder Uptime', nextScreenId: 'UPTIME_FEEDER' },
      { key: '3', label: 'Solar PAYG (N250+)', nextScreenId: 'PAYG_PLAN' },
      { key: '4', label: 'Change Feeder/Meter', nextScreenId: 'BIND_FEEDER' },
      { key: '0', label: 'Exit' },
    ],
    notes: 'Auto-resolves caller MSISDN via telco header to pre-bind saved feeder & PAYG solar meter.',
  },
  {
    id: 'REPORT_FEEDER',
    title: 'Select Feeder for Outage',
    category: 'OUTAGE',
    fastDial: '*347*88*1#',
    sessionType: 'CON',
    template: `Report Fault - Feeder:
1. Ifite
2. Agu-Awka
3. UNIZIK
4. Eke Awka (Saved)
5. Amawbia
6. Secretariat
7. Aroma
0. Back`,
    options: [
      { key: '1-7', label: 'Select Awka Feeder', nextScreenId: 'REPORT_TYPE' },
      { key: '0', label: 'Back', nextScreenId: 'ROOT' },
    ],
    notes: 'Marks caller auto-bound feeder as "(Saved)" for rapid recognition on 2-inch screens.',
  },
  {
    id: 'REPORT_TYPE',
    title: 'Select Fault Severity',
    category: 'OUTAGE',
    fastDial: '*347*88*1*4#',
    sessionType: 'CON',
    template: `Eke Awka Fault Type:
1. Feeder Off / No Light
2. Transformer Spark/Oil
3. Fallen Pole / Wire
4. Low Voltage
0. Back`,
    options: [
      { key: '1-4', label: 'Log Fault Classification', nextScreenId: 'REPORT_CONFIRM' },
      { key: '0', label: 'Back', nextScreenId: 'REPORT_FEEDER' },
    ],
    notes: 'Distinguishes routine load shedding from critical transformer/pole hazards.',
  },
  {
    id: 'REPORT_CONFIRM',
    title: 'Deduplicated Fault Confirmation',
    category: 'OUTAGE',
    fastDial: '*347*88*1*4*2#',
    sessionType: 'END',
    template: `Logged: Eke Awka (TKT-412).
24 trader reports merged in 15m window. EEDC team notified.
SMS ticket sent. Dial *347*88*2# for status.`,
    options: [],
    notes: 'Deduplicates crowd-sourced reports within a 15-min sliding window per feeder.',
  },
  {
    id: 'UPTIME_FEEDER',
    title: 'Select Feeder for 7-Day Uptime',
    category: 'UPTIME',
    fastDial: '*347*88*2#',
    sessionType: 'CON',
    template: `Grid Status & 7d Uptime:
1. Ifite
2. Agu-Awka
3. UNIZIK
4. Eke Awka (Saved)
5. Amawbia
6. Secretariat
7. Aroma
0. Back`,
    options: [
      { key: '1-7', label: 'View Feeder Uptime', nextScreenId: 'UPTIME_DETAIL' },
      { key: '0', label: 'Back', nextScreenId: 'ROOT' },
    ],
    notes: 'Direct fast-dial *347*88*2*4# jumps straight to Eke Awka uptime telemetry.',
  },
  {
    id: 'UPTIME_DETAIL',
    title: '7-Day Feeder Uptime Summary',
    category: 'UPTIME',
    fastDial: '*347*88*2*4#',
    sessionType: 'END',
    template: `EKE-MKT-11KV: OUTAGE
7-Day Uptime: 52.8h / 168h
Last ON: Yesterday 19:45
Active Ticket: TKT-412 (23 reports)
Reply 00 or dial *347*88#`,
    options: [],
    notes: 'Concise tabular snapshot under 140 chars; safe for 2G session timeouts.',
  },
  {
    id: 'PAYG_PLAN',
    title: 'Select Solar PAYG Plan (NGN)',
    category: 'PAYG',
    fastDial: '*347*88*3#',
    sessionType: 'CON',
    template: `Solar PAYG (SP-AWK-8821):
1. 1 Day Basic - N250
2. 3 Days Market - N700
3. 7 Days Stall - N1,500
4. 30 Days Home - N5,800
0. Back`,
    options: [
      { key: '1-4', label: 'Select Plan', nextScreenId: 'PAYG_RAIL' },
      { key: '0', label: 'Back', nextScreenId: 'ROOT' },
    ],
    notes: 'Uses ASCII "N" instead of Unicode Naira symbol to stay strictly within GSM-7 160-char budget.',
  },
  {
    id: 'PAYG_RAIL',
    title: 'Select Payment Rail',
    category: 'PAYG',
    fastDial: '*347*88*3*1#',
    sessionType: 'CON',
    template: `Pay N250 (1 Day Basic):
1. OPay Wallet
2. PalmPay Wallet
3. Moniepoint (N10 fee)
4. Bank USSD (*737#/*901#)
0. Back`,
    options: [
      { key: '1-3', label: 'Mobile Money Push', nextScreenId: 'PAYG_CONFIRMED' },
      { key: '4', label: 'Bank USSD Menu', nextScreenId: 'PAYG_BANK' },
      { key: '0', label: 'Back', nextScreenId: 'PAYG_PLAN' },
    ],
    notes: 'Supports instant wallet debit prompt or Nigerian bank USSD push.',
  },
  {
    id: 'PAYG_BANK',
    title: 'Select Bank USSD Push',
    category: 'PAYG',
    fastDial: '*347*88*3*1*4#',
    sessionType: 'CON',
    template: `Select Bank (N250+N20 fee):
1. GTBank (*737#)
2. Access (*901#)
3. Zenith (*966#)
4. FirstBank (*894#)
0. Back`,
    options: [
      { key: '1-4', label: 'Trigger Bank USSD Push', nextScreenId: 'PAYG_CONFIRMED' },
      { key: '0', label: 'Back', nextScreenId: 'PAYG_RAIL' },
    ],
    notes: 'Issues out-of-band bank USSD push; if session drops, SMS fallback captures recovery.',
  },
  {
    id: 'PAYG_CONFIRMED',
    title: 'Payment Initiated & Token Pending',
    category: 'PAYG',
    fastDial: '*347*88*3*1*1#',
    sessionType: 'END',
    template: `OPay push sent for N250.
Enter PIN on prompt.
OpenPAYGO token for SP-AWK-8821 arrives by SMS in 10s.
Ref: PAY-9921`,
    options: [],
    notes: 'Releases 2G USSD radio channel immediately; webhook delivers OpenPAYGO token via SMS.',
  },
  {
    id: 'BIND_FEEDER',
    title: 'Auto-Bind MSISDN to Feeder',
    category: 'BINDING',
    fastDial: '*347*88*4#',
    sessionType: 'CON',
    template: `Link 08034128891 Feeder:
1. Ifite  2. Agu-Awka
3. UNIZIK 4. Eke Awka
5. Amawbia 6. Secretariat
7. Aroma
0. Back`,
    options: [
      { key: '1-7', label: 'Save Default Feeder', nextScreenId: 'BIND_SAVED' },
      { key: '0', label: 'Back', nextScreenId: 'ROOT' },
    ],
    notes: 'Persists MSISDN -> Feeder ID mapping in edge Redis cache for zero-typing repeat sessions.',
  },
  {
    id: 'BIND_SAVED',
    title: 'MSISDN Binding Confirmed',
    category: 'BINDING',
    fastDial: '*347*88*4*4#',
    sessionType: 'END',
    template: `Saved! 08034128891 is now linked to Eke Awka (EKE-MKT-11KV) & Meter SP-AWK-8821.
SMS alerts active.`,
    options: [],
    notes: 'Subscribes trader to asynchronous restoration SMS alerts for their specific feeder.',
  },
];

export const SMS_TEMPLATE_BLUEPRINTS: SmsTemplateBlueprint[] = [
  {
    id: 'SMS_FAULT_TICKET',
    title: 'Outage Ticket & Cluster Receipt',
    trigger: 'USSD Fault Submission (*347*88*1#)',
    direction: 'MT_GATEWAY',
    template: `AwkaGrid: Eke Awka fault logged (TKT-412). 24 reports merged. EEDC crew notified. Check status anytime: *347*88*2*4#`,
    notes: 'Confirms ticket ID and fast-dial status shortcut without requiring a return USSD call.',
  },
  {
    id: 'SMS_OPENPAYGO_TOKEN',
    title: 'Webhook OpenPAYGO Token Delivery',
    trigger: 'OPay/PalmPay/Bank Webhook -> Confirmed',
    direction: 'MT_GATEWAY',
    template: `AwkaGrid PAYG: N250 paid via OPay. Enter Token 482-910-374 on unit SP-AWK-8821 for 1 Day light. Ref: PAY-9921`,
    notes: 'Generated asynchronously by SipHash OpenPAYGO engine upon payment provider HMAC webhook.',
  },
  {
    id: 'SMS_SESSION_DROP_FALLBACK',
    title: 'Mid-Payment USSD Drop Recovery',
    trigger: 'Telco USSD Timeout / Radio Drop > 45s',
    direction: 'MT_GATEWAY',
    template: `AwkaGrid: Your N250 OPay solar session dropped. Dial *347*88*9# in 15m to resume PAY-9921 or reply PAY 1 to confirm.`,
    notes: 'Automatic SMS fallback preserves cart state for 15 minutes when 2G signal drops mid-checkout.',
  },
  {
    id: 'SMS_GRID_RESTORED',
    title: 'Feeder Restoration Broadcast',
    trigger: 'EEDC Feeder Telemetry -> ON',
    direction: 'MT_GATEWAY',
    template: `AwkaGrid Alert: Power RESTORED on Eke Awka (EKE-MKT-11KV) at 14:22 WAT. 7d uptime: 54.0h. Dial *347*88*2# for log.`,
    notes: 'Sent to all MSISDNs bound to the restored feeder so traders can power cold storage/stalls.',
  },
  {
    id: 'SMS_MO_COMMAND',
    title: 'Offline SMS Keyword Fallback',
    trigger: 'User sends SMS to 34788 when USSD down',
    direction: 'MO_FALLBACK',
    template: `FAULT EKE 2`,
    notes: 'Fallback inbound SMS syntax: "FAULT <FEEDER> <TYPE>" or "PAY <PLAN_ID>" if telco USSD gateway is congested.',
  },
];

export const INITIAL_SMS_INBOX: SmsMessage[] = [
  {
    id: 'sms-init-1',
    timestamp: '09:15 WAT',
    sender: 'AwkaGrid',
    body: 'AwkaGrid: Eke Awka fault logged (TKT-412). 23 reports merged. EEDC crew notified. Check status anytime: *347*88*2*4#',
    tag: 'FAULT',
    gsm7Length: 121,
  },
  {
    id: 'sms-init-2',
    timestamp: 'Yesterday',
    sender: 'AwkaGrid',
    body: 'AwkaGrid PAYG: N250 paid via OPay. Enter Token 482-910-374 on unit SP-AWK-8821 for 1 Day light. Ref: PAY-8804',
    tag: 'PAYG_TOKEN',
    gsm7Length: 112,
  },
];
