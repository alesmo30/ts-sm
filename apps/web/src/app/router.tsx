import { Navigate, Route, Routes } from 'react-router-dom';

import { MedicoPage } from '../features/medico';
import { PacientePage } from '../features/paciente';
import { AppLayout } from '../shared/layouts/AppLayout';

export function AppRouter() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/medico" replace />} />
        <Route path="/medico" element={<MedicoPage />} />
        <Route path="/paciente" element={<PacientePage />} />
      </Routes>
    </AppLayout>
  );
}
