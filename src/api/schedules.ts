import { createApiClient } from './client';

export interface Schedule {
  id?: number;
  project_id: number;
  task_name: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: number;
  status: string;
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
