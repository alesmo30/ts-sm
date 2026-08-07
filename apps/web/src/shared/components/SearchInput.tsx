import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…' }: SearchInputProps) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-border-mid bg-surface-2 px-[14px] py-[9px]">
      <Search size={14} strokeWidth={1.7} className="shrink-0 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[13.5px] text-fg placeholder:text-tx-muted focus:outline-none"
      />
    </div>
  );
}
