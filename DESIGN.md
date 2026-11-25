# DESIGN.md — LokaTalenta Design System & UI Specification

> **Target Audience:** Coding and design agents generating or critiquing interfaces across the LokaTalenta ecosystem (Sprint Planner, Backlog, Docs Hub, and 3D Office UI overlays).  
> **Aesthetic Direction:** *Industrial Precision Workbench* (Anti-Slop, High-Density, Tactile).

---

## 1. Purpose and Scope
- **Scope:** Governs all client-side UI/UX across the decoupled LokaTalenta suite.
- **Goal:** Ensure every screen functions as an authoritative, zero-latency instrument for software engineering and psychological talent assessment.
- **Rule:** Strict rejection of generic AI slop (no decorative purple gradients, no cream parchment fakes, no ungrounded card floating).

---

## 2. Product and User Principles
1. **100% Free-Access Guarantee:** Zero paywall gates, zero checkout modals, zero pricing tiers. Every feature is unrestricted.
2. **Operational Density Over Fluff:** Value data visibility per square inch. Avoid nested cards that squander vertical space.
3. **Continuous Spatial Consistency:** Transitions enter and exit on the same trajectory; state changes never jump or jitter.
4. **Active Work Realism:** Dev workload must dynamically reflect in-flight status (`Active Load`), not lock up on finished tasks.
5. **Decoupled Autonomy:** Interfaces degrade gracefully with offline badges if Event Gateway or peer endpoints lag.

---

## 3. Visual Hierarchy and Layout Rules
- **Primary Viewport (Desktop $\ge 1280\text{px}$):**
  - **Level 1 (Top Bar - 48px):** Ecosystem Switcher, Active Sprint Dropdown, Sync Indicator dot, and critical sprint actions (`Start / Complete Sprint`, `Pull Backlog`).
  - **Level 2 (Executive Metric Strip - 72px):** Tabular KPIs: Committed SP, Active In-Flight SP, Done SP, Team Utilization %, Overallocated alerts.
  - **Level 3 (Split Work Surface):**
    - **Left Column (35%–38%):** Capacity & Allocation Matrix (6 divisions, 24 canonical agents `#0–#23`, Active vs Committed toggle).
    - **Right Column (62%–65%):** Execution Board / Backlog Drawer with Given-When-Then criteria cards.
- **Vertical Spacing Rhythm:** Fixed 4px grid (`gap-1` = 4px, `gap-2` = 8px, `gap-3` = 12px, `gap-4` = 16px). Maximum card interior padding is 16px (`p-4`).

---

## 4. Token and Visual-System Guidance

### Colors (OKLCH & Hex)
- **Canvas / Background:**
  - Light: `#F3F3F0` (Stone Gray, not yellow parchment)
  - Dark: `#0E1015` (Deep Carbon Neutral, not pure #000)
- **Surfaces:**
  - Elevated Surface: Light `#FFFFFF` / Dark `#151821`
  - Recessed / Docked Surface: Light `#E8E8E3` / Dark `#1B1F2B`
- **Borders & Dividers:**
  - Crisp 1px Rules: Light `#D4D4CE` / Dark `#282E3D`
- **Typography Inks:**
  - Ink Primary: Light `#0F1216` / Dark `#F1F5F9` (Contrast $\ge 12:1$)
  - Ink Muted: Light `#545C6E` / Dark `#8892A6` (Contrast $\ge 4.6:1$)
- **Functional Status Solids (Never Gradients):**
  - Emerald (Done / Healthy): `#059669` (Dark `#10B981`)
  - Amber (In Review / Prep): `#D97706` (Dark `#F59E0B`)
  - Crimson (Overallocated / Blocked): `#E11D48` (Dark `#FB7185`)
  - Cobalt (Active / In-Flight): `#2563EB` (Dark `#3B82F6`)
- **Canonical Division Accent Contract (Immutable):**
  - Eksekutif (`#2563EB`), Arsitektur (`#7C3AED`), Engineering (`#0F766E`), QA (`#EA580C`), DevOps (`#DC2626`), Lounge (`#DB2777`).

### Typography
- **Heading / Structure:** `Plus Jakarta Sans`, system-ui, sans-serif (weight 700, tracking `-0.03em`).
- **Data & Numbers:** `JetBrains Mono`, SFMono-Regular, monospace (`font-variant-numeric: tabular-nums`).
- **Body & Controls:** `Inter`, -apple-system, sans-serif (weight 500, regular line height 1.4).
- *Strict Rule:* Never use proportional numbers for Story Points or financial/metric tallies.

---

## 5. Component Selection and Usage Rules
- **Buttons:**
  - *Primary:* Solid dark `#0F1216` (Light mode) / Solid white `#F1F5F9` (Dark mode) with high-contrast text.
  - *Secondary:* Bordered 1px `#D4D4CE` / `#282E3D` with hover state `#E8E8E3`.
  - *Touch Target:* Minimum height `36px` (`min-h-[36px]`).
- **Segmented Control (Toggles):**
  - Docked in `#E8E8E3` / `#1B1F2B` container with white/dark card pill selection. No sliding animation lag.
- **Drawers & Sheets:**
  - Slide from screen edge on the right. Scrim backdrop with `backdrop-blur-[4px] bg-black/25`.
- **Badges:**
  - Compact rounded pill (`rounded-full px-2 py-0.5 text-[11px] font-semibold`). Max 1 badge per item card to prevent badge soup.

---

## 6. Interaction States and Behavior
- **Pointer Down:** Instant press response (`active:scale-[0.98] active:brightness-95` in 75ms).
- **Hover:** Subtle background shift (`bg-zinc-100/60` / `dark:bg-zinc-800/40`) without card translation or scaling.
- **Focus:** High-visibility outline: `focus-visible:ring-2 focus-visible:ring-[#14B8A6] focus-visible:outline-none`.
- **Loading:** Structured tabular skeleton shimmer matching exact layout. Never generic centered spinner boxes.
- **Empty States:** Clear declarative sentence + direct CTA button (`[+ Pull from Backlog]`).

---

## 7. Content and Microcopy Guidance
- **Voice:** Declarative, active, concise engineering vernacular.
- **Labels:** Sentence case (`Save capacities`, not `Save Capacities`).
- **Forbidden Phrases:** Never use "AI-powered", "Smart", "Magical", "Unlock Pro", or "Upgrade Plan".
- **Empty Copy:** State what is absent, explain why, and provide the exact next step.

---

## 8. Accessibility Requirements
- **Standard:** WCAG 2.2 Level AA compliance mandatory.
- **Color Contrast:** All body text $\ge 4.5:1$; all large headings $\ge 3:1$; UI boundaries $\ge 3:1$.
- **Keyboard Navigation:** Full tab order across all interactive controls. Support `Esc` on all sheets/drawers/modals.
- **Motion Reduction:** `prefers-reduced-motion: reduce` must force transitions to `0.01ms` and disable all scale transforms.

---

## 9. Responsive Behavior
- **Breakpoints:** `sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`.
- **Mobile ($375\text{px}$–$640\text{px}$):**
  - Split canvas stacks vertically: Metric Strip $\rightarrow$ Execution Board $\rightarrow$ Capacity Drawer via bottom sheet.
  - Zero horizontal overflow (`overflow-x-hidden` on outer shell).
  - Tap targets expand to $\ge 44\text{px}$ for touch safety.
- **Desktop ($\ge 1280\text{px}$):**
  - Dual-column pinned split workspace.

---

## 10. AI-Specific UI Patterns
- **Agent Presence Attribution:**
  - Every agent action displays `#<id>` + Name + Avatar (`#8 Qash Al-Ghaffar 🤖`).
- **Telemetry Ticker:**
  - Real-time event updates render in high-density monospace badges with millisecond timestamps and zero candidate PII.

---

## 11. Anti-Patterns and Prohibited Choices
- ❌ **NO** purple-on-white or indigo gradient backgrounds.
- ❌ **NO** warm parchment `#FFFDF8` or cream sand body backgrounds.
- ❌ **NO** nested card containers (`card` inside `card` inside `card`).
- ❌ **NO** hover-scale (`hover:scale-105`) or elastic bounce on data tables.
- ❌ **NO** floating tab pills with deep drop shadows.
- ❌ **NO** z-index soup (strictly: Level 0 canvas, Level 10 topbar, Level 40 scrim, Level 50 drawer/modal).

---

## 12. Canonical Design References
- **Production URL:** `https://lokatalenta-sprint-planner.vercel.app`
- **Peer Surfaces:** `lokatalenta-backlog.vercel.app`, `lokatalenta-docs.vercel.app`, `lokatalenta-office-3d.vercel.app`.
- **Contract Specification:** `server/src/contracts/canonical.ts` (6 divisions, 24 agents).

---

## 13. Preflight Checklist Before Generating UI
- [ ] Has the primary job-to-be-done for this viewport been stated in one sentence?
- [ ] Are all numeric counters and Story Points using `font-mono-tabular`?
- [ ] Is every interactive control reachable via standard Tab / Shift-Tab and operational with `Space` / `Enter`?
- [ ] Are all status colors using solid functional tokens without decorative gradients?
- [ ] Is there zero paywall, pricing, or subscription reference?

---

## 14. Final UI QA Checklist
- [ ] **Contrast:** Run color picker to confirm muted text is $\ge 4.5:1$ against surface.
- [ ] **Responsive:** Test viewport at 375px width — confirm horizontal scrollbar is absent (`scrollWidth === clientWidth`).
- [ ] **State Resilience:** Verify Loading (skeleton), Empty (clear CTA), Error (amber alert banner), and Success (toast) states.
- [ ] **Cold-Start Integrity:** Verify data persists across refresh and syncs with Event Gateway.
- [ ] **Motion Check:** Toggle `prefers-reduced-motion` in browser emulation and confirm zero spring jumps.

---

## 15. Design Taste Before Pixels Protocol (Anti-Generic AI Aesthetic)
> *"You set design taste before pixels. No generic AI aesthetic. Read the room, commit to a direction, then specify the system."* — *(via AI UX Playground)*

All agents designing or modifying LokaTalenta surfaces MUST strictly execute the 5-step taste specification:
1. **Design Read (1 line):** `"Reading this as: <page kind> for <audience>, with a <vibe> language, leaning toward <aesthetic family>."` (If ambiguous, ask exactly ONE question; otherwise do not ask).
2. **Three Dials (1–10):**
   - `DESIGN_VARIANCE`: Default **3 – 4** (Structured, high-precision layout).
   - `MOTION_INTENSITY`: Default **2 – 3** (Snappy 150ms–200ms transitions, zero floaty wobble).
   - `VISUAL_DENSITY`: Default **7 – 8** (Cockpit/workbench data density, tabular monospace numbers).
3. **Anti-Default Lock:** Explicitly ban generic AI defaults (purple gradients, Inter+slate without identity, copy-paste 3 feature cards, excessive glassmorphism, cream fake parchment, and floating pill soup).
4. **Taste System:** Name aesthetic (*Industrial Precision Workbench*), establish signature element (telemetry HUD strip), lock palette roles (`#F3F3F0` / `#0E1015`), enforce type hierarchy (`Plus Jakarta Sans` + `JetBrains Mono`), and define motion intent.
5. **First-Build Checklist:** Validate tokens, establish layout structure, apply 1px borders & constrained radii, format tabular numbers, and verify WCAG 2.1 AA accessibility.
