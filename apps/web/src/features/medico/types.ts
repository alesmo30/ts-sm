export type MedicoView = 'dashboard' | 'priority' | 'references';

export type Selection = { kind: 'session'; id: string } | { kind: 'patient'; id: string } | null;
