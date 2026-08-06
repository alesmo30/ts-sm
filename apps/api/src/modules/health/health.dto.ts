import type { HealthResponse } from '@ts-sm/shared';

export class HealthResponseDto implements HealthResponse {
  status!: HealthResponse['status'];
  db!: HealthResponse['db'];
}
