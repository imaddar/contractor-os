const API_BASE_URL = 'http://localhost:8000';

export interface Subcontractor {
  id?: number;
  name: string;
  contact_email?: string;
  phone?: string;
  specialty?: string;
}

export const subcontractorsApi = {
  async getAll(): Promise<Subcontractor[]> {
    const response = await fetch(`${API_BASE_URL}/subcontractors`);
    if (!response.ok) {
      throw new Error('Failed to fetch subcontractors');
    }
    return response.json();
  },

  async create(subcontractor: Omit<Subcontractor, 'id'>): Promise<Subcontractor> {
    const response = await fetch(`${API_BASE_URL}/subcontractors`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subcontractor),
    });
    if (!response.ok) {
      throw new Error('Failed to create subcontractor');
    }
    return response.json();
  },

  async update(id: number, subcontractor: Omit<Subcontractor, 'id'>): Promise<Subcontractor> {
    const response = await fetch(`${API_BASE_URL}/subcontractors/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subcontractor),
    });
    if (!response.ok) {
      throw new Error('Failed to update subcontractor');
    }
    return response.json();
  },

  async delete(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/subcontractors/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete subcontractor');
    }
  },
};
