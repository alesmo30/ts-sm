import { useQuery } from '@tanstack/react-query';
import { ReferenceSchema } from '@ts-sm/shared';
import { z } from 'zod';

import { apiClient } from '../../../shared/lib/apiClient';

export function useReferences() {
  return useQuery({
    queryKey: ['references'],
    queryFn: () => apiClient.get('/knowledge/references', z.array(ReferenceSchema)),
  });
}
