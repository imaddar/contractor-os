import { createApiClient } from './client';

export interface Budget {
  id?: number;
  project_id: number;
  category: string;
  budgeted_amount: number;
  actual_amount: number;
}

const baseApi = createApiClient<Budget>('budgets');

export const budgetsApi = {
  ...baseApi,
  async getAll(projectId?: number): Promise<Budget[]> {
    return baseApi.getAll(projectId !== undefined ? { project_id: projectId } : undefined);
  },
};
