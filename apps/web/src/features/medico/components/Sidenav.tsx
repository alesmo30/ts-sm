import { BookPlus, FileText, LayoutDashboard, Users } from 'lucide-react';
import type { ComponentType } from 'react';

import type { MedicoView } from '../types';

interface NavItem {
  numbering: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  view: MedicoView | null;
}

const NAV_ITEMS: NavItem[] = [
  { numbering: '01', label: 'Dashboard de control', icon: LayoutDashboard, view: 'dashboard' },
  { numbering: '02', label: 'Pacientes con atención personalizada', icon: Users, view: 'priority' },
  { numbering: '03', label: 'Agregar conocimiento', icon: BookPlus, view: null },
  { numbering: '04', label: 'Referencias', icon: FileText, view: 'references' },
];

interface SidenavProps {
  view: MedicoView;
  onViewChange: (view: MedicoView) => void;
}

export function Sidenav({ view, onViewChange }: SidenavProps) {
  return (
    <nav className="overflow-x-auto border-b border-border p-2 min-[920px]:border-b-0 min-[920px]:border-r min-[920px]:p-4">
      <ul className="flex gap-1 min-[920px]:flex-col">
        {NAV_ITEMS.map((item) => {
          const isDisabled = item.view === null;
          const isActive = item.view === view;
          const Icon = item.icon;
          return (
            <li key={item.numbering} className="shrink-0 min-[920px]:shrink">
              <button
                type="button"
                disabled={isDisabled}
                aria-disabled={isDisabled}
                aria-current={isActive ? 'page' : undefined}
                title={isDisabled ? 'Disponible próximamente' : undefined}
                onClick={isDisabled ? undefined : () => onViewChange(item.view as MedicoView)}
                className={
                  isActive
                    ? 'flex w-full items-center gap-3 rounded-[10px] border border-[rgba(15,232,196,.3)] bg-accent-soft px-[14px] py-3 text-left text-accent'
                    : isDisabled
                      ? 'flex w-full cursor-not-allowed items-center gap-3 rounded-[10px] border border-transparent bg-transparent px-[14px] py-3 text-left text-muted opacity-40'
                      : 'flex w-full items-center gap-3 rounded-[10px] border border-transparent bg-transparent px-[14px] py-3 text-left text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'
                }
              >
                <Icon size={17} strokeWidth={1.7} />
                <span className="whitespace-nowrap text-[14px]">{item.label}</span>
                <span className="ml-auto font-mono text-[11px] text-tx-muted">
                  {item.numbering}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
