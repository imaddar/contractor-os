const API_BASE_URL = 'http://localhost:8000';

export interface Project {
  id?: number;
  name: string;
  description?: string;
  status: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
}

export const projectsApi = {
  async getAll(): Promise<Project[]> {
    const response = await fetch(`${API_BASE_URL}/projects`);
    if (!response.ok) {
      throw new Error('Failed to fetch projects');
    }
    return response.json();
  },

  async getById(id: number): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`);
    if (!response.ok) {
      throw new Error('Failed to fetch project');
    }
    return response.json();
  },

  async create(project: Omit<Project, 'id'>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });
    if (!response.ok) {
      throw new Error('Failed to create project');
    }
    return response.json();
  },

  async update(id: number, project: Omit<Project, 'id'>): Promise<Project> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });
    if (!response.ok) {
      throw new Error('Failed to update project');
    }
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete project');
    }
  },
};
