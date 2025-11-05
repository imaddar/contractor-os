import { createApiClient } from "./client";

export type ComplianceStatus =
  | "current"
  | "expiring"
  | "expired"
  | "pending"
  | "missing"
  | string;

export interface PerformanceMetrics {
  overall_score?: number | null;
  safety_score?: number | null;
  quality_score?: number | null;
  schedule_score?: number | null;
  cost_score?: number | null;
}

export interface ComplianceDocumentStatus {
  document_type: string;
  status: ComplianceStatus;
  expires_at?: string | null;
  last_verified_at?: string | null;
}

export interface Subcontractor {
  id?: number;
  name: string;
  contact_email?: string;
  phone?: string;
  specialty?: string;
  performance_metrics?: PerformanceMetrics;
  compliance_documents?: ComplianceDocumentStatus[];
  preferred_vendor?: boolean;
}

export const subcontractorsApi = createApiClient<Subcontractor>("subcontractors");
