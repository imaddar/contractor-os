const API_BASE_URL = 'http://localhost:8000';

export interface DashboardSummary {
  projects: {
    total: number;
    active: number;
    total_budget: number;
  };
  tasks: {
    total: number;
    pending: number;
    in_progress: number;
    completed: number;
  };
  budgets: {
    total_budgeted: number;
    total_actual: number;
    variance: number;
  };
  subcontractors: {
    total: number;
  };
}

export const dashboardApi = {
  async getSummary(): Promise<DashboardSummary> {
    const response = await fetch(`${API_BASE_URL}/dashboard/summary`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard summary');
    }
    return response.json();
  },
};
