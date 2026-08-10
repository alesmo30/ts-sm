import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ReferenceSchema, type Reference } from '@ts-sm/shared';

import { apiClient } from '../lib/apiClient';

export function useSetReferenceActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }): Promise<Reference> =>
      apiClient.patch(`/knowledge/references/${id}`, ReferenceSchema, { active }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['references'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'state'] });
      void queryClient.invalidateQueries({ queryKey: ['stats-counts'] });
    },
  });
}
