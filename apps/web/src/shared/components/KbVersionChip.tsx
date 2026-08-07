interface KbVersionChipProps {
  version: number;
}

export function KbVersionChip({ version }: KbVersionChipProps) {
  return (
    <span className="rounded-full border border-border-mid bg-surface-2 px-[10px] py-[4px] font-mono text-[11px] text-fg">
      KB v{version}
    </span>
  );
}
