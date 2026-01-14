import { createApiClient } from './client';

export type ResourceCapacities = Record<string, number>;

export interface Schedule {
  id?: number;
  project_id: number;
  task_name: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: number;
  status: string;
  predecessor_ids?: number[];
  resource_capacities?: ResourceCapacities;
  progress_percent?: number;
}

const baseApi = createApiClient<Schedule>('schedules');

export const schedulesApi = {
  ...baseApi,
  async getAll(params?: { projectId?: number; status?: string }): Promise<Schedule[]> {
    const queryParams: Record<string, string | number | undefined> = {};
    if (params?.projectId !== undefined) {
      queryParams.project_id = params.projectId;
    }
    if (params?.status) {
      queryParams.status = params.status;
    }
    return baseApi.getAll(queryParams);
  },
};
