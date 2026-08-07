export type StatusTagVariant = 'ok' | 'attn' | 'fail' | 'plain';

interface StatusTagProps {
  variant: StatusTagVariant;
}

const VARIANT_CONFIG: Record<StatusTagVariant, { label: string; className: string; dot: boolean }> = {
  ok: { label: 'Exitosa', className: 'bg-accent-soft text-accent', dot: true },
  attn: { label: 'Atención humana', className: 'bg-warn-soft text-warn', dot: true },
  fail: { label: 'No exitosa', className: 'bg-danger-soft text-danger', dot: true },
  plain: { label: 'Neutro', className: 'border border-border-mid bg-surface-2 text-muted', dot: false },
};

export function StatusTag({ variant }: StatusTagProps) {
  const { label, className, dot } = VARIANT_CONFIG[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-[10px] py-[4px] text-[11.5px] font-medium ${className}`}
    >
      {dot && <span className="h-[6px] w-[6px] rounded-full bg-current" />}
      {label}
    </span>
  );
}
