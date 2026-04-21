// ============================================================================
// Mock Data File - SCT-ISO.AI Frontend
// ============================================================================
// This file contains all sample data used across the 8 modules
// Includes chart datasets from original HTML designs
// Easily extensible for API integration or state management later

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface KPIMetric {
  label: string;
  value: number;
  unit: "%";
  color?: "cyan" | "slate" | "emerald" | "amber";
}

export interface IoTReading {
  temperature: number;
  humidity: number;
  pH: number;
  pressure: number;
}

export interface Task {
  title: string;
  dueDate: string;
  status?: "scheduled" | "pending";
}

export interface Alert {
  message: string;
  type?: "error" | "warning" | "info";
  timestamp?: string;
}

export interface Document {
  id: string;
  name: string;
  type: string;
  department: string;
  standard: string;
  status: "Đã phê duyệt" | "Đang xem xét" | "Từ chối";
  version: string;
  lastModified: string;
  modifiedBy: string;
}

export interface ProcessStage {
  name: string;
}

export interface CCP {
  id: string;
  name: string;
  processStage: string;
  hazardType: "Sinh học" | "Hóa học" | "Vật lý" | "Đào tạo";
  criticalLimit: string;
  unit: string;
}

export interface MonitoringRecord {
  lotId: string;
  date: string;
  time: string;
  value: string;
}

export interface CapaStat {
  label: string;
  count: number;
  color: "amber" | "blue" | "slate" | "emerald";
}

export interface CAPA {
  id: string;
  title: string;
  source: string;
  status: "Mở" | "Đang xử lý" | "Đã đóng";
  priority: "High" | "Medium" | "Low";
}

export interface CapaTableRow {
  id: string;
  description: string;
  source: string;
  status: "Mở" | "Đang xử lý";
  dueDate: string;
  assignee: string;
}

export interface AuditScore {
  value: number;
  maxValue: number;
}

export interface ChecklistItem {
  id: string;
  name: string;
  status: "Pass" | "Fail" | "N/A";
}

export interface NonConformity {
  message: string;
}

export interface UpcomingAudit {
  zone: string;
  date: string;
}

export interface PrpChecklistTableRow {
  id: string;
  item: string;
  rating: "pass" | "warn" | "fail" | "note";
  note: string;
  photoType: "image" | "empty" | "label";
}

export interface UserRole {
  name: string;
  permissions: {
    view: boolean;
    edit: boolean;
    delete: boolean;
  };
}

export interface AuditLog {
  action: string;
  timestamp: string;
}

export interface SecurityFeature {
  title: string;
  description: string;
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

export const dashboardKPIs: KPIMetric[] = [
  { label: "Tuân thủ PRP", value: 98, unit: "%", color: "slate" },
  { label: "Tuân thủ HACCP", value: 98, unit: "%", color: "slate" },
  { label: "CAPA đúng hạn", value: 92, unit: "%", color: "slate" },
];

export const dashboardIoTReadings: IoTReading = {
  temperature: 7.5,
  humidity: 72,
  pH: 6.9,
  pressure: 1.2,
};

export const dashboardTasks: Task[] = [
  { title: "Đánh giá PRP", dueDate: "30/11/2023", status: "pending" },
  { title: "Rà soát HACCP", dueDate: "05/12/2023", status: "pending" },
  {
    title: "Hiệu chuẩn thiết bị",
    dueDate: "07/12/2023",
    status: "pending",
  },
];

export const dashboardAlerts: Alert[] = [
  {
    message: "Nhiệt độ CCP1 vượt ngưỡng",
    type: "error",
    timestamp: "Vừa xong",
  },
  {
    message: "Phát hiện điểm không phù hợp mới",
    type: "warning",
    timestamp: "3 giờ trước",
  },
];

// Chart Data - Incident Trends (Line Chart)
export const incidentTrendsChartData = {
  labels: [
    "Thg 1",
    "Thg 2",
    "Thg 3",
    "Thg 4",
    "Thg 5",
    "Thg 6",
    "Thg 7",
    "Thg 8",
    "Thg 9",
    "Thg 10",
    "Thg 11",
    "Thg 12",
  ],
  datasets: [
    {
      label: "Sự cố",
      data: [5, 8, 6, 9, 7, 12, 10, 14, 11, 15, 18, 22],
      borderColor: "#f97316",
      backgroundColor: "rgba(249, 115, 22, 0.1)",
      fill: true,
      tension: 0.4,
    },
  ],
};

// Chart Data - Deviation by CCP (Pie Chart)
export const deviationByCCPChartData = {
  labels: ["CCP1", "CCP2", "CCP3"],
  datasets: [
    {
      data: [25, 50, 25],
      backgroundColor: ["#f97316", "#06b6d4", "#10b981"],
      borderColor: ["#ffffff"],
      borderWidth: 2,
    },
  ],
};

// ============================================================================
// DOCUMENT CONTROL DATA
// ============================================================================

export const documents: Document[] = [
  {
    id: "DOC-001",
    name: "QM-001 Sổ tay chất lượng",
    type: "Sổ tay chất lượng",
    department: "Đảm bảo chất lượng",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "1.0",
    lastModified: "15/01/2024",
    modifiedBy: "Alice Brown",
  },
  {
    id: "DOC-002",
    name: "SOP-005 Quy trình vệ sinh",
    type: "SOP",
    department: "Sản xuất",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "2.0",
    lastModified: "10/02/2024",
    modifiedBy: "John Doe",
  },
  {
    id: "DOC-003",
    name: "WI-004 Phát hiện kim loại",
    type: "SOP",
    department: "Bảo trì",
    standard: "ISO 22000:2018",
    status: "Đang xem xét",
    version: "1.0",
    lastModified: "05/03/2024",
    modifiedBy: "David Wilson",
  },
  {
    id: "DOC-004",
    name: "SOP-002 Quy trình hiệu chuẩn",
    type: "SOP",
    department: "Vệ sinh",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "1.0",
    lastModified: "28/01/2024",
    modifiedBy: "Emily White",
  },
  {
    id: "DOC-005",
    name: "SOP-007 Kiểm soát côn trùng",
    type: "Biểu mẫu",
    department: "Kho",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "2.0",
    lastModified: "18/02/2024",
    modifiedBy: "Jamel Khan",
  },
  {
    id: "DOC-006",
    name: "FORM-009 Kiểm tra kính/Danh mục kiểm tra",
    type: "Biểu mẫu",
    department: "QA",
    standard: "ISO 22000",
    status: "Đã phê duyệt",
    version: "3.0",
    lastModified: "12/03/2024",
    modifiedBy: "Claire Lewis",
  },
  {
    id: "DOC-007",
    name: "WI-015 Kiểm soát dị ứng",
    type: "SOP",
    department: "Kho",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "2.0",
    lastModified: "30/01/2024",
    modifiedBy: "Gdre Awarn",
  },
  {
    id: "DOC-008",
    name: "SOP-010 Lịch vệ sinh",
    type: "SOP",
    department: "Sản xuất",
    standard: "ISO 22000:2018",
    status: "Đã phê duyệt",
    version: "1.0",
    lastModified: "25/02/2024",
    modifiedBy: "Mark Thompson",
  },
];

// ============================================================================
// HACCP COMPLIANCE DATA
// ============================================================================

export const processFlow: ProcessStage[] = [
  { name: "Tiếp nhận" },
  { name: "Rửa" },
  { name: "Thanh trùng" },
  { name: "Chiết rót" },
];

export const ccps: CCP[] = [
  {
    id: "CCP1",
    name: "Thanh trùng",
    processStage: "Thanh trùng",
    hazardType: "Sinh học",
    criticalLimit: "Xác nhận hiệu chuẩn",
    unit: "°C",
  },
  {
    id: "CCP1",
    name: "Thanh trùng",
    processStage: "Thanh trùng",
    hazardType: "Sinh học",
    criticalLimit: "Rà soát quy trình",
    unit: "°C",
  },
  {
    id: "CCP1",
    name: "Thanh trùng",
    processStage: "Thanh trùng",
    hazardType: "Đào tạo",
    criticalLimit: "Đào tạo",
    unit: "Không áp dụng",
  },
];

export const monitoringRecords: MonitoringRecord[] = [
  { lotId: "001", date: "03/12/2023", time: "10:15", value: "162.1 °F" },
  { lotId: "002", date: "04/12/2023", time: "14:30", value: "159.8 °F" },
  { lotId: "003", date: "05/12/2023", time: "09:50", value: "161.9 °F" },
];

// Hazard Analysis Data (scatter chart)
export const hazardAnalysisScatterData = {
  datasets: [
    {
      label: "Sinh học",
      data: [{ x: 8, y: 7 }],
      backgroundColor: "#f97316",
      pointRadius: 6,
    },
    {
      label: "Hóa học",
      data: [{ x: 6, y: 4 }],
      backgroundColor: "#10b981",
      pointRadius: 6,
    },
    {
      label: "Vật lý",
      data: [{ x: 3, y: 5 }],
      backgroundColor: "#3b82f6",
      pointRadius: 6,
    },
  ],
};

export const haccpBreadcrumb = "Sản xuất nước ép đóng chai &gt; Các công đoạn";

// ============================================================================
// CAPA MANAGEMENT DATA
// ============================================================================

export const capaStats: CapaStat[] = [
  { label: "Mở", count: 24, color: "amber" },
  { label: "Đang xử lý", count: 18, color: "blue" },
  { label: "Đã đóng", count: 26, color: "slate" },
  { label: "Đóng đúng hạn", count: 80, color: "emerald" },
];

// Chart Data - Actions by Source (Pie Chart)
export const actionsBySourceChartData = {
  labels: ["HACCP", "PRP", "Khiếu nại"],
  datasets: [
    {
      data: [50, 30, 20],
      backgroundColor: ["#f97316", "#06b6d4", "#10b981"],
      borderColor: ["#ffffff"],
      borderWidth: 2,
    },
  ],
};

export const capaActions: CAPA[] = [
  {
    id: "CP-043",
    title: "Khắc phục sự cố thiết bị",
    source: "HACCP",
    status: "Mở",
    priority: "High",
  },
  {
    id: "CP-039",
    title: "Khắc phục hoạt động côn trùng",
    source: "PRP",
    status: "Mở",
    priority: "High",
  },
  {
    id: "CP-031",
    title: "Cập nhật SOP kiểm soát nhiệt độ",
    source: "HACCP",
    status: "Mở",
    priority: "Medium",
  },
  {
    id: "CP-029",
    title: "Điều tra khiếu nại dị vật",
    source: "HACCP",
    status: "Mở",
    priority: "High",
  },
  {
    id: "CP-043",
    title: "Điều tra sự cố độc tố",
    source: "Khiếu nại",
    status: "Đang xử lý",
    priority: "High",
  },
  {
    id: "CP-039",
    title: "Báo cáo sự cố lặp lại",
    source: "Khiếu nại",
    status: "Đã đóng",
    priority: "Medium",
  },
];

export const capaTableRows: CapaTableRow[] = [
  {
    id: "CP-043",
    description: "Khắc phục sự cố thiết bị",
    source: "HACCP",
    status: "Mở",
    dueDate: "10/2023",
    assignee: "Michael R.",
  },
  {
    id: "CP-039",
    description: "Khắc phục hoạt động côn trùng",
    source: "PRP",
    status: "Mở",
    dueDate: "12/2023",
    assignee: "Sarah W.",
  },
  {
    id: "CP-031",
    description: "Cập nhật SOP kiểm soát nhiệt độ",
    source: "HACCP",
    status: "Mở",
    dueDate: "Hạn 2023",
    assignee: "Jondo G.",
  },
  {
    id: "CP-029",
    description: "Điều tra khiếu nại dị vật",
    source: "HACCP",
    status: "Mở",
    dueDate: "Hạn 2023",
    assignee: "John D.",
  },
  {
    id: "CP-043",
    description: "Điều tra sự cố độc tố",
    source: "Khiếu nại",
    status: "Đang xử lý",
    dueDate: "02/12/2023",
    assignee: "Mark T.",
  },
  {
    id: "CP-039",
    description: "Báo cáo sự cố lặp lại",
    source: "Khiếu nại",
    status: "Mở",
    dueDate: "01/12/2023",
    assignee: "John",
  },
];

// ============================================================================
// PRP AUDIT DATA
// ============================================================================

export const prpAuditScore: AuditScore = {
  value: 95,
  maxValue: 100,
};

export const prpChecklist: ChecklistItem[] = [
  { id: "check-1", name: "Vệ sinh", status: "Pass" },
  { id: "check-2", name: "Kiểm soát côn trùng", status: "Pass" },
  { id: "check-3", name: "Tình trạng kho", status: "Pass" },
  { id: "check-4", name: "Bảo trì thiết bị", status: "Pass" },
  { id: "check-5", name: "Vệ sinh nhân viên", status: "Fail" },
];

export const prpChecklistTableRows: PrpChecklistTableRow[] = [
  {
    id: "row-1",
    item: "Vệ sinh",
    rating: "pass",
    note: "Cần vệ sinh bổ sung",
    photoType: "image",
  },
  {
    id: "row-2",
    item: "Kiểm soát côn trùng",
    rating: "warn",
    note: "Cần kiểm tra bẫy định kỳ",
    photoType: "empty",
  },
  {
    id: "row-3",
    item: "Tình trạng kho",
    rating: "note",
    note: "Ghi nhận bụi tại khu vực kệ",
    photoType: "empty",
  },
  {
    id: "row-4",
    item: "Bảo trì thiết bị",
    rating: "pass",
    note: "Bảo trì đúng kế hoạch",
    photoType: "label",
  },
  {
    id: "row-5",
    item: "Vệ sinh nhân viên",
    rating: "fail",
    note: "Thiếu xà phòng tại khu vệ sinh",
    photoType: "empty",
  },
];

export const prpNonConformities: NonConformity[] = [
  { message: "Thiếu xà phòng tại khu vệ sinh" },
  { message: "Cần đổ rác tại các thùng rác" },
];

export const prpUpcomingAudits: UpcomingAudit[] = [
  { zone: "Khu B", date: "31/10/2023" },
  { zone: "Khu C", date: "09/11/2023" },
];

export const prpUpcomingAuditNote = "Còn 7 hạng mục cần xác minh CAPA.";

// ============================================================================
// AI ANALYTICS DATA
// ============================================================================

export const aiAnalyticsIoTReadings: IoTReading = {
  temperature: 7.5,
  humidity: 71,
  pH: 6.9,
  pressure: 1.2,
};

// Chart Data - Anomaly Detection (Line Chart with Forecast)
export const anomalyDetectionChartData = {
  labels: ["00:00", "0:00", "0:05", "0:00", "1:00", "8:00", "15:00"],
  datasets: [
    {
      label: "Thực tế",
      data: [26, 28, 30, 29, 33, 28, 28],
      borderColor: "#f97316",
      backgroundColor: "rgba(249, 115, 22, 0.1)",
      fill: true,
      tension: 0.4,
    },
    {
      label: "Dự báo",
      data: [null, null, null, null, null, 28, 30],
      borderColor: "#06b6d4",
      borderDash: [5, 5],
      fill: false,
      tension: 0.4,
    },
  ],
};

export const anomalyThresholdValue = 27;
export const anomalyForecastStartIndex = 5;

export const thresholdAlerts = [
  "Setpoint vượt ngưỡng: Nhiệt độ 32.4°C – Setpoint 26-30°C",
  "Gợi ý: Kiểm tra lại giá trị setpoint theo ca vận hành",
];

export const aiAnalyticsSidebarButtons = [
  { id: "ai", label: "Phân tích dữ liệu AI", active: true },
  { id: "iot", label: "Tích hợp IoT", active: false },
];

// ============================================================================
// REPORTS DATA
// ============================================================================

export const reportsKPIs: KPIMetric[] = [
  { label: "Tuân thủ PRP", value: 98, unit: "%", color: "slate" },
  { label: "Tuân thủ HACCP", value: 98, unit: "%", color: "slate" },
  { label: "CAPA đúng hạn", value: 92, unit: "%", color: "slate" },
];

// Chart Data - OEE & Quality Yield (Bar Chart)
export const oeeQualityYieldChartData = {
  labels: ["OEE", "Tỷ lệ đạt chất lượng"],
  datasets: [
    {
      label: "Hiệu suất %",
      data: [75, 91],
      backgroundColor: ["#10b981", "#06b6d4"],
      borderRadius: 8,
    },
  ],
};

// Chart Data - Internal Audit Reports (Bar Chart)
export const internalAuditChartData = {
  labels: [
    "Thg 1",
    "Thg 2",
    "Thg 3",
    "Thg 4",
    "Thg 5",
    "Thg 6",
    "Thg 7",
    "Thg 8",
    "Thg 9",
    "Thg 10",
    "Thg 11",
    "Thg 12",
  ],
  datasets: [
    {
      label: "Số lượt đánh giá",
      data: [8, 6, 9, 10, 7, 12, 11, 9, 12, 15, 10, 18],
      backgroundColor: "#06b6d4",
      borderRadius: 6,
    },
  ],
};

export const reportSparklineData = [8, 12, 6, 16, 10, 4, 14];

export const exportSchedule = [
  {
    name: "KPI tuân thủ",
    format: "PDF",
    frequency: "Hàng ngày",
    status: "Ready",
  },
  {
    name: "OEE & Chất lượng",
    format: "Excel",
    frequency: "Hàng tuần",
    status: "Ready",
  },
];

// ============================================================================
// USER MANAGEMENT DATA
// ============================================================================

/** Tham chiếu CONTEXT.md mục 10 — đủ 5 vai trò chuẩn RBAC (mock/demo UI). */
export const userRoles: UserRole[] = [
  {
    name: "Quản trị viên",
    permissions: { view: true, edit: true, delete: true },
  },
  {
    name: "ISO Manager",
    permissions: { view: true, edit: true, delete: false },
  },
  {
    name: "QA/QC",
    permissions: { view: true, edit: true, delete: false },
  },
  {
    name: "Auditor",
    permissions: { view: true, edit: false, delete: false },
  },
  {
    name: "Người dùng",
    permissions: { view: true, edit: true, delete: false },
  },
];

export const auditLogs: AuditLog[] = [
  { action: "Cập nhật tài liệu QP-102", timestamp: "2 giờ trước" },
  { action: "Đã xuất nhật ký audit", timestamp: "5 giờ trước" },
  { action: "Đã đổi chính sách mật khẩu", timestamp: "1 ngày trước" },
  {
    action: "Tạo người dùng mới: john.doe@company.com",
    timestamp: "3 ngày trước",
  },
  {
    action: "Cập nhật vai trò: ISO Manager",
    timestamp: "5 ngày trước",
  },
];

export const securityFeatures: SecurityFeature[] = [
  { title: "RBAC", description: "Phân quyền theo vai trò" },
  { title: "2FA/MFA", description: "Xác thực nhiều lớp" },
  { title: "Nhật ký kiểm toán", description: "Ghi nhận đầy đủ thao tác" },
  { title: "Mã hóa", description: "TLS / Lưu trữ" },
];

export const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireNumber: true,
  requireSpecial: true,
  maxDaysValid: 90,
  inactivityTimeout: 90,
};

// ============================================================================
// HACCP COMPLIANCE SIDEBAR BUTTONS
// ============================================================================

export const haccpSidebarButtons = [
  { id: "process-flow", label: "Sơ đồ quy trình", active: true },
  { id: "ccps", label: "CCP & CL", active: false },
  { id: "monitoring", label: "Kế hoạch giám sát", active: false },
];

// ============================================================================
// PRP AUDIT ZONES & DATES
// ============================================================================

export const auditZones = [
  "Khu A",
  "Khu B",
  "Khu C",
  "Khu D",
  "Tất cả khu vực",
];

export const auditMonths = [
  "Tháng 10/2023",
  "Tháng 11/2023",
  "Tháng 12/2023",
  "Tháng 01/2024",
];

// ============================================================================
// NAVIGATION MODULES
// ============================================================================

export const appModules = [
  { path: "/dashboard", label: "Bảng điều khiển", icon: "📊" },
  { path: "/document-control", label: "Quản lý tài liệu", icon: "📄" },
  { path: "/haccp-compliance", label: "Tuân thủ HACCP", icon: "✓" },
  { path: "/capa-management", label: "Quản lý CAPA", icon: "🔧" },
  { path: "/prp-audit", label: "Đánh giá PRP", icon: "📋" },
  { path: "/ai-analytics", label: "Phân tích AI", icon: "🤖" },
  { path: "/reports", label: "Báo cáo", icon: "📈" },
  { path: "/user-management", label: "Quản lý người dùng", icon: "👥" },
];
