export const VALID_DIVISIONS = [
  'executive',
  'architecture',
  'engineering',
  'qa',
  'devops',
  'lounge',
] as const;

export type DivisionId = (typeof VALID_DIVISIONS)[number];

export const VALID_ZONES = [
  'workspace',
  'boardroom',
  'cafeteria',
  'lobby',
  'lounge',
  'gym',
  'musholla',
] as const;

export type TargetZone = (typeof VALID_ZONES)[number];

export const VALID_FLOORS = [1, 2, 3] as const;
export type TargetFloor = (typeof VALID_FLOORS)[number];

export const VALID_SEVERITIES = ['info', 'success', 'warning', 'alert'] as const;
export type EventSeverity = (typeof VALID_SEVERITIES)[number];

export const VALID_SPRINT_STATUSES = ['planned', 'active', 'completed'] as const;
export type SprintStatus = (typeof VALID_SPRINT_STATUSES)[number];

export const VALID_SPRINT_ITEM_STATUSES = [
  'in_sprint',
  'in_progress',
  'review',
  'done',
] as const;
export type SprintItemStatus = (typeof VALID_SPRINT_ITEM_STATUSES)[number];

export const VALID_CEREMONY_TYPES = ['planning', 'review', 'retrospective'] as const;
export type CeremonyType = (typeof VALID_CEREMONY_TYPES)[number];

export const VALID_SPRINT_EVENT_ACTIONS = [
  'sprint.created',
  'sprint.started',
  'sprint.item_assigned',
  'sprint.completed',
  'sprint.ceremony_recorded',
  'sprint.capacity_updated',
  'sprint.item_updated',
  'sprint.updated',
] as const;
export type SprintEventAction = (typeof VALID_SPRINT_EVENT_ACTIONS)[number];

export interface CanonicalDivision {
  readonly id: DivisionId;
  readonly name: string;
  readonly shortName: string;
  readonly motto: string;
  readonly color: string;
  readonly threeColor: string;
  readonly defaultFloor: TargetFloor;
  readonly defaultZone: TargetZone;
  readonly agentIds: readonly number[];
}

export interface CanonicalAgent {
  readonly id: number;
  readonly name: string;
  readonly shortName: string;
  readonly role: string;
  readonly divisionId: DivisionId;
  readonly category: 'lead' | 'product' | 'tech' | 'qa' | 'ops' | 'pov' | 'sec' | 'design';
  readonly avatar: string;
  readonly defaultZone: TargetZone;
  readonly defaultFloor: TargetFloor;
}

export const CANONICAL_DIVISIONS: readonly CanonicalDivision[] = [
  {
    id: 'executive',
    name: 'Eksekutif & Tata Kelola Produk',
    shortName: '🏛️ Eksekutif & Manajemen (3)',
    motto: 'Integritas Tanpa Kompromi, Nilai Bisnis Berkelanjutan',
    color: '#3b82f6',
    threeColor: '0x3b82f6',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [0, 1, 2],
  },
  {
    id: 'architecture',
    name: 'Arsitektur Sistem & Inovasi AI',
    shortName: '📐 Arsitektur & AI (3)',
    motto: 'Presisi Fondasi, Arsitektur Heksagonal, Kecerdasan Teruji',
    color: '#8b5cf6',
    threeColor: '0x8b5cf6',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [3, 4, 21],
  },
  {
    id: 'engineering',
    name: 'Studio Core Engineering & Product Craft',
    shortName: '💻 Core Engineering (5)',
    motto: 'Kode Bersih, Performa Tangguh, Anti-AI-Slop Visual System',
    color: '#10b981',
    threeColor: '0x10b981',
    defaultFloor: 2,
    defaultZone: 'workspace',
    agentIds: [5, 6, 18, 19, 20],
  },
  {
    id: 'qa',
    name: 'Laboratorium Jaminan Kualitas & Otomasi',
    shortName: '🔬 QA & Testing Lab (4)',
    motto: 'Nol Cacat Produksi, Validasi Ketat, Cakupan Uji 100%',
    color: '#f59e0b',
    threeColor: '0xf59e0b',
    defaultFloor: 2,
    defaultZone: 'workspace',
    agentIds: [7, 8, 9, 10],
  },
  {
    id: 'devops',
    name: 'Pusat Operasional Cloud, DevOps & Keamanan Siber',
    shortName: '⚡ Security & DevOps (5)',
    motto: 'Pertahanan Berlapis Zero Trust, Rilis Tanpa Henti, Kepatuhan UU PDP',
    color: '#06b6d4',
    threeColor: '0x06b6d4',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [11, 12, 16, 17, 22],
  },
  {
    id: 'lounge',
    name: 'Stakeholder & User Experience Lounge',
    shortName: '☕ Stakeholder Lounge (4)',
    motto: 'Suara Nyata Pengguna, Advokasi Inklusif, Dampak Bermakna',
    color: '#ec4899',
    threeColor: '0xec4899',
    defaultFloor: 2,
    defaultZone: 'lounge',
    agentIds: [13, 14, 15, 23],
  },
] as const;

export const CANONICAL_AGENTS: readonly CanonicalAgent[] = [
  {
    id: 0,
    name: 'Rizco Renova',
    shortName: 'Rizco Renova',
    role: 'Team Leader & Release Sign-Off Authority',
    divisionId: 'executive',
    category: 'lead',
    avatar: '👑',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 1,
    name: 'Bramantyo Daniswara',
    shortName: 'Bram Daniswara',
    role: 'Chief Commercial & Business Strategist',
    divisionId: 'executive',
    category: 'product',
    avatar: '💼',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 2,
    name: 'Pranadipa Wicaksana',
    shortName: 'Prana Wicaksana',
    role: 'Principal Product Owner & Backlog Arbiter',
    divisionId: 'executive',
    category: 'product',
    avatar: '📋',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 3,
    name: 'Satria Adhyasta',
    shortName: 'Satria Adhyasta',
    role: 'Lead System Analyst & Flow Architect',
    divisionId: 'architecture',
    category: 'tech',
    avatar: '📐',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 4,
    name: 'Ir. Arkananta Dewantara',
    shortName: 'Arka Dewantara',
    role: 'Chief IT Solution Architect',
    divisionId: 'architecture',
    category: 'tech',
    avatar: '🏛️',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 5,
    name: 'Farel Faza Nugraha',
    shortName: 'Faza Nugraha',
    role: 'Staff Frontend Engineer & UI Craft Lead',
    divisionId: 'engineering',
    category: 'tech',
    avatar: '💻',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 6,
    name: 'Bagas Bimo Prasetyo',
    shortName: 'Bimo Prasetyo',
    role: 'Staff Backend Engineer & Database Lead',
    divisionId: 'engineering',
    category: 'tech',
    avatar: '⚙️',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 7,
    name: 'Qonita Anindya',
    shortName: 'Qonita Anindya',
    role: 'Lead Manual & Exploratory QA Specialist',
    divisionId: 'qa',
    category: 'qa',
    avatar: '🧪',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 8,
    name: 'Qaisar Al-Ghaffar',
    shortName: 'Qash Al-Ghaffar',
    role: 'QA Automation & Integration Lead',
    divisionId: 'qa',
    category: 'qa',
    avatar: '🤖',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 9,
    name: 'Pandu Respati',
    shortName: 'Pandu Respati',
    role: 'Performance & Stress Test Specialist',
    divisionId: 'qa',
    category: 'qa',
    avatar: '⏱️',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 10,
    name: 'Raditya Rama Kusuma',
    shortName: 'Rama Kusuma',
    role: 'Regression Gatekeeper & Matrix Master',
    divisionId: 'qa',
    category: 'qa',
    avatar: '🔄',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 11,
    name: 'Damar Deva Gunawan',
    shortName: 'Deva Gunawan',
    role: 'DevOps & Cloud Infrastructure Lead',
    divisionId: 'devops',
    category: 'ops',
    avatar: '🚀',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 12,
    name: 'Tara Wulandari',
    shortName: 'Tara Wulandari',
    role: 'Lead Technical Communicator & Documentarian',
    divisionId: 'devops',
    category: 'ops',
    avatar: '📝',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 13,
    name: 'Surya Dimas Pratama',
    shortName: 'Dimas Pratama',
    role: 'Student & Candidate Experience Advocate',
    divisionId: 'lounge',
    category: 'pov',
    avatar: '🎓',
    defaultZone: 'lounge',
    defaultFloor: 2,
  },
  {
    id: 14,
    name: 'Ibu Triastuti Rahayu, M.Pd.',
    shortName: 'Bu Tias Rahayu',
    role: 'Curriculum Mentor & Educator Advocate',
    divisionId: 'lounge',
    category: 'pov',
    avatar: '👩‍🏫',
    defaultZone: 'lounge',
    defaultFloor: 2,
  },
  {
    id: 15,
    name: 'Agung Abimanyu Santoso',
    shortName: 'Agung Santoso',
    role: 'Governance & Platform Admin',
    divisionId: 'lounge',
    category: 'pov',
    avatar: '🛡️',
    defaultZone: 'lounge',
    defaultFloor: 2,
  },
  {
    id: 16,
    name: 'Rendra Dananjaya',
    shortName: 'Rendra Dananjaya',
    role: 'Lead Penetration Tester & Red Team Specialist',
    divisionId: 'devops',
    category: 'sec',
    avatar: '🎯',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 17,
    name: 'Ir. Saskia Wardhani, CISA, CISSP',
    shortName: 'Saskia Wardhani',
    role: 'Principal IT Security & DevSecOps Compliance Lead',
    divisionId: 'devops',
    category: 'sec',
    avatar: '🔒',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 18,
    name: 'Hendrawan Wicaksono, M.Kom.',
    shortName: 'Hendra Wicaksono',
    role: 'Principal Frontend Architect & Clean Architecture Lead',
    divisionId: 'engineering',
    category: 'tech',
    avatar: '🏛️',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 19,
    name: 'Dr. Ir. Danu Bratawidjaja, Ph.D.',
    shortName: 'Danu Bratawidjaja',
    role: 'Principal Backend Architect & Clean Architecture Lead',
    divisionId: 'engineering',
    category: 'tech',
    avatar: '⚡',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 20,
    name: 'Nadia Maharani, S.Ds.',
    shortName: 'Nadia Maharani',
    role: 'Lead UI/UX Product Designer & Design System Specialist',
    divisionId: 'engineering',
    category: 'design',
    avatar: '🎨',
    defaultZone: 'workspace',
    defaultFloor: 2,
  },
  {
    id: 21,
    name: 'Dr. Gibran Al-Farabi, Ph.D.',
    shortName: 'Gibran Al-Farabi',
    role: 'Lead AI/ML Engineer & Speech-To-Text Specialist',
    divisionId: 'architecture',
    category: 'tech',
    avatar: '🧠',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 22,
    name: 'Reza Pratama, S.Kom.',
    shortName: 'Reza Pratama',
    role: 'Site Reliability Engineer & Real-Time Observability Lead',
    divisionId: 'devops',
    category: 'ops',
    avatar: '📊',
    defaultZone: 'workspace',
    defaultFloor: 3,
  },
  {
    id: 23,
    name: 'Maya Safitri, S.Psi., CHRP',
    shortName: 'Maya Safitri',
    role: 'Corporate Recruiter & Talent Acquisition Advocate',
    divisionId: 'lounge',
    category: 'pov',
    avatar: '💼',
    defaultZone: 'lounge',
    defaultFloor: 2,
  },
] as const;

export const DIVISIONS_BY_ID: Readonly<Record<DivisionId, CanonicalDivision>> = Object.fromEntries(
  CANONICAL_DIVISIONS.map((division) => [division.id, division]),
) as Readonly<Record<DivisionId, CanonicalDivision>>;

export const AGENTS_BY_ID: Readonly<Record<number, CanonicalAgent>> = Object.fromEntries(
  CANONICAL_AGENTS.map((agent) => [agent.id, agent]),
) as Readonly<Record<number, CanonicalAgent>>;

const DIVISION_SET: ReadonlySet<string> = new Set(VALID_DIVISIONS);
const ZONE_SET: ReadonlySet<string> = new Set(VALID_ZONES);
const SEVERITY_SET: ReadonlySet<string> = new Set(VALID_SEVERITIES);
const SPRINT_STATUS_SET: ReadonlySet<string> = new Set(VALID_SPRINT_STATUSES);
const SPRINT_ITEM_STATUS_SET: ReadonlySet<string> = new Set(VALID_SPRINT_ITEM_STATUSES);
const CEREMONY_TYPE_SET: ReadonlySet<string> = new Set(VALID_CEREMONY_TYPES);

export function isValidDivision(value: unknown): value is DivisionId {
  return typeof value === 'string' && DIVISION_SET.has(value);
}

export function isValidAgentId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23;
}

export function isValidZone(value: unknown): value is TargetZone {
  return typeof value === 'string' && ZONE_SET.has(value);
}

export function isValidFloor(value: unknown): value is TargetFloor {
  return value === 1 || value === 2 || value === 3;
}

export function isValidSeverity(value: unknown): value is EventSeverity {
  return typeof value === 'string' && SEVERITY_SET.has(value);
}

export function isValidSprintStatus(value: unknown): value is SprintStatus {
  return typeof value === 'string' && SPRINT_STATUS_SET.has(value);
}

export function isValidSprintItemStatus(value: unknown): value is SprintItemStatus {
  return typeof value === 'string' && SPRINT_ITEM_STATUS_SET.has(value);
}

export function isValidCeremonyType(value: unknown): value is CeremonyType {
  return typeof value === 'string' && CEREMONY_TYPE_SET.has(value);
}

export function getDivision(id: DivisionId): CanonicalDivision {
  return DIVISIONS_BY_ID[id];
}

export function getAgent(id: number): CanonicalAgent {
  const agent = AGENTS_BY_ID[id];
  if (!agent) {
    throw new Error(`Invalid canonical agent id: ${id}`);
  }
  return agent;
}
