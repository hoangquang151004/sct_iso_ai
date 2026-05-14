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
  content?: string; // Nội dung tài liệu để xem trong wizard
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
    content: `SỔ TAY CHẤT LƯỢNG QM-001

1. MỤC TIÊU CHẤT LƯỢNG
   - Đảm bảo an toàn thực phẩm theo ISO 22000
   - Tuân thủ HACCP trong toàn bộ quy trình
   - Giảm thiểu rủi ro ô nhiễm chéo

2. PHẠM VI ÁP DỤNG
   - Khu vực sản xuất chính
   - Khu vực đóng gói
   - Kho nguyên liệu và thành phẩm

3. QUY TRÌNH HACCP CHÍNH
   Bước 1: Tiếp nhận nguyên liệu - Kiểm tra nhiệt độ, độ ẩm
   Bước 2: Sơ chế - CCP1: Kiểm soát nhiệt độ < 4°C
   Bước 3: Chế biến - CCP2: Nhiệt độ nấu ≥ 72°C
   Bước 4: Làm nguội - CCP3: Thời gian làm nguội < 2 giờ
   Bước 5: Đóng gói - Kiểm tra seal và date code

4. TIÊU CHUẨN PRP
   - Vệ sinh cá nhân: Rửa tay, sử dụng PPE
   - Vệ sinh thiết bị: Vệ sinh CIP hàng ngày
   - Kiểm soát côn trùng: Bẫy hàng tuần`,
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
    content: `QUY TRÌNH VỆ SINH SOP-005

MỤC ĐÍCH: Đảm bảo vệ sinh trong khu vực sản xuất

BƯỚC 1: Chuẩn bị
   - Thu gom nguyên liệu thừa
   - Tháo dỡ bộ phận có thể tháo rời
   - Che phủ thiết bị điện

BƯỚC 2: Làm sạch sơ bộ
   - Quét mặt sàn, thu gom rác
   - Xịt rửa bề mặt thiết bị
   - Làm sạch mạt bẩn khô

BƯỚC 3: Vệ sinh CIP
   - Pha dung dịch kiềm 2%
   - Tuần hoàn 30 phút ở 60°C
   - Xả sạch bằng nước RO
   - Khử trùng dung dịch clo 100ppm

BƯỚC 4: Kiểm tra và ghi nhận
   - Kiểm tra bằng mắt và giấy thử nền ATP
   - Ghi nhận vào biểu mẫu VS-001
   - Ký xác nhận bởi tổ trưởng`,
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
    content: `HƯỚNG DẪN PHÁT HIỆN KIM LOẠI WI-004

1. THIẾT BỊ: Máy dò kim loại X-Ray Model XR-2000

2. KIỂM TRA ĐẦU CA:
   - Kiểm tra mẫu Fe: Ø 1.5mm
   - Kiểm tra mẫu Non-Fe: Ø 2.0mm
   - Kiểm tra mẫu SUS: Ø 2.5mm
   - Tất cả phải phát hiện được 100%

3. THÔNG SỐ CÀI ĐẶT:
   - Độ nhạy Fe: 1.0mm
   - Độ nhạy Non-Fe: 1.5mm
   - Tốc độ băng tải: 25 m/phút

4. XỬ LÝ KHI PHÁT HIỆN:
   - Dừng máy ngay lập tức
   - Cách ly sản phẩm nghi ngờ
   - Kiểm tra lại toàn bộ lô`,
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
    content: `QUY TRÌNH HIỆU CHUẨN SOP-002

1. MỤC ĐÍCH
   Đảm bảo tất cả thiết bị đo lường hoạt động chính xác

2. PHẠM VI
   - Nhiệt kế kỹ thuật số
   - Máy đo pH
   - Cân điện tử
   - Máy đo áp suất

3. TẦN SUẤT HIỆU CHUẨN
   - Nhiệt kế: Hàng ngày (kiểm tra điểm 0°C)
   - pH meter: Hàng tuần (2 điểm chuẩn)
   - Cân: Hàng tháng (quả cân chuẩn F1/F2)
   - Áp suất: Hàng quý

4. TIÊU CHUẨN CHẤP NHẬN
   - Nhiệt độ: ±0.5°C
   - pH: ±0.1 pH
   - Cân: ±0.1% trọng lượng
   - Áp suất: ±2%

5. XỬ LÝ KHI KHÔNG ĐẠT
   - Cách ly thiết bị
   - Điều chỉnh hoặc sửa chữa
   - Hiệu chuẩn lại sau sửa chữa
   - Kiểm tra lại sản phẩm sản xuất từ lần hiệu chuẩn cuối`,
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
    content: `KIỂM SOÁT CÔN TRÙNG SOP-007

1. BIỆN PHÁP NGĂN NGỪA
   - Rèm cửa từ tính tại tất cả lối vào
   - Đèn UV bắt côn trùng trong khu vực chế biến
   - Màng chắn cửa sổ mesh < 1.5mm
   - Nhà vệ sinh cách ly xa khu vực sản xuất

2. BẪY VÀ GIÁM SÁT
   - Bẫy pheromone: Kiểm tra hàng tuần
   - Bẫy đèn UV: Vệ sinh và ghi nhận hàng tuần
   - Bản đồ bẫy: Cập nhật mỗi tháng

3. NGƯỠNG HÀNH ĐỘNG
   - Ruồi: > 2 con/bẫy/tuần → Kiểm tra ngay
   - Chuột: Dấu hiệu bất kỳ → Đóng cửa nhà máy
   - Gián: 1 con → Xử lý khẩn cấp

4. NHÀ CUNG CẤP DỊCH VỤ
   - Kiểm tra định kỳ: 2 lần/tháng
   - Báo cáo: Nộp sau mỗi lần kiểm tra
   - Chứng nhận: Kiểm tra hàng năm

5. GHI NHẬN
   - Biểu mẫu CT-001: Bẫy côn trùng
   - Biểu mẫu CT-002: Phun thuốc
   - Biểu mẫu CT-003: Kiểm tra nhà cung cấp`,
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

// Mock current user for HACCP approval and other operations
export const currentUser = {
  id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  email: "admin@company.com",
  fullName: "Quản trị viên",
  role: "ADMIN"
};

// ============================================================================
// MOCK USERS - For CCP responsible_user and testing
// ============================================================================

export interface MockUser {
  id: string;
  username: string;
  email: string;
  full_name: string;
  department: string;
  position: string;
  phone?: string;
  role: string;
  is_active: boolean;
}

export const mockUsers: MockUser[] = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    username: "nguyen.van.a",
    email: "nguyen.van.a@company.com",
    full_name: "Nguyễn Văn A",
    department: "Phòng QA/QC",
    position: "Trưởng phòng QA/QC",
    phone: "0901234567",
    role: "QA_MANAGER",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    username: "tran.thi.b",
    email: "tran.thi.b@company.com",
    full_name: "Trần Thị B",
    department: "Phòng QA/QC",
    position: "Nhân viên kiểm tra chất lượng",
    phone: "0912345678",
    role: "QA_STAFF",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440003",
    username: "le.van.c",
    email: "le.van.c@company.com",
    full_name: "Lê Văn C",
    department: "Phòng Sản xuất",
    position: "Quản đốc phân xưởng",
    phone: "0923456789",
    role: "PRODUCTION_MANAGER",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440004",
    username: "pham.thi.d",
    email: "pham.thi.d@company.com",
    full_name: "Phạm Thị D",
    department: "Phòng Sản xuất",
    position: "Tổ trưởng dây chuyền",
    phone: "0934567890",
    role: "LINE_LEADER",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440005",
    username: "hoang.van.e",
    email: "hoang.van.e@company.com",
    full_name: "Hoàng Văn E",
    department: "Phòng ISO",
    position: "ISO Manager",
    phone: "0945678901",
    role: "ISO_MANAGER",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440006",
    username: "nguyen.thi.f",
    email: "nguyen.thi.f@company.com",
    full_name: "Nguyễn Thị F",
    department: "Phòng HACCP",
    position: "Chuyên viên HACCP",
    phone: "0956789012",
    role: "HACCP_SPECIALIST",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440007",
    username: "tran.van.g",
    email: "tran.van.g@company.com",
    full_name: "Trần Văn G",
    department: "Phòng Kỹ thuật",
    position: "Kỹ sư bảo trì",
    phone: "0967890123",
    role: "TECHNICIAN",
    is_active: true
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440008",
    username: "le.thi.h",
    email: "le.thi.h@company.com",
    full_name: "Lê Thị H",
    department: "Phòng Nhân sự",
    position: "Chuyên viên đào tạo",
    phone: "0978901234",
    role: "HR_SPECIALIST",
    is_active: true
  }
];

// Helper functions for user data
export const getUserById = (id: string): MockUser | undefined => {
  return mockUsers.find(u => u.id === id);
};

export const getUserDisplayName = (id: string): string => {
  const user = getUserById(id);
  return user ? `${user.full_name} (${user.position})` : id;
};

export const getActiveUsers = (): MockUser[] => {
  return mockUsers.filter(u => u.is_active);
};

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
    permissions: { view: true, edit: false, delete: false },
  },
  {
    name: "Người dùng",
    permissions: { view: true, edit: false, delete: false },
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
  { id: "plans-list", label: "Danh sách Kế hoạch", active: true },
  { id: "process-flow", label: "Sơ đồ Quy trình", active: false },
  { id: "hazards", label: "Phân tích Mối nguy", active: false },
  { id: "ccps", label: "CCP & CL", active: false },
  { id: "monitoring", label: "Kế hoạch giám sát", active: false },
  { id: "monitoring-logs", label: "Nhật ký Giám sát", active: false },
  { id: "deviations", label: "Độ lệch CCP", active: false },
  { id: "assessments", label: "Đánh giá HACCP", active: false },
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
