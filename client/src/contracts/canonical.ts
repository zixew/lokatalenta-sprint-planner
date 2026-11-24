export const VALID_DIVISIONS = [
  'executive',
  'architecture',
  'engineering',
  'qa',
  'devops',
  'lounge',
] as const;

export type DivisionId = (typeof VALID_DIVISIONS)[number];
export type SprintStatus = 'planned' | 'active' | 'completed';
export type SprintItemStatus = 'in_sprint' | 'in_progress' | 'review' | 'done';
export type CeremonyType = 'planning' | 'review' | 'retrospective';

export interface CanonicalDivision {
  readonly id: DivisionId;
  readonly name: string;
  readonly shortName: string;
  readonly motto: string;
  readonly color: string;
  readonly defaultFloor: 1 | 2 | 3;
  readonly defaultZone: 'workspace' | 'lounge';
  readonly agentIds: readonly number[];
}

export interface CanonicalAgent {
  readonly id: number;
  readonly name: string;
  readonly shortName: string;
  readonly role: string;
  readonly divisionId: DivisionId;
  readonly avatar: string;
  readonly defaultFloor: 1 | 2 | 3;
  readonly defaultZone: 'workspace' | 'lounge';
}

export const CANONICAL_DIVISIONS: readonly CanonicalDivision[] = [
  {
    id: 'executive',
    name: 'Eksekutif & Tata Kelola Produk',
    shortName: 'Eksekutif & Manajemen',
    motto: 'Integritas Tanpa Kompromi, Nilai Bisnis Berkelanjutan',
    color: '#3b82f6',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [0, 1, 2],
  },
  {
    id: 'architecture',
    name: 'Arsitektur Sistem & Inovasi AI',
    shortName: 'Arsitektur & AI',
    motto: 'Presisi Fondasi, Arsitektur Heksagonal, Kecerdasan Teruji',
    color: '#8b5cf6',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [3, 4, 21],
  },
  {
    id: 'engineering',
    name: 'Studio Core Engineering & Product Craft',
    shortName: 'Core Engineering',
    motto: 'Kode Bersih, Performa Tangguh, Anti-AI-Slop Visual System',
    color: '#10b981',
    defaultFloor: 2,
    defaultZone: 'workspace',
    agentIds: [5, 6, 18, 19, 20],
  },
  {
    id: 'qa',
    name: 'Laboratorium Jaminan Kualitas & Otomasi',
    shortName: 'QA & Testing Lab',
    motto: 'Nol Cacat Produksi, Validasi Ketat, Cakupan Uji 100%',
    color: '#f59e0b',
    defaultFloor: 2,
    defaultZone: 'workspace',
    agentIds: [7, 8, 9, 10],
  },
  {
    id: 'devops',
    name: 'Pusat Operasional Cloud, DevOps & Keamanan Siber',
    shortName: 'Security & DevOps',
    motto: 'Pertahanan Berlapis Zero Trust, Rilis Tanpa Henti, Kepatuhan UU PDP',
    color: '#06b6d4',
    defaultFloor: 3,
    defaultZone: 'workspace',
    agentIds: [11, 12, 16, 17, 22],
  },
  {
    id: 'lounge',
    name: 'Stakeholder & User Experience Lounge',
    shortName: 'Stakeholder Lounge',
    motto: 'Suara Nyata Pengguna, Advokasi Inklusif, Dampak Bermakna',
    color: '#ec4899',
    defaultFloor: 2,
    defaultZone: 'lounge',
    agentIds: [13, 14, 15, 23],
  },
] as const;

export const CANONICAL_AGENTS: readonly CanonicalAgent[] = [
  { id: 0, name: 'Rizco Renova', shortName: 'Rizco Renova', role: 'Team Leader & Release Sign-Off Authority', divisionId: 'executive', avatar: '👑', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 1, name: 'Bramantyo Daniswara', shortName: 'Bram Daniswara', role: 'Chief Commercial & Business Strategist', divisionId: 'executive', avatar: '💼', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 2, name: 'Pranadipa Wicaksana', shortName: 'Prana Wicaksana', role: 'Principal Product Owner & Backlog Arbiter', divisionId: 'executive', avatar: '📋', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 3, name: 'Satria Adhyasta', shortName: 'Satria Adhyasta', role: 'Lead System Analyst & Flow Architect', divisionId: 'architecture', avatar: '📐', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 4, name: 'Ir. Arkananta Dewantara', shortName: 'Arka Dewantara', role: 'Chief IT Solution Architect', divisionId: 'architecture', avatar: '🏛️', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 5, name: 'Farel Faza Nugraha', shortName: 'Faza Nugraha', role: 'Staff Frontend Engineer & UI Craft Lead', divisionId: 'engineering', avatar: '💻', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 6, name: 'Bagas Bimo Prasetyo', shortName: 'Bimo Prasetyo', role: 'Staff Backend Engineer & Database Lead', divisionId: 'engineering', avatar: '⚙️', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 7, name: 'Qonita Anindya', shortName: 'Qonita Anindya', role: 'Lead Manual & Exploratory QA Specialist', divisionId: 'qa', avatar: '🧪', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 8, name: 'Qaisar Al-Ghaffar', shortName: 'Qash Al-Ghaffar', role: 'QA Automation & Integration Lead', divisionId: 'qa', avatar: '🤖', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 9, name: 'Pandu Respati', shortName: 'Pandu Respati', role: 'Performance & Stress Test Specialist', divisionId: 'qa', avatar: '⏱️', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 10, name: 'Raditya Rama Kusuma', shortName: 'Rama Kusuma', role: 'Regression Gatekeeper & Matrix Master', divisionId: 'qa', avatar: '🔄', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 11, name: 'Damar Deva Gunawan', shortName: 'Deva Gunawan', role: 'DevOps & Cloud Infrastructure Lead', divisionId: 'devops', avatar: '🚀', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 12, name: 'Tara Wulandari', shortName: 'Tara Wulandari', role: 'Lead Technical Communicator & Documentarian', divisionId: 'devops', avatar: '📝', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 13, name: 'Surya Dimas Pratama', shortName: 'Dimas Pratama', role: 'Student & Candidate Experience Advocate', divisionId: 'lounge', avatar: '🎓', defaultFloor: 2, defaultZone: 'lounge' },
  { id: 14, name: 'Ibu Triastuti Rahayu, M.Pd.', shortName: 'Bu Tias Rahayu', role: 'Curriculum Mentor & Educator Advocate', divisionId: 'lounge', avatar: '👩‍🏫', defaultFloor: 2, defaultZone: 'lounge' },
  { id: 15, name: 'Agung Abimanyu Santoso', shortName: 'Agung Santoso', role: 'Governance & Platform Admin', divisionId: 'lounge', avatar: '🛡️', defaultFloor: 2, defaultZone: 'lounge' },
  { id: 16, name: 'Rendra Dananjaya', shortName: 'Rendra Dananjaya', role: 'Lead Penetration Tester & Red Team Specialist', divisionId: 'devops', avatar: '🎯', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 17, name: 'Ir. Saskia Wardhani, CISA, CISSP', shortName: 'Saskia Wardhani', role: 'Principal IT Security & DevSecOps Compliance Lead', divisionId: 'devops', avatar: '🔒', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 18, name: 'Hendrawan Wicaksono, M.Kom.', shortName: 'Hendra Wicaksono', role: 'Principal Frontend Architect & Clean Architecture Lead', divisionId: 'engineering', avatar: '🏛️', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 19, name: 'Dr. Ir. Danu Bratawidjaja, Ph.D.', shortName: 'Danu Bratawidjaja', role: 'Principal Backend Architect & Clean Architecture Lead', divisionId: 'engineering', avatar: '⚡', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 20, name: 'Nadia Maharani, S.Ds.', shortName: 'Nadia Maharani', role: 'Lead UI/UX Product Designer & Design System Specialist', divisionId: 'engineering', avatar: '🎨', defaultFloor: 2, defaultZone: 'workspace' },
  { id: 21, name: 'Dr. Gibran Al-Farabi, Ph.D.', shortName: 'Gibran Al-Farabi', role: 'Lead AI/ML Engineer & Speech-To-Text Specialist', divisionId: 'architecture', avatar: '🧠', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 22, name: 'Reza Pratama, S.Kom.', shortName: 'Reza Pratama', role: 'Site Reliability Engineer & Real-Time Observability Lead', divisionId: 'devops', avatar: '📊', defaultFloor: 3, defaultZone: 'workspace' },
  { id: 23, name: 'Maya Safitri, S.Psi., CHRP', shortName: 'Maya Safitri', role: 'Corporate Recruiter & Talent Acquisition Advocate', divisionId: 'lounge', avatar: '💼', defaultFloor: 2, defaultZone: 'lounge' },
] as const;

export const DIVISIONS_BY_ID: Readonly<Record<DivisionId, CanonicalDivision>> = Object.fromEntries(
  CANONICAL_DIVISIONS.map((d) => [d.id, d]),
) as Readonly<Record<DivisionId, CanonicalDivision>>;

export const AGENTS_BY_ID: Readonly<Record<number, CanonicalAgent>> = Object.fromEntries(
  CANONICAL_AGENTS.map((a) => [a.id, a]),
) as Readonly<Record<number, CanonicalAgent>>;
