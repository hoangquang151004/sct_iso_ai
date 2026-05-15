"use client";

import {
  Chart as ChartJS,
  type ChartData,
  type ChartOptions,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Bar, Doughnut, Line, Scatter } from "react-chartjs-2";

import {
  actionsBySourceChartData,
  anomalyDetectionChartData,
  anomalyForecastStartIndex,
  anomalyThresholdValue,
  deviationByCCPChartData,
  hazardAnalysisScatterData,
  incidentTrendsChartData,
  internalAuditChartData,
  oeeQualityYieldChartData,
  reportSparklineData,
} from "@/lib/mock-data";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
);

const baseLineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: "#94a3b8",
        font: { size: 10 },
      },
    },
    y: {
      grid: {
        color: "#e2e8f0",
      },
      ticks: {
        color: "#94a3b8",
        font: { size: 10 },
      },
    },
  },
};

const baseDoughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right" as const,
      labels: {
        boxWidth: 10,
        boxHeight: 10,
      },
    },
  },
  cutout: "70%",
};

const baseBarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
  },
  scales: {
    x: {
      grid: {
        display: false,
      },
      ticks: {
        color: "#94a3b8",
        font: { size: 10 },
      },
    },
    y: {
      grid: {
        color: "#e2e8f0",
      },
      ticks: {
        color: "#94a3b8",
        font: { size: 10 },
      },
    },
  },
};

const reportsKpiSnapshotBarOptions: ChartOptions<"bar"> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: {
      display: true,
      position: "bottom",
      labels: {
        boxWidth: 10,
        boxHeight: 10,
        font: { size: 10 },
        color: "#64748b",
      },
    },
    tooltip: { mode: "index", intersect: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: "#94a3b8", font: { size: 10 } },
    },
    y: {
      type: "linear",
      position: "left",
      title: {
        display: true,
        text: "Số CAPA quá hạn",
        color: "#64748b",
        font: { size: 10 },
      },
      min: 0,
      grid: { color: "#e2e8f0" },
      ticks: { color: "#94a3b8", font: { size: 10 } },
    },
    y1: {
      type: "linear",
      position: "right",
      title: {
        display: true,
        text: "% (PRP, HACCP, CAPA đúng hạn)",
        color: "#64748b",
        font: { size: 10 },
      },
      min: 0,
      max: 100,
      grid: { drawOnChartArea: false },
      ticks: { color: "#94a3b8", font: { size: 10 } },
    },
  },
};

const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart: ChartJS, _args: unknown, options?: { text?: string }) {
    const text = options?.text;
    if (!text) {
      return;
    }

    const { ctx, chartArea } = chart;
    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;

    ctx.save();
    ctx.font = "600 18px Inter, sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, centerX, centerY);
    ctx.restore();
  },
};

const scatterLabelPlugin = {
  id: "scatterLabels",
  afterDatasetsDraw(chart: ChartJS) {
    const { ctx } = chart;

    chart.data.datasets.forEach((dataset, index) => {
      const meta = chart.getDatasetMeta(index);
      const point = meta?.data?.[0];
      const label = dataset.label;

      if (!point || !label) {
        return;
      }

      const { x, y } = point.getProps(["x", "y"], true) as {
        x: number;
        y: number;
      };

      ctx.save();
      ctx.font = "600 11px Inter, sans-serif";
      ctx.fillStyle = "#374151";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, x + 8, y - 8);
      ctx.restore();
    });
  },
};

const anomalyOverlayPlugin = {
  id: "anomalyOverlay",
  beforeDatasetsDraw(chart: ChartJS) {
    const { ctx, chartArea, scales } = chart;
    const xScale = scales.x;
    const yScale = scales.y;

    if (!xScale || !yScale) {
      return;
    }

    const forecastIndex = Math.max(0, anomalyForecastStartIndex);
    const forecastX = xScale.getPixelForValue(forecastIndex);

    ctx.save();
    ctx.fillStyle = "rgba(59, 130, 246, 0.08)";
    ctx.fillRect(
      forecastX,
      chartArea.top,
      chartArea.right - forecastX,
      chartArea.bottom - chartArea.top,
    );

    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillStyle = "#6b7280";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(
      "Dự báo",
      forecastX + (chartArea.right - forecastX) / 2,
      chartArea.top + 6,
    );

    const thresholdY = yScale.getPixelForValue(anomalyThresholdValue);
    ctx.strokeStyle = "#3b82f6";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(chartArea.left, thresholdY);
    ctx.lineTo(chartArea.right, thresholdY);
    ctx.stroke();

    ctx.restore();
  },
};

const ccp1TemperatureChartData: ChartData<"line", number[], string> = {
  labels: ["13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30"],
  datasets: [
    {
      label: "Nhiệt độ đo (°C)",
      data: [90, 89, 90, 88, 87, 85, 82],
      borderColor: "#ef4444",
      backgroundColor: "rgba(239, 68, 68, 0.12)",
      fill: true,
      tension: 0.35,
      pointRadius: 3,
      pointBackgroundColor: "#ef4444",
    },
    {
      label: "Giới hạn tới thiểu (88°C)",
      data: [88, 88, 88, 88, 88, 88, 88],
      borderColor: "#10b981",
      backgroundColor: "transparent",
      borderDash: [6, 4],
      fill: false,
      tension: 0,
      pointRadius: 0,
    },
  ],
};

export function Ccp1TemperatureChart() {
  return (
    <div className="h-56">
      <Line
        data={ccp1TemperatureChartData}
        options={{
          ...baseLineOptions,
          plugins: {
            ...baseLineOptions.plugins,
            legend: {
              display: true,
              position: "bottom" as const,
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                padding: 12,
                font: { size: 10 },
              },
            },
          },
          scales: {
            ...baseLineOptions.scales,
            y: {
              ...baseLineOptions.scales.y,
              min: 78,
              max: 94,
              ticks: {
                ...baseLineOptions.scales.y.ticks,
                callback: (value: string | number) => `${value}°C`,
              },
            },
          },
        }}
      />
    </div>
  );
}

export function IncidentTrendsChart() {
  return (
    <div className="h-56">
      <Line
        data={incidentTrendsChartData}
        options={{
          ...baseLineOptions,
          plugins: {
            ...baseLineOptions.plugins,
            legend: {
              display: true,
              position: "bottom" as const,
              labels: {
                boxWidth: 10,
                boxHeight: 10,
                padding: 15,
                font: {
                  size: 11,
                },
              },
            },
          },
        }}
      />
    </div>
  );
}

export function DeviationByCcpChart() {
  const maxValue = Math.max(
    ...(deviationByCCPChartData.datasets[0]?.data ?? [0]),
  );

  return (
    <div className="h-40">
      <Doughnut
        data={deviationByCCPChartData}
        options={{
          ...baseDoughnutOptions,
          plugins: {
            ...baseDoughnutOptions.plugins,
            centerText: { text: `${maxValue}%` },
          } as Record<string, unknown>,
        }}
        plugins={[centerTextPlugin]}
      />
    </div>
  );
}

type ActionsBySourceChartProps = {
  chartData?: ChartData<"doughnut", (number | null)[], string>;
};

export function ActionsBySourceChart({ chartData }: ActionsBySourceChartProps) {
  const data = chartData ?? actionsBySourceChartData;
  const maxValue = Math.max(...(data.datasets[0]?.data ?? [0]).map(v => Number(v) || 0));

  return (
    <div className="h-56">
      <Doughnut
        data={data}
        options={{
          ...baseDoughnutOptions,
          plugins: {
            ...baseDoughnutOptions.plugins,
            centerText: { text: maxValue > 0 ? `${maxValue}` : "0" },
          } as Record<string, unknown>,
        }}
        plugins={[centerTextPlugin]}
      />
    </div>
  );
}

export function HazardAnalysisChart() {
  return (
    <div className="h-56">
      <Scatter
        data={hazardAnalysisScatterData}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
          },
          scales: {
            x: {
              min: 0,
              max: 10,
              grid: { color: "#f1f5f9" },
              ticks: {
                color: "#94a3b8",
                callback: (value: string | number) =>
                  Number(value) === 0
                    ? "Low"
                    : Number(value) === 10
                      ? "High"
                      : "",
              },
              title: {
                display: true,
                text: "Likelihood",
                color: "#374151",
                font: { size: 11, weight: "bold" },
              },
            },
            y: {
              min: 0,
              max: 10,
              grid: { color: "#f1f5f9" },
              ticks: {
                color: "#94a3b8",
                callback: (value: string | number) =>
                  Number(value) === 0
                    ? "Low"
                    : Number(value) === 10
                      ? "High"
                      : "",
              },
              title: {
                display: true,
                text: "Likelihood",
                color: "#374151",
                font: { size: 11, weight: "bold" },
              },
            },
          },
        }}
        plugins={[scatterLabelPlugin]}
      />
    </div>
  );
}

type OeeQualityYieldChartProps = {
  chartData?: ChartData<"bar", (number | null)[], string>;
};

export function OeeQualityYieldChart({ chartData }: OeeQualityYieldChartProps) {
  return (
    <div className="h-56">
      <Bar
        data={chartData ?? oeeQualityYieldChartData}
        options={{
          ...baseBarOptions,
          scales: {
            ...baseBarOptions.scales,
            y: {
              ...baseBarOptions.scales.y,
              min: 0,
              max: 100,
            },
          },
        }}
      />
    </div>
  );
}

type ReportsKpiSnapshotBarChartProps = {
  chartData?: ChartData<"bar", (number | null)[], string>;
};

/** Biểu đồ cột nhóm KPI snapshot: CAPA (trục trái) + % PRP/HACCP/CAPA đúng hạn (trục phải). */
export function ReportsKpiSnapshotBarChart({ chartData }: ReportsKpiSnapshotBarChartProps) {
  if (!chartData?.labels?.length) {
    return (
      <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
        Chưa có dữ liệu snapshot trong phạm vi này.
      </div>
    );
  }
  return (
    <div className="h-80 min-h-[20rem]">
      <Bar data={chartData} options={reportsKpiSnapshotBarOptions} />
    </div>
  );
}

type InternalAuditChartProps = {
  chartData?: ChartData<"bar", (number | null)[], string>;
};

export function InternalAuditChart({ chartData }: InternalAuditChartProps) {
  return (
    <div className="h-56">
      <Bar data={chartData ?? internalAuditChartData} options={baseBarOptions} />
    </div>
  );
}

export function AnomalyDetectionChart() {
  return (
    <div className="h-56">
      <Line
        data={anomalyDetectionChartData}
        options={{
          ...baseLineOptions,
          scales: {
            x: {
              ...baseLineOptions.scales.x,
              grid: { color: "#f1f5f9" },
            },
            y: {
              ...baseLineOptions.scales.y,
              min: 22,
              max: 34,
              ticks: {
                ...baseLineOptions.scales.y.ticks,
                stepSize: 2,
              },
            },
          },
        }}
        plugins={[anomalyOverlayPlugin]}
      />
    </div>
  );
}

type ReportSparklineChartProps = {
  values?: number[];
};

export function ReportSparklineChart({ values }: ReportSparklineChartProps) {
  const series = values && values.length > 0 ? values : reportSparklineData;
  return (
    <div className="h-20">
      <Bar
        data={{
          labels: series.map((_, index) => `${index}`),
          datasets: [
            {
              data: series,
              backgroundColor: "#60a5fa",
              borderRadius: 4,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { display: false },
            y: { display: false },
          },
        }}
      />
    </div>
  );
}
