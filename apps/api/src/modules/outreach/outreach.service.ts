import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OutreachDraft, OutreachSendResult, SendOutreachEmailInput, StartOutreachCallInput } from '@ts-sm/shared';

import { LlmPort } from '../llm/llm.port';
import { PatientsService } from '../patients/patients.service';

import { assertResendReady, assertTwilioReady, type OutreachConfig } from './outreach.config';
import { buildOutreachDraftUserMessage, OUTREACH_DRAFT_PROMPT, OutreachDraftLlmSchema } from './outreach.prompt';
import { OUTREACH_CONFIG } from './outreach.tokens';
import { sendEmail as sendResendEmail } from './resend.client';
import { buildTwiml, startCall as startTwilioCall, toE164Colombia } from './twilio.client';

@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);

  constructor(
    private readonly patientsService: PatientsService,
    private readonly llmPort: LlmPort,
    @Inject(OUTREACH_CONFIG) private readonly config: OutreachConfig,
  ) {}

  async generateDraft(patientId: string): Promise<OutreachDraft> {
    const patient = await this.patientsService.getById(patientId);

    const { data } = await this.llmPort.structured(
      [
        { role: 'system', content: OUTREACH_DRAFT_PROMPT },
        { role: 'user', content: buildOutreachDraftUserMessage(patient) },
      ],
      { schema: OutreachDraftLlmSchema, schemaName: 'outreach_draft' },
    );

    return {
      ...data,
      suggestedEmail: patient.email,
      suggestedPhone: patient.phone,
    };
  }

  async sendEmail(input: SendOutreachEmailInput): Promise<OutreachSendResult> {
    assertResendReady(this.config);
    // Confirma que el paciente existe antes de gastar la llamada al proveedor.
    await this.patientsService.getById(input.patientId);

    const to = this.config.resendToOverride ?? input.to;
    const providerId = await sendResendEmail({
      apiKey: this.config.resendApiKey,
      from: this.config.resendFrom,
      to,
      subject: input.subject,
      text: input.message,
    });

    this.logger.log(`Correo enviado a paciente=${input.patientId} providerId=${providerId} overridden=${to !== input.to}`);

    return { channel: 'email', providerId, to, overridden: to !== input.to };
  }

  async startCall(input: StartOutreachCallInput): Promise<OutreachSendResult> {
    assertTwilioReady(this.config);
    await this.patientsService.getById(input.patientId);

    const overridden = Boolean(this.config.twilioToOverride);
    const to = toE164Colombia(this.config.twilioToOverride ?? input.to);
    const twiml = buildTwiml(input.script, this.config.twilioVoiceLanguage);
    const providerId = await startTwilioCall({
      accountSid: this.config.twilioAccountSid,
      authToken: this.config.twilioAuthToken,
      from: this.config.twilioFromNumber,
      to,
      twiml,
    });

    this.logger.log(`Llamada iniciada a paciente=${input.patientId} providerId=${providerId} overridden=${overridden}`);

    return { channel: 'call', providerId, to, overridden };
  }
}
