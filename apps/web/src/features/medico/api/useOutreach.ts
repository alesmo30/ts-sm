import { useMutation } from '@tanstack/react-query';
import {
  OutreachDraftSchema,
  OutreachSendResultSchema,
  type OutreachDraft,
  type OutreachSendResult,
  type SendOutreachEmailInput,
  type StartOutreachCallInput,
} from '@ts-sm/shared';

import { apiClient } from '../../../shared/lib/apiClient';

function generateDraft(patientId: string): Promise<OutreachDraft> {
  return apiClient.post('/outreach/draft', OutreachDraftSchema, { patientId });
}

function sendEmail(input: SendOutreachEmailInput): Promise<OutreachSendResult> {
  return apiClient.post('/outreach/email', OutreachSendResultSchema, input);
}

function startCall(input: StartOutreachCallInput): Promise<OutreachSendResult> {
  return apiClient.post('/outreach/call', OutreachSendResultSchema, input);
}

export function useOutreachDraft() {
  return useMutation({ mutationFn: generateDraft });
}

export function useSendOutreachEmail() {
  return useMutation({ mutationFn: sendEmail });
}

export function useStartOutreachCall() {
  return useMutation({ mutationFn: startCall });
}
