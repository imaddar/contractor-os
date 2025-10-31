import type { Project } from './projects';

const API_BASE_URL = 'http://localhost:8000';

export interface Document {
  id?: string;  // Change to string for vector store compatibility
  filename: string;
  content: string;
  file_size?: number;
  page_count?: number;
  chunk_count?: number;
  uploaded_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface GeneratedProjectDetails {
  name: string;
  description: string;
  address?: string;
  start_date?: string;
  end_date?: string;
  budget_estimate?: number;
  budget_currency?: string;
  assumptions?: string[];
  confidence?: string;
  additional_notes?: string;
}

export interface GenerateProjectResponse {
  source_filename: string;
  project: GeneratedProjectDetails;
  raw_response?: string;
  persisted: boolean;
  created_project?: Project;
}

export const documentsApi = {
  async getAll(): Promise<Document[]> {
    const response = await fetch(`${API_BASE_URL}/documents`);
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }
    return response.json();
  },

  async getByFilename(filename: string): Promise<Document> {
    if (!filename || filename === 'Unknown') {
      throw new Error('Invalid filename');
    }
    
    const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }
    return response.json();
  },

  async deleteByFilename(filename: string): Promise<void> {
    if (!filename || filename === 'Unknown') {
      throw new Error('Invalid filename');
    }
    
    const response = await fetch(`${API_BASE_URL}/documents/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to delete document');
    }
  },

  async uploadAndParse(file: File): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/parse-document`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to parse and save document');
    }

    return response.json();
  },

  async generateProjectFromDocument(
    filename: string,
    persist = false
  ): Promise<GenerateProjectResponse> {
    if (!filename || filename === 'Unknown') {
      throw new Error('Invalid filename');
    }

    const response = await fetch(
      `${API_BASE_URL}/documents/${encodeURIComponent(filename)}/generate-project`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ persist }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || 'Failed to generate project from document');
    }

    return response.json();
  },

  // Legacy methods for backward compatibility
  async getById(id: number): Promise<Document> {
    throw new Error('getById is deprecated - use getByFilename instead');
  },

  async delete(id: number): Promise<void> {
    throw new Error('delete is deprecated - use deleteByFilename instead');
  },
};
