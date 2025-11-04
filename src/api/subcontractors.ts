import { createApiClient } from './client';

export interface Subcontractor {
  id?: number;
  name: string;
  contact_email?: string;
  phone?: string;
  specialty?: string;
}

export const subcontractorsApi = createApiClient<Subcontractor>('subcontractors');
