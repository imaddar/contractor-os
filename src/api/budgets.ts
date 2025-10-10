const API_BASE_URL = 'http://localhost:8000';

export interface Budget {
  id?: number;
  project_id: number;
  category: string;
  budgeted_amount: number;
  actual_amount: number;
}

export const budgetsApi = {
  async getAll(projectId?: number): Promise<Budget[]> {
    const url = projectId 
      ? `${API_BASE_URL}/budgets?project_id=${projectId}`
      : `${API_BASE_URL}/budgets`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch budgets');
    }
    return response.json();
  },

  async create(budget: Omit<Budget, 'id'>): Promise<Budget> {
    const response = await fetch(`${API_BASE_URL}/budgets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(budget),
    });
    if (!response.ok) {
      throw new Error('Failed to create budget');
    }
    return response.json();
  },

  async update(id: number, budget: Omit<Budget, 'id'>): Promise<Budget> {
    const response = await fetch(`${API_BASE_URL}/budgets/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(budget),
    });
    if (!response.ok) {
      throw new Error('Failed to update budget');
    }
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/budgets/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete budget');
    }
  },
};
