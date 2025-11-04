import { createApiClient } from './client';

export interface Project {
  id?: number;
  name: string;
  description?: string;
  address?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export const projectsApi = createApiClient<Project>('projects');
