const API_BASE_URL = 'http://localhost:8000';

export interface Schedule {
  id?: number;
  project_id: number;
  task_name: string;
  start_date?: string;
  end_date?: string;
  assigned_to?: number;
  status: string;
}

export const schedulesApi = {
  async getAll(params?: { projectId?: number; status?: string }): Promise<Schedule[]> {
    const searchParams = new URLSearchParams();
    if (params?.projectId !== undefined) {
      searchParams.set('project_id', params.projectId.toString());
    }
    if (params?.status) {
      searchParams.set('status', params.status);
    }

    const query = searchParams.toString();
    const url = query
      ? `${API_BASE_URL}/schedules?${query}`
      : `${API_BASE_URL}/schedules`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch schedules');
    }
    return response.json();
  },

  async create(schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    const response = await fetch(`${API_BASE_URL}/schedules`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schedule),
    });
    if (!response.ok) {
      throw new Error('Failed to create schedule');
    }
    return response.json();
  },

  async update(id: number, schedule: Omit<Schedule, 'id'>): Promise<Schedule> {
    const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(schedule),
    });
    if (!response.ok) {
      throw new Error('Failed to update schedule');
    }
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/schedules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete schedule');
    }
  },
};
