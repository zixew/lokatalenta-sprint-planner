import { Boxes, Building2, CalendarRange, FileText, GraduationCap } from 'lucide-react';
import type { ComponentType } from 'react';
import { isSafeHttpUrl } from '../../lib/securityGuards.ts';

interface EcosystemAppLink {
  readonly id: 'lms' | 'backlog' | 'sprint-planner' | 'docs' | 'office-3d';
  readonly label: string;
  readonly href: string;
  readonly active?: boolean;
  readonly icon: ComponentType<{ className?: string }>;
}

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const ECOSYSTEM_LINKS: readonly EcosystemAppLink[] = [
  {
    id: 'lms',
    label: 'LMS Psikotes',
    href:
      import.meta.env.VITE_LMS_URL ||
      (isLocalHost ? 'http://localhost:4100' : 'https://lokatalenta.vercel.app'),
    icon: GraduationCap,
  },
  {
    id: 'backlog',
    label: 'Backlog',
    href:
      import.meta.env.VITE_BACKLOG_URL ||
      (isLocalHost ? 'http://localhost:4102' : 'https://lokatalenta-backlog.vercel.app'),
    icon: Boxes,
  },
  {
    id: 'sprint-planner',
    label: 'Sprint Planner',
    href:
      import.meta.env.VITE_SPRINT_URL ||
      import.meta.env.VITE_SPRINT_PLANNER_URL ||
      '/',
    active: true,
    icon: CalendarRange,
  },
  {
    id: 'docs',
    label: 'Docs Hub',
    href:
      import.meta.env.VITE_DOCS_URL ||
      (isLocalHost ? 'http://localhost:4104' : 'https://lokatalenta-docs.vercel.app'),
    icon: FileText,
  },
  {
    id: 'office-3d',
    label: '3D Office',
    href:
      import.meta.env.VITE_OFFICE_3D_URL ||
      (isLocalHost ? 'http://localhost:4105' : 'https://lokatalenta-office-3d.vercel.app'),
    icon: Building2,
  },
];

export function EcosystemSwitcher({
  orientation = 'horizontal',
  onNavigate,
}: {
  orientation?: 'horizontal' | 'vertical';
  onNavigate?: () => void;
}) {
  return (
    <nav
      aria-label="LokaTalenta Ecosystem"
      data-testid={orientation === 'horizontal' ? 'ecosystem-switcher' : 'ecosystem-switcher-mobile'}
      className={
        orientation === 'horizontal'
          ? 'flex items-center gap-1'
          : 'flex flex-col gap-1'
      }
    >
      {ECOSYSTEM_LINKS.map((item) => {
        const safeHref = isSafeHttpUrl(item.href) ? item.href : '#';
        const Icon = item.icon;
        const baseClasses =
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ease-out min-h-[44px] lg:min-h-[34px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F766E] dark:focus-visible:ring-[#14b8a6]';
        const stateClasses = item.active
          ? 'bg-teal-50 dark:bg-teal-950/60 text-[#0F766E] dark:text-teal-400 border border-teal-200 dark:border-teal-800'
          : 'text-[#52525B] dark:text-slate-300 border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-[#18181B] dark:hover:text-white';

        return (
          <a
            key={item.id}
            href={safeHref}
            data-testid={`ecosystem-link-${item.id}`}
            aria-current={item.active ? 'page' : undefined}
            onClick={onNavigate}
            className={`${baseClasses} ${stateClasses}`}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{item.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
