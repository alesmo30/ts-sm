import { useQuery } from '@tanstack/react-query';
import { PriorityPatientSchema } from '@ts-sm/shared';
import { z } from 'zod';

import { apiClient } from '../../../shared/lib/apiClient';

export function usePriorityPatients() {
  return useQuery({
    queryKey: ['priority-patients'],
    queryFn: () => apiClient.get('/patients/priority', z.array(PriorityPatientSchema)),
  });
}
