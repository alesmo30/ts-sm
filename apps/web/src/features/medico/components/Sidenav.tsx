import type { StatsCounts } from '@ts-sm/shared';
import { BookPlus, FileText, LayoutDashboard, Users } from 'lucide-react';
import type { ComponentType } from 'react';

import type { MedicoView } from '../types';

interface NavItem {
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  view: MedicoView | null;
  countKey: keyof StatsCounts | null;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard de control', icon: LayoutDashboard, view: 'dashboard', countKey: 'sessions' },
  {
    label: 'Pacientes con atención personalizada',
    icon: Users,
    view: 'priority',
    countKey: 'priorityPatients',
  },
  { label: 'Agregar conocimiento', icon: BookPlus, view: 'knowledge', countKey: null },
  { label: 'Referencias', icon: FileText, view: 'references', countKey: 'references' },
];

interface SidenavProps {
  view: MedicoView;
  onViewChange: (view: MedicoView) => void;
  counts?: StatsCounts;
}

export function Sidenav({ view, onViewChange, counts }: SidenavProps) {
  return (
    <nav className="overflow-x-auto border-b border-border p-2 min-[920px]:border-b-0 min-[920px]:border-r min-[920px]:p-4">
      <ul className="flex gap-1 min-[920px]:flex-col">
        {NAV_ITEMS.map((item) => {
          const isDisabled = item.view === null;
          const isActive = item.view === view;
          const Icon = item.icon;
          const count = item.countKey ? (counts?.[item.countKey] ?? null) : null;
          return (
            <li key={item.label} className="shrink-0 min-[920px]:shrink">
              <button
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-current={isActive ? 'page' : undefined}
                title={isDisabled ? 'Disponible próximamente' : undefined}
                onClick={isDisabled ? undefined : () => onViewChange(item.view as MedicoView)}
                className={
                  isActive
                    ? 'flex w-full items-start gap-3 rounded-[10px] border border-[rgba(15,232,196,.3)] bg-accent-soft px-[14px] py-3 text-left text-accent'
                    : isDisabled
                      ? 'flex w-full cursor-not-allowed items-start gap-3 rounded-[10px] border border-transparent bg-transparent px-[14px] py-3 text-left text-muted opacity-40'
                      : 'flex w-full items-start gap-3 rounded-[10px] border border-transparent bg-transparent px-[14px] py-3 text-left text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'
                }
              >
                <span className="mt-[1px] shrink-0">
                  <Icon size={17} strokeWidth={1.7} />
                </span>
                <span className="whitespace-normal text-[14px] leading-tight">{item.label}</span>
                <span className="ml-auto font-mono text-[11px] text-tx-muted">
                  {item.countKey ? (count ?? '—') : '—'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
