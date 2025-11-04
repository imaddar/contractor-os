import { API_BASE_URL } from './config';

export interface ApiError {
  detail?: string;
  message?: string;
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as ApiError;
    throw new Error(errorData.detail || errorData.message || `Request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Generic fetch wrapper for operations that don't return data
 */
async function apiFetchNoContent(
  url: string,
  options?: RequestInit
): Promise<void> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as ApiError;
    throw new Error(errorData.detail || errorData.message || `Request failed with status ${response.status}`);
  }
}

/**
 * Generic API client factory for CRUD operations
 */
export function createApiClient<T extends { id?: number | string }>(
  resourcePath: string
) {
  return {
    async getAll(queryParams?: Record<string, string | number | undefined>): Promise<T[]> {
      let url = `${API_BASE_URL}/${resourcePath}`;
      
      if (queryParams) {
        const searchParams = new URLSearchParams();
        Object.entries(queryParams).forEach(([key, value]) => {
          if (value !== undefined) {
            searchParams.set(key, String(value));
          }
        });
        const query = searchParams.toString();
        if (query) {
          url += `?${query}`;
        }
      }
      
      return apiFetch<T[]>(url);
    },

    async getById(id: number | string): Promise<T> {
      return apiFetch<T>(`${API_BASE_URL}/${resourcePath}/${id}`);
    },

    async create(data: Omit<T, 'id'>): Promise<T> {
      return apiFetch<T>(`${API_BASE_URL}/${resourcePath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },

    async update(id: number | string, data: Omit<T, 'id'>): Promise<T> {
      return apiFetch<T>(`${API_BASE_URL}/${resourcePath}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    },

    async delete(id: number | string): Promise<void> {
      return apiFetchNoContent(`${API_BASE_URL}/${resourcePath}/${id}`, {
        method: 'DELETE',
      });
    },
  };
}
