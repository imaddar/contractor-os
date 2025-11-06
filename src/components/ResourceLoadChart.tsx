import React from "react";

export interface ResourceLoadDatum {
  subcontractorId: number;
  subcontractorName: string;
  peakLoad: number;
  hasConflict: boolean;
  conflictTaskIds: number[];
}

interface ResourceLoadChartProps {
  loads: ResourceLoadDatum[];
}

const ResourceLoadChart: React.FC<ResourceLoadChartProps> = ({ loads }) => {
  if (!loads.length) {
    return (
      <div className="resource-chart-empty">
        <p>No resource allocations captured for the current schedules.</p>
      </div>
    );
  }

  return (
    <div className="resource-chart">
      <h3>Subcontractor utilization</h3>
      <div className="resource-chart-grid">
        {loads.map((load) => {
          const percentage = Number.isFinite(load.peakLoad) ? load.peakLoad : 0;
          const clamped = Math.max(0, Math.min(percentage, 150));
          const indicator = percentage > 100 ? "Overallocated" : "Healthy";

          return (
            <div
              key={load.subcontractorId}
              className={`resource-chart-row ${load.hasConflict ? "conflict" : ""}`}
            >
              <div className="resource-chart-label">
                <span className="resource-chart-name">{load.subcontractorName}</span>
                <span className="resource-chart-indicator">{indicator}</span>
              </div>
              <div
                className="resource-chart-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={150}
                aria-valuenow={percentage}
                aria-label={`${load.subcontractorName} utilization`}
              >
                <div
                  className="resource-chart-bar-fill"
                  style={{ width: `${clamped}%` }}
                >
                  <span className="resource-chart-value">{percentage.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResourceLoadChart;
