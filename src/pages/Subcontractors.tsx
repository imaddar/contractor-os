import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  subcontractorsApi,
  type Subcontractor,
  type PerformanceMetrics,
  type ComplianceDocumentStatus,
  type ComplianceStatus,
} from "../api/subcontractors";
import EditModal from "../components/EditModal";
import DeleteModal from "../components/DeleteModal";

const COMPLIANCE_DOCUMENT_TYPES = [
  "General Liability Insurance",
  "Workers Compensation",
  "Safety Program Certification",
];

const COMPLIANCE_STATUS_OPTIONS: Array<{ value: ComplianceStatus; label: string }> = [
  { value: "current", label: "Current" },
  { value: "expiring", label: "Expiring Soon" },
  { value: "expired", label: "Expired" },
  { value: "pending", label: "Pending Review" },
  { value: "missing", label: "Missing" },
];

type MetricKey = keyof PerformanceMetrics;

type PerformanceTierKey = "elite" | "high" | "standard" | "developing" | "unrated";

const METRIC_CONFIG: Array<{ key: MetricKey; label: string }> = [
  { key: "overall_score", label: "Overall" },
  { key: "quality_score", label: "Quality" },
  { key: "safety_score", label: "Safety" },
  { key: "schedule_score", label: "Schedule" },
  { key: "cost_score", label: "Cost Control" },
];

const PERFORMANCE_TIER_LABELS: Record<PerformanceTierKey, string> = {
  elite: "Elite (90+)",
  high: "High (80-89)",
  standard: "Standard (70-79)",
  developing: "Developing (<70)",
  unrated: "Unrated",
};

interface SubcontractorFormState {
  name: string;
  contact_email: string;
  phone: string;
  specialty: string;
  preferred_vendor: boolean;
  performance_metrics: Record<MetricKey, number | "">;
  compliance_documents: ComplianceDocumentStatus[];
}

const createEmptyMetrics = (): Record<MetricKey, number | ""> => {
  const base: Partial<Record<MetricKey, number | "">> = {};
  METRIC_CONFIG.forEach(({ key }) => {
    base[key] = "";
  });
  return base as Record<MetricKey, number | "">;
};

const createDefaultComplianceDocuments = (): ComplianceDocumentStatus[] =>
  COMPLIANCE_DOCUMENT_TYPES.map((document_type) => ({
    document_type,
    status: "missing",
  }));

const normalizeMetricsForForm = (
  metrics?: PerformanceMetrics,
): Record<MetricKey, number | ""> => {
  const base = createEmptyMetrics();
  if (!metrics) {
    return base;
  }

  METRIC_CONFIG.forEach(({ key }) => {
    const value = metrics[key];
    if (typeof value === "number" && !Number.isNaN(value)) {
      base[key] = Number(value.toFixed(1));
    } else if (value !== null && value !== undefined) {
      base[key] = Number(value);
    }
  });

  return base;
};

const normalizeComplianceForForm = (
  documents?: ComplianceDocumentStatus[],
): ComplianceDocumentStatus[] => {
  const defaults = createDefaultComplianceDocuments();
  if (!documents || documents.length === 0) {
    return defaults;
  }

  const templateMap = new Map<string, ComplianceDocumentStatus>();
  defaults.forEach((doc) => templateMap.set(doc.document_type.toLowerCase(), { ...doc }));

  const additionalDocs: ComplianceDocumentStatus[] = [];

  documents.forEach((document) => {
    const key = document.document_type.toLowerCase();
    const normalized: ComplianceDocumentStatus = {
      document_type: document.document_type,
      status: document.status || "missing",
      expires_at: document.expires_at ?? null,
      last_verified_at: document.last_verified_at ?? null,
    };

    if (templateMap.has(key)) {
      templateMap.set(key, normalized);
    } else {
      additionalDocs.push(normalized);
    }
  });

  return [...templateMap.values(), ...additionalDocs];
};

const toPerformanceMetricsPayload = (
  metrics: Record<MetricKey, number | "">,
): PerformanceMetrics => {
  const payload: PerformanceMetrics = {};
  METRIC_CONFIG.forEach(({ key }) => {
    const value = metrics[key];
    if (value !== "" && value !== null && value !== undefined) {
      payload[key] = typeof value === "number" ? value : Number(value);
    }
  });
  return payload;
};

const getOverallScore = (metrics?: PerformanceMetrics): number | null => {
  if (!metrics || metrics.overall_score === null || metrics.overall_score === undefined) {
    return null;
  }
  return Number(metrics.overall_score);
};

const getPerformanceTierKey = (score: number | null | undefined): PerformanceTierKey => {
  if (score === null || score === undefined || Number.isNaN(score)) {
    return "unrated";
  }
  if (score >= 90) return "elite";
  if (score >= 80) return "high";
  if (score >= 70) return "standard";
  return "developing";
};

const getMetricColor = (value: number): string => {
  if (value >= 90) return "#0f766e";
  if (value >= 80) return "#2563eb";
  if (value >= 70) return "#f59e0b";
  if (value >= 60) return "#f97316";
  return "#dc2626";
};

const getComplianceStyle = (status: ComplianceStatus) => {
  const normalized = (status || "missing").toString().toLowerCase();
  switch (normalized) {
    case "current":
      return { backgroundColor: "#e6f4ea", color: "#166534", borderColor: "#86efac" };
    case "expiring":
      return { backgroundColor: "#fff7ed", color: "#9a3412", borderColor: "#fcd34d" };
    case "pending":
      return { backgroundColor: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" };
    case "expired":
      return { backgroundColor: "#fef2f2", color: "#b91c1c", borderColor: "#fecaca" };
    default:
      return { backgroundColor: "#f4f4f5", color: "#4338ca", borderColor: "#d9d9e3" };
  }
};

const getComplianceSummary = (documents?: ComplianceDocumentStatus[]) => {
  const docs = documents ?? [];
  return docs.reduce(
    (acc, doc) => {
      const status = (doc.status || "missing").toLowerCase();
      if (status === "current") {
        acc.current += 1;
      } else if (status === "expiring" || status === "pending") {
        acc.warning += 1;
      } else {
        acc.critical += 1;
      }
      acc.total += 1;
      return acc;
    },
    { current: 0, warning: 0, critical: 0, total: 0 },
  );
};

const performanceTierOptions: Array<{ value: PerformanceTierKey | "all"; label: string }> = [
  { value: "all", label: "All Tiers" },
  { value: "elite", label: PERFORMANCE_TIER_LABELS.elite },
  { value: "high", label: PERFORMANCE_TIER_LABELS.high },
  { value: "standard", label: PERFORMANCE_TIER_LABELS.standard },
  { value: "developing", label: PERFORMANCE_TIER_LABELS.developing },
  { value: "unrated", label: PERFORMANCE_TIER_LABELS.unrated },
];

const Subcontractors: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
  const [deletingSubcontractor, setDeletingSubcontractor] = useState<Subcontractor | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<PerformanceTierKey | "all">("all");
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [formData, setFormData] = useState<SubcontractorFormState>({
    name: "",
    contact_email: "",
    phone: "",
    specialty: "",
    preferred_vendor: false,
    performance_metrics: createEmptyMetrics(),
    compliance_documents: createDefaultComplianceDocuments(),
  });

  useEffect(() => {
    fetchSubcontractors();
  }, []);

  const fetchSubcontractors = async () => {
    try {
      setLoading(true);
      const data = await subcontractorsApi.getAll();
      setSubcontractors(data);
    } catch (err) {
      setError("Failed to fetch subcontractors");
      console.error("Error fetching subcontractors:", err);
    } finally {
      setLoading(false);
    }
  };

  const initializeFormState = useCallback(() => {
    setFormData({
      name: "",
      contact_email: "",
      phone: "",
      specialty: "",
      preferred_vendor: false,
      performance_metrics: createEmptyMetrics(),
      compliance_documents: createDefaultComplianceDocuments(),
    });
  }, []);

  const openCreateModal = useCallback(() => {
    initializeFormState();
    setEditingSubcontractor(null);
    setShowEditModal(true);
    setError(null);
  }, [initializeFormState]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openCreateModal();
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, openCreateModal]);

  const handleEdit = (subcontractor: Subcontractor) => {
    setEditingSubcontractor(subcontractor);
    setFormData({
      name: subcontractor.name,
      contact_email: subcontractor.contact_email || "",
      phone: subcontractor.phone || "",
      specialty: subcontractor.specialty || "",
      preferred_vendor: Boolean(subcontractor.preferred_vendor),
      performance_metrics: normalizeMetricsForForm(subcontractor.performance_metrics),
      compliance_documents: normalizeComplianceForForm(
        subcontractor.compliance_documents,
      ),
    });
    setShowEditModal(true);
    setError(null);
  };

  const handleDelete = (subcontractor: Subcontractor) => {
    setDeletingSubcontractor(subcontractor);
    setShowDeleteModal(true);
    setError(null);
  };

  const confirmDelete = async () => {
    if (!deletingSubcontractor) return;

    try {
      setIsSubmitting(true);
      await subcontractorsApi.delete(deletingSubcontractor.id!);
      await fetchSubcontractors();
      setShowDeleteModal(false);
      setDeletingSubcontractor(null);
      setError(null);
    } catch (err: unknown) {
      console.error("Error deleting subcontractor:", err);
      const message =
        err instanceof Error ? err.message : "Failed to delete subcontractor";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setDeletingSubcontractor(null);
    setError(null);
  };

  const closeEditModal = useCallback(() => {
    initializeFormState();
    setEditingSubcontractor(null);
    setShowEditModal(false);
    setError(null);
  }, [initializeFormState]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const subcontractorData: Subcontractor = {
        name: formData.name,
        contact_email: formData.contact_email || undefined,
        phone: formData.phone || undefined,
        specialty: formData.specialty || undefined,
        preferred_vendor: formData.preferred_vendor,
        performance_metrics: toPerformanceMetricsPayload(formData.performance_metrics),
        compliance_documents: formData.compliance_documents.map((doc) => ({
          document_type: doc.document_type,
          status: doc.status,
          expires_at: doc.expires_at || null,
          last_verified_at: doc.last_verified_at || null,
        })),
      };

      if (editingSubcontractor) {
        await subcontractorsApi.update(editingSubcontractor.id!, subcontractorData);
      } else {
        await subcontractorsApi.create(subcontractorData);
      }

      await fetchSubcontractors();
      closeEditModal();
    } catch (err) {
      setError(
        editingSubcontractor
          ? "Failed to update subcontractor"
          : "Failed to create subcontractor",
      );
      console.error("Error saving subcontractor:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const specialtyOptions = useMemo(() => {
    const options = new Set<string>();
    subcontractors.forEach((sub) => {
      if (sub.specialty) {
        options.add(sub.specialty);
      }
    });
    return Array.from(options).sort((a, b) => a.localeCompare(b));
  }, [subcontractors]);

  const filteredSubcontractors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return subcontractors.filter((sub) => {
      const matchesSearch =
        term.length === 0 ||
        [
          sub.name,
          sub.specialty,
          sub.contact_email,
          ...(sub.compliance_documents || []).map((doc) => doc.document_type),
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(term));

      if (!matchesSearch) {
        return false;
      }

      if (preferredOnly && !sub.preferred_vendor) {
        return false;
      }

      if (specialtyFilter !== "all") {
        if (!sub.specialty || sub.specialty.toLowerCase() !== specialtyFilter.toLowerCase()) {
          return false;
        }
      }

      if (tierFilter !== "all") {
        const tier = getPerformanceTierKey(getOverallScore(sub.performance_metrics));
        if (tier !== tierFilter) {
          return false;
        }
      }

      return true;
    });
  }, [subcontractors, searchTerm, specialtyFilter, tierFilter, preferredOnly]);

  const sortedSubcontractors = useMemo(() => {
    return [...filteredSubcontractors].sort((a, b) => {
      if (a.preferred_vendor !== b.preferred_vendor) {
        return a.preferred_vendor ? -1 : 1;
      }

      const scoreA = getOverallScore(a.performance_metrics);
      const scoreB = getOverallScore(b.performance_metrics);
      if (scoreA === null && scoreB === null) {
        return a.name.localeCompare(b.name);
      }
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      if (scoreA === scoreB) {
        return a.name.localeCompare(b.name);
      }
      return scoreB - scoreA;
    });
  }, [filteredSubcontractors]);

  if (loading) return <div className="page-content">Loading...</div>;

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Subcontractors</h1>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-primary" onClick={openCreateModal}>
            New Subcontractor
          </button>
        </div>
      </div>

      {error && !showDeleteModal && !showEditModal && (
        <div className="error-message" style={{ color: "#b91c1c", margin: "1rem 0" }}>
          {error}
        </div>
      )}

      <div
        className="filters-bar"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1.5rem",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          placeholder="Search by name, specialty, or compliance"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: "1 1 260px", minWidth: "220px" }}
        />
        <select
          value={specialtyFilter}
          onChange={(e) => setSpecialtyFilter(e.target.value)}
          style={{ flex: "0 0 200px" }}
        >
          <option value="all">All Specialties</option>
          {specialtyOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as PerformanceTierKey | "all")}
          style={{ flex: "0 0 200px" }}
        >
          {performanceTierOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={preferredOnly}
            onChange={(e) => setPreferredOnly(e.target.checked)}
          />
          Preferred vendors only
        </label>
      </div>

      <div className="subcontractors-list">
        {sortedSubcontractors.length === 0 ? (
          <div className="empty-state">
            <p>No subcontractors found. Adjust your filters or add a new partner.</p>
          </div>
        ) : (
          <div className="projects-grid" style={{ gap: "1.5rem" }}>
            {sortedSubcontractors.map((subcontractor) => {
              const overallScore = getOverallScore(subcontractor.performance_metrics);
              const tierKey = getPerformanceTierKey(overallScore);
              const tierLabel = PERFORMANCE_TIER_LABELS[tierKey];
              const complianceSummary = getComplianceSummary(
                subcontractor.compliance_documents,
              );

              return (
                <div key={subcontractor.id} className="project-card" style={{ padding: "1.5rem" }}>
                  <div className="project-header" style={{ alignItems: "flex-start" }}>
                    <div>
                      <h3 style={{ marginBottom: "0.25rem" }}>{subcontractor.name}</h3>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {subcontractor.specialty && (
                          <span className="status active">{subcontractor.specialty}</span>
                        )}
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "999px",
                            backgroundColor: "#eff6ff",
                            color: "#1d4ed8",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                          }}
                        >
                          {tierLabel}
                        </span>
                        {subcontractor.preferred_vendor && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.15rem 0.5rem",
                              borderRadius: "999px",
                              backgroundColor: "#fef3c7",
                              color: "#92400e",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              textTransform: "uppercase",
                            }}
                          >
                            Preferred Vendor
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "2rem", fontWeight: 700 }}>
                        {overallScore !== null ? Math.round(overallScore) : "—"}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>Performance</div>
                    </div>
                  </div>

                  <div style={{ margin: "1rem 0" }}>
                    {METRIC_CONFIG.filter(({ key }) => key !== "overall_score").map(
                      ({ key, label }) => {
                        const value =
                          subcontractor.performance_metrics?.[key] ?? null;
                        const numericValue =
                          typeof value === "number" ? Math.max(0, Math.min(100, value)) : null;
                        return (
                          <div
                            key={key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.75rem",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span style={{ width: "130px", color: "#4b5563" }}>{label}</span>
                            <div
                              style={{
                                flex: 1,
                                height: "6px",
                                borderRadius: "999px",
                                backgroundColor: "#e5e7eb",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  height: "100%",
                                  width: `${numericValue ?? 0}%`,
                                  backgroundColor:
                                    numericValue !== null
                                      ? getMetricColor(numericValue)
                                      : "transparent",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                            <span style={{ width: "3rem", textAlign: "right" }}>
                              {numericValue !== null ? `${Math.round(numericValue)}%` : "—"}
                            </span>
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div style={{ marginBottom: "1rem" }}>
                    <h4 style={{ fontSize: "0.9rem", marginBottom: "0.5rem" }}>Compliance</h4>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                      }}
                    >
                      {(subcontractor.compliance_documents || []).map((doc) => {
                        const style = getComplianceStyle(doc.status);
                        return (
                          <span
                            key={`${subcontractor.id}-${doc.document_type}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.35rem",
                              padding: "0.25rem 0.6rem",
                              borderRadius: "999px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              border: `1px solid ${style.borderColor}`,
                              backgroundColor: style.backgroundColor,
                              color: style.color,
                            }}
                          >
                            {doc.document_type}
                            <span style={{ textTransform: "capitalize" }}>{doc.status}</span>
                          </span>
                        );
                      })}
                    </div>
                    {complianceSummary.total > 0 && (
                      <div style={{ fontSize: "0.75rem", color: "#6b7280", marginTop: "0.5rem" }}>
                        {complianceSummary.current} current · {complianceSummary.warning} warning ·
                        {" "}
                        {complianceSummary.critical} needs action
                      </div>
                    )}
                  </div>

                  <div className="project-details">
                    {subcontractor.contact_email && (
                      <div className="detail">
                        <strong>Email:</strong> {subcontractor.contact_email}
                      </div>
                    )}
                    {subcontractor.phone && (
                      <div className="detail">
                        <strong>Phone:</strong> {subcontractor.phone}
                      </div>
                    )}
                  </div>

                  <div className="project-actions">
                    <button
                      className="btn btn-small btn-secondary"
                      onClick={() => handleEdit(subcontractor)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-small btn-danger"
                      onClick={() => handleDelete(subcontractor)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditModal
        isOpen={showEditModal}
        title={editingSubcontractor ? "Edit Subcontractor" : "Add Subcontractor"}
        onClose={closeEditModal}
        onSubmit={handleSubmit}
        submitText={editingSubcontractor ? "Update Subcontractor" : "Add Subcontractor"}
        isLoading={isSubmitting}
      >
        <div className="form-group">
          <label htmlFor="name">Name *</label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="contact_email">Email</label>
          <input
            type="email"
            id="contact_email"
            value={formData.contact_email}
            onChange={(e) =>
              setFormData({ ...formData, contact_email: e.target.value })
            }
          />
        </div>

        <div className="form-group">
          <label htmlFor="phone">Phone</label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="specialty">Specialty</label>
          <input
            type="text"
            id="specialty"
            value={formData.specialty}
            onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
            placeholder="e.g., Plumbing, Electrical, Carpentry"
          />
        </div>

        <div className="form-group" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            id="preferred_vendor"
            checked={formData.preferred_vendor}
            onChange={(e) =>
              setFormData({ ...formData, preferred_vendor: e.target.checked })
            }
          />
          <label htmlFor="preferred_vendor" style={{ margin: 0 }}>
            Mark as preferred vendor
          </label>
        </div>

        <div className="form-section" style={{ marginTop: "1.5rem" }}>
          <h4 style={{ marginBottom: "0.75rem" }}>Performance Metrics</h4>
          <div className="form-row" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            {METRIC_CONFIG.map(({ key, label }) => (
              <div
                className="form-group"
                key={key}
                style={{ flex: key === "overall_score" ? "1 1 100%" : "1 1 180px" }}
              >
                <label htmlFor={`metric-${key}`}>
                  {label} {key === "overall_score" ? "(0-100)" : "score"}
                </label>
                <input
                  type="number"
                  id={`metric-${key}`}
                  value={formData.performance_metrics[key]}
                  min={0}
                  max={100}
                  step={1}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => ({
                      ...prev,
                      performance_metrics: {
                        ...prev.performance_metrics,
                        [key]: value === "" ? "" : Math.max(0, Math.min(100, Number(value))),
                      },
                    }));
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="form-section" style={{ marginTop: "1.5rem" }}>
          <h4 style={{ marginBottom: "0.75rem" }}>Compliance Documents</h4>
          {formData.compliance_documents.map((doc, index) => (
            <div
              className="form-row"
              key={`${doc.document_type}-${index}`}
              style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "0.75rem" }}
            >
              <div className="form-group" style={{ flex: "1 1 220px" }}>
                <label>{doc.document_type}</label>
                <select
                  value={doc.status}
                  onChange={(e) => {
                    const value = e.target.value as ComplianceStatus;
                    setFormData((prev) => {
                      const updated = [...prev.compliance_documents];
                      updated[index] = { ...updated[index], status: value };
                      return { ...prev, compliance_documents: updated };
                    });
                  }}
                >
                  {COMPLIANCE_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: "0 0 180px" }}>
                <label>Expires On</label>
                <input
                  type="date"
                  value={doc.expires_at ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData((prev) => {
                      const updated = [...prev.compliance_documents];
                      updated[index] = {
                        ...updated[index],
                        expires_at: value ? value : null,
                      };
                      return { ...prev, compliance_documents: updated };
                    });
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </EditModal>

      <DeleteModal
        isOpen={showDeleteModal}
        title="Delete Subcontractor"
        message="Are you sure you want to delete this subcontractor? They will be unassigned from any scheduled tasks."
        itemName={deletingSubcontractor?.name || ""}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
        isLoading={isSubmitting}
        error={error}
      />
    </div>
  );
};

export default Subcontractors;
