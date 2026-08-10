export type MedicoView = 'dashboard' | 'priority' | 'references' | 'knowledge';

export type Selection = { kind: 'session'; id: string } | { kind: 'patient'; id: string } | null;
