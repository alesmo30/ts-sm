import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IngestJobSchema, type IngestJob } from '@ts-sm/shared';

import { apiClient } from '../lib/apiClient';

export type CreateReferenceInput = { kind: 'text'; name: string; body: string } | { kind: 'file'; file: File };

async function createReference(input: CreateReferenceInput): Promise<IngestJob> {
  if (input.kind === 'text') {
    return apiClient.post('/knowledge/references', IngestJobSchema, { name: input.name, body: input.body });
  }

  const formData = new FormData();
  formData.append('file', input.file);
  return apiClient.postForm('/knowledge/references', IngestJobSchema, formData);
}

export function useCreateReference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createReference,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['references'] });
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'state'] });
    },
  });
}
