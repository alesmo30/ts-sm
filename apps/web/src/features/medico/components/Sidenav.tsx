import { BookPlus, FileText, LayoutDashboard, Users } from 'lucide-react';
import type { ComponentType } from 'react';

interface NavItem {
  numbering: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
}

const NAV_ITEMS: NavItem[] = [
  { numbering: '01', label: 'Dashboard de control', icon: LayoutDashboard },
  { numbering: '02', label: 'Pacientes con atención personalizada', icon: Users },
  { numbering: '03', label: 'Agregar conocimiento', icon: BookPlus },
  { numbering: '04', label: 'Referencias', icon: FileText },
];

export function Sidenav() {
  return (
    <nav className="border-r border-border p-4">
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map((item, index) => {
          const isActive = index === 0;
          const Icon = item.icon;
          return (
            <li key={item.numbering}>
              <button
                type="button"
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'flex w-full items-center gap-3 rounded-[10px] border border-[rgba(15,232,196,.3)] bg-accent-soft px-[14px] py-3 text-left text-accent'
                    : 'flex w-full items-center gap-3 rounded-[10px] border border-transparent bg-transparent px-[14px] py-3 text-left text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg'
                }
              >
                <Icon size={17} strokeWidth={1.7} />
                <span className="text-[14px]">{item.label}</span>
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
