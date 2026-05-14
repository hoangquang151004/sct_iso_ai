import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/api/api-client";
import Modal from "./ui/modal";
import { listDocuments, DocumentDto, resolvePublicFileUrl, isImageFileForPreview } from "@/api/documents-api";
import { useAuth } from "@/hooks";

// ============================================================================
// DOCUMENT CONTENT PARSER - Trích xuất dữ liệu từ nội dung tài liệu
// ============================================================================

interface ParsedStep {
  name: string;
  type: "RECEIVING" | "PROCESSING" | "PACKAGING" | "STORAGE";
  isCcp: boolean;
  ccpCode?: string;
  ccpName?: string;
  criticalLimits?: string[];
}

interface ParsedHazard {
  stepName: string;
  type: "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL";
  name: string;
  likelihood: number;
  severity: number;
}

/**
 * Parse document content to extract HACCP process steps
 * Hỗ trợ nhiều định dạng: "Bước X: Tên", "X. Tên", "BƯỚC X: Tên"
 */
function parseDocumentSteps(content: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  const lines = content.split('\n');

  // Regex patterns cho các định dạng bước khác nhau
  const stepPatterns = [
    /Bước\s*(\d+)[:\.]\s*(.+?)(?:\s*-\s*(.+))?$/i,  // "Bước 1: Tên - Mô tả"
    /BƯỚC\s*(\d+)[:\.]\s*(.+?)(?:\s*-\s*(.+))?$/i,  // "BƯỚC 1: Tên"
    /^(\d+)[:\.]\s+(.+?)(?:\s*-\s*(.+))?$/i,         // "1. Tên bước"
    /Step\s*(\d+)[:\.]\s*(.+?)(?:\s*-\s*(.+))?$/i,   // "Step 1: Name"
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    for (const pattern of stepPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const stepNum = parseInt(match[1]);
        let stepName = match[2]?.trim() || `Bước ${stepNum}`;
        const description = match[3]?.trim() || "";

        // Detect CCP from description or name
        const isCcp = /CCP\d*|kiểm soát|giám sát|nhiệt độ|pH|kim loại/i.test(stepName + " " + description);
        const ccpMatch = description.match(/(CCP[\d-]*)/i) || stepName.match(/(CCP[\d-]*)/i);
        const ccpCode = ccpMatch ? ccpMatch[1] : (isCcp ? `CCP-${stepNum}` : undefined);

        // Detect step type from keywords
        let type: ParsedStep['type'] = "PROCESSING";
        if (/tiếp nhận|nhận|nguyên liệu|nhập kho/i.test(stepName)) type = "RECEIVING";
        else if (/đóng gói|bao bì|pack/i.test(stepName)) type = "PACKAGING";
        else if (/lưu kho|kho|bảo quản|lạnh/i.test(stepName)) type = "STORAGE";

        // Extract critical limit if mentioned
        const limitMatch = description.match(/([<>]?=?\s*\d+[°\.]?\w*\s*(?:°C|°F|%|ppm|phút|giờ|mm)?)/i);
        const criticalLimits = limitMatch ? [limitMatch[1]] : undefined;

        // Build CCP name
        const ccpName = isCcp ? (description.split('-')[0]?.trim() || `Kiểm soát ${stepName}`) : undefined;

        steps.push({
          name: stepName,
          type,
          isCcp,
          ccpCode,
          ccpName,
          criticalLimits
        });
        break;
      }
    }
  }

  return steps;
}

/**
 * Parse document content to extract hazards based on step context
 */
function parseDocumentHazards(content: string, steps: ParsedStep[]): ParsedHazard[] {
  const hazards: ParsedHazard[] = [];
  const lines = content.split('\n');

  // Keywords for hazard types
  const bioKeywords = /vi khuẩn|nấm mốc|sinh học| Salmonella|E\.coli|Listeria|độc tố|toxin/i;
  const chemKeywords = /hóa chất|dư lượng thuốc|kim loại nặng|chất độc|dầu mỡ|chemical|phẩm màu|bảo quản/i;
  const physKeywords = /tạp chất|kim loại|mảnh vỡ|sợi|tóc|cát|bụi|physical|mảnh nhựa/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Look for hazard mentions
    let type: ParsedHazard['type'] | null = null;
    let name = "";

    if (bioKeywords.test(trimmed)) {
      type = "BIOLOGICAL";
      name = trimmed.match(/vi khuẩn\s+\w+|nấm mốc|độc tố/)?.[0] || "Vi sinh vật gây bệnh";
    } else if (chemKeywords.test(trimmed)) {
      type = "CHEMICAL";
      name = trimmed.match(/hóa chất\s+\w+|dư lượng|kim loại nặng/)?.[0] || "Chất hóa học độc hại";
    } else if (physKeywords.test(trimmed)) {
      type = "PHYSICAL";
      name = trimmed.match(/tạp chất|kim loại|mảnh vỡ/)?.[0] || "Tạp chất vật lý";
    }

    if (type && name) {
      // Try to associate with a step
      const associatedStep = steps.find(s => trimmed.toLowerCase().includes(s.name.toLowerCase()));

      hazards.push({
        stepName: associatedStep?.name || "Chung",
        type,
        name,
        likelihood: 3,
        severity: type === "BIOLOGICAL" ? 4 : 3
      });
    }
  }

  return hazards;
}

interface HaccpWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planId?: string | null;
}

// Data structures for the wizard
interface WizardData {
  planInfo: { name: string; version: string; scope: string };
  steps: { id: string; name: string; type: string; isCcp: boolean }[];
  hazards: { id: string; stepId: string; type: "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL"; name: string; likelihood: number; severity: number; isSignificant: boolean; criticalLimits: string[] }[];
  ccps: { id: string; stepId: string; hazardId: string; ccpCode: string; name: string; criticalLimits: string[] }[];
  selectedDocumentId: string | null;
}

const INITIAL_DATA: WizardData = {
  planInfo: { name: "", version: "1.0", scope: "" },
  steps: [],
  hazards: [],
  ccps: [],
  selectedDocumentId: null,
};

const STEP_TITLES = [
  "Thông tin Kế hoạch",
  "Sơ đồ Quy trình",
  "Phân tích Mối nguy",
  "Điểm Kiểm soát Tới hạn (CCP)",
  "Hoàn tất",
];

export default function HaccpWizard({ isOpen, onClose, onSuccess, planId }: HaccpWizardProps) {
  const { principal } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [realDocuments, setRealDocuments] = useState<DocumentDto[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [data, setData] = useState<WizardData>(INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false); // Toggle document viewer
  const [imageZoom, setImageZoom] = useState(1); // Mức độ zoom ảnh
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleImageMouseDown = (e: React.MouseEvent) => {
    setIsDraggingImage(true);
    dragStart.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: imageContainerRef.current?.scrollLeft || 0,
      scrollTop: imageContainerRef.current?.scrollTop || 0
    };
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingImage || !imageContainerRef.current) return;
    e.preventDefault();
    const walkX = (e.pageX - dragStart.current.x) * 1.5;
    const walkY = (e.pageY - dragStart.current.y) * 1.5;
    imageContainerRef.current.scrollLeft = dragStart.current.scrollLeft - walkX;
    imageContainerRef.current.scrollTop = dragStart.current.scrollTop - walkY;
  };

  const handleImageMouseUp = () => setIsDraggingImage(false);


  // Load real documents
  useEffect(() => {
    if (isOpen && principal?.org_id) {
      const loadDocs = async () => {
        setDocsLoading(true);
        try {
          const docs = await listDocuments(principal.org_id);
          setRealDocuments(docs);
        } catch (err) {
          console.error("Failed to load documents:", err);
        } finally {
          setDocsLoading(false);
        }
      };
      loadDocs();
    }
  }, [isOpen, principal?.org_id]);

  // Load existing data if planId is provided
  useEffect(() => {
    if (isOpen && planId) {
      const loadPlanData = async () => {
        setInitialLoading(true);
        try {
          // 1. Plan Info
          const plan = await apiFetch<any>(`/haccp/plans/${planId}`);

          // 2. Steps
          const stepsData = await apiFetch<any[]>(`/haccp/plans/${planId}/steps`);
          const wizardSteps = stepsData.map(s => ({
            id: s.id,
            name: s.name,
            type: s.step_type,
            isCcp: s.is_ccp
          }));

          // 3. Hazards (fetch for all steps)
          const wizardHazards: { id: string; stepId: string; type: "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL"; name: string; likelihood: number; severity: number; isSignificant: boolean; criticalLimits: string[] }[] = [];
          console.log('[Wizard Load] Fetching hazards for', stepsData.length, 'steps');
          for (const s of stepsData) {
            console.log(`[Wizard Load] Fetching hazards for step ${s.id} (${s.name})`);
            const hData = await apiFetch<any[]>(`/haccp/steps/${s.id}/hazards`);
            console.log(`[Wizard Load] Step ${s.name}: found ${hData.length} hazards`, hData);
            hData.forEach(h => {
              // Phục hồi criticalLimits từ control_measure (dạng "A; B; C")
              const savedLimits = h.control_measure
                ? h.control_measure.split(";").map((l: string) => l.trim()).filter(Boolean)
                : [""];
              wizardHazards.push({
                id: h.id,
                stepId: s.id,
                type: h.hazard_type,
                name: h.hazard_name,
                likelihood: h.likelihood,
                severity: h.severity,
                isSignificant: h.is_significant,
                criticalLimits: savedLimits
              });
            });
          }
          console.log('[Wizard Load] Total hazards loaded:', wizardHazards.length);


          // 4. CCPs
          const ccpsData = await apiFetch<any[]>(`/haccp/plans/${planId}/ccps`);
          const wizardCcps = ccpsData.map(c => ({
            id: c.id,
            stepId: c.step_id,
            hazardId: c.hazard_id,
            ccpCode: c.ccp_code,
            name: c.name,
            // Phục hồi criticalLimits từ critical_limit (dạng "A; B; C")
            criticalLimits: c.critical_limit
              ? c.critical_limit.split(";").map((l: string) => l.trim()).filter(Boolean)
              : [""]
          }));

          setData({
            planInfo: { name: plan.name, version: plan.version, scope: plan.scope || "" },
            steps: wizardSteps,
            hazards: wizardHazards,
            ccps: wizardCcps,
            selectedDocumentId: null
          });
        } catch (err) {
          console.error("Failed to load plan:", err);
          alert("Không thể tải thông tin quy trình.");
        } finally {
          setInitialLoading(false);
        }
      };
      loadPlanData();
    } else if (isOpen && !planId) {
      // Reset to initial data when creating new
      setData(INITIAL_DATA);
      setCurrentStep(1);
    }
  }, [isOpen, planId]);

  const handleNext = () => {
    // Basic validation could be added here
    if (currentStep < 5) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const updateData = (section: keyof WizardData, payload: any) => {
    setData((prev) => ({ ...prev, [section]: payload }));
  };

  const handleSubmit = async () => {
    // 0. Kiểm tra trùng lặp mã CCP trong dữ liệu wizard
    const codes = data.ccps.map(c => c.ccpCode.trim().toUpperCase()).filter(c => c !== "");
    const uniqueCodes = new Set(codes);
    if (uniqueCodes.size !== codes.length) {
      const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
      alert(`Lỗi: Có mã CCP bị trùng lặp: ${[...new Set(duplicates)].join(', ')}. Vui lòng kiểm tra lại tại Bước 4.`);
      return;
    }

    setLoading(true);
    try {
      let activePlanId = planId;

      if (activePlanId) {
        // UPDATE MODE
        await apiFetch(`/haccp/plans/${activePlanId}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: data.planInfo.name,
            version: data.planInfo.version,
            scope: data.planInfo.scope
          })
        });
      } else {
        // CREATE MODE
        // 1. Create Product (Optional, but keeping for compatibility)
        const prod = await apiFetch<any>("/haccp/products", {
          method: "POST",
          body: JSON.stringify({
            name: "Sản phẩm cho " + (data.planInfo.name || "Kế hoạch mới")
          })
        });

        // 2. Create Plan
        const plan = await apiFetch<any>("/haccp/plans", {
          method: "POST",
          body: JSON.stringify({
            name: data.planInfo.name || "Kế hoạch không tên",
            version: data.planInfo.version,
            scope: data.planInfo.scope,
            product_id: prod.id
          })
        });
        activePlanId = plan.id;
      }

      // --- Sync Steps ---
      const existingSteps = planId ? await apiFetch<any[]>(`/haccp/plans/${planId}/steps`) : [];
      const stepIdsToKeep = data.steps.filter(s => s.id.length > 20).map(s => s.id); // UUID length check

      // Delete removed steps
      for (const es of existingSteps) {
        if (!stepIdsToKeep.includes(es.id)) {
          await apiFetch(`/haccp/steps/${es.id}`, { method: 'DELETE' });
        }
      }

      const stepIdMap: Record<string, string> = {};
      for (let i = 0; i < data.steps.length; i++) {
        const s = data.steps[i];
        const stepBody = {
          step_order: i + 1,
          name: s.name || "Bước " + (i + 1),
          step_type: s.type,
          is_ccp: s.isCcp
        };

        if (s.id.length > 20) {
          // Update existing
          await apiFetch(`/haccp/steps/${s.id}`, { method: 'PATCH', body: JSON.stringify(stepBody) });
          stepIdMap[s.id] = s.id;
        } else {
          // Create new
          const created = await apiFetch<any>(`/haccp/plans/${activePlanId}/steps`, {
            method: 'POST',
            body: JSON.stringify({ ...stepBody, haccp_plan_id: activePlanId })
          });
          stepIdMap[s.id] = created.id;
        }
      }

      // --- Sync Hazards ---
      console.log('[Wizard Save] Syncing hazards:', data.hazards.length, 'hazards');
      console.log('[Wizard Save] stepIdMap:', stepIdMap);

      const hazardIdMap: Record<string, string> = {};

      for (const h of data.hazards) {
        const dbStepId = stepIdMap[h.stepId];
        console.log(`[Wizard Save] Hazard ${h.name || 'unnamed'}: tempStepId=${h.stepId}, dbStepId=${dbStepId}`);

        if (!dbStepId) {
          console.warn(`[Wizard Save] Skipping hazard - no dbStepId found for stepId ${h.stepId}`);
          continue;
        }

        const hazardBody = {
          hazard_type: h.type,
          hazard_name: h.name || "Mối nguy chưa xác nhận",
          likelihood: h.likelihood,
          severity: h.severity,
          is_significant: h.isSignificant,
          control_measure: h.criticalLimits?.filter(l => l.trim()).join("; ") || undefined
        };
        console.log('[Wizard Save] Creating hazard:', hazardBody);

        try {
          if (h.id.length > 20) {
            // Update existing
            await apiFetch(`/haccp/hazards/${h.id}`, { method: 'PATCH', body: JSON.stringify(hazardBody) });
            hazardIdMap[h.id] = h.id;
            console.log(`[Wizard Save] Updated hazard ${h.id}`);
          } else {
            // Create new
            const created = await apiFetch<any>(`/haccp/steps/${dbStepId}/hazards`, {
              method: 'POST',
              body: JSON.stringify({ ...hazardBody, step_id: dbStepId })
            });
            hazardIdMap[h.id] = created.id;
            console.log(`[Wizard Save] Created hazard:`, created);
          }
        } catch (err: any) {
          console.error(`[Wizard Save] Failed to save hazard:`, err);
        }
      }

      // --- Sync CCPs ---
      const existingCcps = planId ? await apiFetch<any[]>(`/haccp/plans/${planId}/ccps`) : [];
      const ccpIdsToKeep = data.ccps.filter(c => c.id.length > 20).map(c => c.id);

      for (const ec of existingCcps) {
        if (!ccpIdsToKeep.includes(ec.id)) {
          await apiFetch(`/haccp/ccps/${ec.id}`, { method: 'DELETE' });
        }
      }

      for (const c of data.ccps) {
        const dbStepId = stepIdMap[c.stepId];
        const dbHazardId = c.hazardId ? (hazardIdMap[c.hazardId] || c.hazardId) : null;

        const ccpBody = {
          step_id: dbStepId,
          hazard_id: dbHazardId,
          ccp_code: c.ccpCode,
          name: c.name || "Điểm KS",
          // Join mảng giới hạn thành string để lưu vào DB
          critical_limit: c.criticalLimits?.filter(l => l.trim()).join("; ") || "Chưa thiết lập"
        };

        console.log(`[Wizard] Saving CCP ${c.ccpCode}:`, ccpBody);

        if (c.id.length > 20) {
          try {
            await apiFetch(`/haccp/ccps/${c.id}`, { method: 'PATCH', body: JSON.stringify(ccpBody) });
          } catch (err: any) {
            console.error(`[Wizard] PATCH CCP ${c.id} failed:`, err);
            throw new Error(`Lỗi cập nhật CCP ${c.ccpCode}: ${err.message}`);
          }
        } else {
          try {
            await apiFetch<any>(`/haccp/plans/${activePlanId}/ccps`, {
              method: 'POST',
              body: JSON.stringify({ ...ccpBody, haccp_plan_id: activePlanId })
            });
          } catch (err: any) {
            console.error(`[Wizard] POST CCP failed:`, err);
            throw new Error(`Lỗi tạo CCP ${c.ccpCode}: ${err.message}`);
          }
        }
      }

      onSuccess();
      onClose();
      setCurrentStep(1);
      setData(INITIAL_DATA);
    } catch (error: any) {
      console.error('[Wizard] Save failed:', error);
      const errorMsg = error?.response?.data?.detail || error?.message || 'Lỗi không xác định';
      alert(`Đã xảy ra lỗi khi lưu: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // RENDER SECTIONS
  // ------------------------------------------------------------------

  const renderStep1 = () => {
    // Helper function to handle document selection
    const handleDocumentSelect = (docId: string) => {
      if (docId === "") {
        updateData('selectedDocumentId', null);
        return;
      }

      const selectedDoc = realDocuments.find(d => d.id === docId);
      if (selectedDoc) {
        updateData('selectedDocumentId', docId);
        updateData('planInfo', {
          ...data.planInfo,
          name: selectedDoc.title,
          version: selectedDoc.current_version,
          scope: `Phòng ban: ${selectedDoc.department || "—"} | Mã số: ${selectedDoc.doc_code}`
        });
      }
    };

    const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        {/* Document Selection */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
          <label className="mb-2 block text-sm font-medium text-blue-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Dựa trên Tài liệu (tùy chọn)
          </label>
          <select
            value={data.selectedDocumentId || ""}
            onChange={(e) => handleDocumentSelect(e.target.value)}
            disabled={docsLoading}
            className="w-full rounded-lg border border-blue-200 px-4 py-2.5 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 bg-white text-sm disabled:opacity-50"
          >
            <option value="">{docsLoading ? "-- Đang tải danh sách tài liệu... --" : "-- Chọn tài liệu để tự động điền thông tin --"}</option>
            {realDocuments.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.doc_code} - {doc.title} ({doc.doc_type}) - {doc.status}
              </option>
            ))}
          </select>
          <p className="text-xs text-blue-600 mt-2">
            Chọn tài liệu từ phần Quản lý tài liệu để tự động điền thông tin kế hoạch HACCP
          </p>
        </div>

        {/* Selected Document Info Card */}
        {selectedDoc && (
          <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200 text-sm">
            <div className="flex items-center gap-2 text-emerald-800 font-medium mb-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Đã chọn tài liệu: {selectedDoc.title}
            </div>
            <div className="text-emerald-600 text-xs grid grid-cols-2 gap-1">
              <span>Loại: {selectedDoc.doc_type}</span>
              <span>Phòng ban: {selectedDoc.department || "—"}</span>
              <span>Phiên bản: {selectedDoc.current_version}</span>
              <span>Trạng thái: {selectedDoc.status}</span>
            </div>
          </div>
        )}

        <div className="border-t border-slate-200 pt-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">Tên Kế Hoạch *</label>
          <input
            type="text"
            value={data.planInfo.name}
            onChange={(e) => updateData('planInfo', { ...data.planInfo, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-shadow"
            placeholder="Nhập tên kế hoạch (VD: Quy trình sản xuất Sữa pasteur...)"
          />
        </div>
        <div className="flex gap-4">
          <div className="w-1/3">
            <label className="mb-1 block text-sm font-medium text-slate-700">Phiên bản</label>
            <input
              type="text"
              value={data.planInfo.version}
              onChange={(e) => updateData('planInfo', { ...data.planInfo, version: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">Phạm vi áp dụng</label>
            <input
              type="text"
              value={data.planInfo.scope}
              onChange={(e) => updateData('planInfo', { ...data.planInfo, scope: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 outline-none focus:border-cyan-500"
              placeholder="Khu vực nhà xưởng, dây chuyền A..."
            />
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const addStep = () => {
      const newStep = { id: Date.now().toString(), name: "", type: "PROCESSING", isCcp: false };
      updateData('steps', [...data.steps, newStep]);
    };

    const updateStep = (id: string, field: string, value: any) => {
      updateData('steps', data.steps.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const removeStep = (id: string) => updateData('steps', data.steps.filter(s => s.id !== id));

    const autoFillFromDocument = () => {
      const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);
      if (!selectedDoc?.ai_summary) {
        alert("Tài liệu này không có tóm tắt AI để phân tích quy trình.");
        return;
      }

      const parsedSteps = parseDocumentSteps(selectedDoc.ai_summary);
      if (parsedSteps.length === 0) {
        alert("Không tìm thấy các bước quy trình trong tài liệu.");
        return;
      }

      const newSteps = parsedSteps.map((step, index) => ({
        id: Date.now().toString() + index,
        name: step.name,
        type: step.type,
        isCcp: step.isCcp
      }));

      updateData('steps', newSteps);

      // Create CCPs for steps marked as isCcp
      const planPrefix = data.planInfo.name ? data.planInfo.name.split(' ').map(w => w[0]).join('').toUpperCase() : "HACCP";
      const newCcps: any[] = [];
      
      parsedSteps.forEach((step, index) => {
        if (step.isCcp) {
          newCcps.push({
            id: Date.now().toString() + '_ccp' + index,
            stepId: newSteps[index].id,
            hazardId: "",
            ccpCode: step.ccpCode || `${planPrefix}-CCP-${newCcps.length + 1}`,
            name: step.ccpName || `Kiểm soát ${step.name}`,
            criticalLimits: step.criticalLimits && step.criticalLimits.length > 0 ? step.criticalLimits : [""]
          });
        }
      });

      if (newCcps.length > 0) {
        updateData('ccps', [...data.ccps, ...newCcps]);
      }

      const docName = selectedDoc ? ` từ tài liệu "${selectedDoc.title}"` : "";
      alert(`Đã tạo ${newSteps.length} bước quy trình${docName} (và ${newCcps.length} CCP)`);
    };

    const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        {/* Document Info Banner */}
        {selectedDoc && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm text-blue-800">
                Đang dùng tài liệu: <strong>{selectedDoc.title}</strong>
              </span>
            </div>
            <button
              onClick={autoFillFromDocument}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Tạo 4 bước cơ bản
            </button>
          </div>
        )}

        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold text-slate-800">Các công đoạn (Liệt kê theo thứ tự)</h3>
          <button onClick={addStep} className="text-xs bg-cyan-100 text-cyan-800 px-3 py-1.5 rounded-full font-medium hover:bg-cyan-200 transition-colors">+ Thêm Bước</button>
        </div>

        {data.steps.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm">
            Chưa có công đoạn nào. Hãy thêm bước đầu tiên của quy trình.
          </div>
        ) : (
          <div className="space-y-3">
            {data.steps.map((step, index) => (
              <div key={step.id} className="flex items-center gap-3 bg-white p-3 border border-slate-200 rounded-lg shadow-sm">
                <span className="w-6 h-6 shrink-0 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-500">{index + 1}</span>
                <input
                  type="text"
                  value={step.name}
                  onChange={(e) => updateStep(step.id, 'name', e.target.value)}
                  placeholder="Tên công đoạn (VD: Thanh trùng)"
                  className="flex-1 w-1/3 rounded border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-cyan-500"
                />
                <select
                  value={step.type}
                  onChange={(e) => updateStep(step.id, 'type', e.target.value)}
                  className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="RECEIVING">Tiếp nhận</option>
                  <option value="PROCESSING">Chế biến</option>
                  <option value="PACKAGING">Đóng gói</option>
                  <option value="STORAGE">Lưu kho</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs font-medium text-orange-600 bg-orange-50 px-2 py-1.5 rounded cursor-pointer border border-orange-100">
                  <input type="checkbox" checked={step.isCcp} onChange={(e) => updateStep(step.id, 'isCcp', e.target.checked)} className="accent-orange-500" />
                  Là CCP?
                </label>
                <button onClick={() => removeStep(step.id)} className="text-red-500 hover:text-red-700 bg-red-50 p-1.5 rounded" title="Xóa">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStep3 = () => {
    if (data.steps.length === 0) return <div className="text-center p-8 text-slate-500 text-sm">Vui lòng quay lại Bước 2 và thêm ít nhất 1 quy trình.</div>;

    const addHazard = (stepId: string) => {
      const newHazard = { id: Date.now().toString(), stepId, type: "BIOLOGICAL" as const, name: "", likelihood: 3, severity: 3, isSignificant: false, criticalLimits: [""] };
      updateData('hazards', [...data.hazards, newHazard]);
    };

    const updateHazard = (id: string, field: string, value: any) => {
      updateData('hazards', data.hazards.map(h => {
        if (h.id === id) {
          const updated = { ...h, [field]: value };
          // Auto eval significance
          const risk = updated.likelihood * updated.severity;
          updated.isSignificant = risk >= 12;
          return updated;
        }
        return h;
      }));
    };

    const removeHazard = (id: string) => updateData('hazards', data.hazards.filter(h => h.id !== id));

    // Auto-fill hazards from document
    const autoFillHazardsFromDocument = () => {
      const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);
      if (!selectedDoc?.ai_summary) {
        alert("Tài liệu này không có tóm tắt AI để phân tích mối nguy.");
        return;
      }

      // First parse steps to understand context
      const parsedSteps = parseDocumentSteps(selectedDoc.ai_summary);
      const parsedHazards = parseDocumentHazards(selectedDoc.ai_summary, parsedSteps);

      if (parsedHazards.length === 0) {
        alert("Không tìm thấy mối nguy trong tài liệu");
        return;
      }

      // Create hazards from parsed data
      const newHazards: { id: string; stepId: string; type: "BIOLOGICAL" | "CHEMICAL" | "PHYSICAL"; name: string; likelihood: number; severity: number; isSignificant: boolean; criticalLimits: string[] }[] = [];
      parsedHazards.forEach((hazard, index) => {
        // Find matching step
        const matchingStep = data.steps.find(s =>
          s.name.toLowerCase().includes(hazard.stepName.toLowerCase()) ||
          hazard.stepName.toLowerCase().includes(s.name.toLowerCase())
        ) || data.steps[0]; // Default to first step if no match

        if (matchingStep) {
          const risk = hazard.likelihood * hazard.severity;
          newHazards.push({
            id: Date.now().toString() + index,
            stepId: matchingStep.id,
            type: hazard.type,
            name: hazard.name,
            likelihood: hazard.likelihood,
            severity: hazard.severity,
            isSignificant: risk >= 12,
            criticalLimits: [""]
          });
        }
      });

      if (newHazards.length > 0) {
        updateData('hazards', [...data.hazards, ...newHazards]);
        alert(`Đã thêm ${newHazards.length} mối nguy từ tài liệu "${selectedDoc.title}"`);
      }
    };

    const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);

    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
        {/* Document Info Banner */}
        {selectedDoc && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-amber-800">
                Tài liệu: <strong>{selectedDoc.title}</strong> - Có thể trích xuất mối nguy
              </span>
            </div>
            <button
              onClick={autoFillHazardsFromDocument}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Thêm mối nguy từ tài liệu
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-semibold text-slate-800">
            Danh sách mối nguy ({data.hazards.length} mối nguy)
          </h3>
          <select
            onChange={(e) => { if (e.target.value) { addHazard(e.target.value); e.target.value = ""; } }}
            className="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded hover:bg-slate-50 shadow-sm outline-none"
            value=""
          >
            <option value="">+ Thêm mối nguy cho bước...</option>
            {data.steps.map(step => (
              <option key={step.id} value={step.id}>{step.name || "Bước chưa đặt tên"}</option>
            ))}
          </select>
        </div>

        {/* All Hazards Table */}
        {data.hazards.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-lg text-slate-400 text-sm">
            Chưa có mối nguy nào. Chọn bước từ dropdown trên để thêm mối nguy.
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Công đoạn</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Loại</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Mô tả mối nguy</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">K</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">M</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Điểm</th>
                  <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.hazards.map(h => {
                  const step = data.steps.find(s => s.id === h.stepId);
                  const risk = h.likelihood * h.severity;
                  const isSignificant = risk >= 12;

                  return (
                    <tr key={h.id} className={isSignificant ? 'bg-red-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3">
                        <span className="text-xs text-slate-600">{step?.name || "-"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={h.type}
                          onChange={e => updateHazard(h.id, 'type', e.target.value)}
                          className="text-xs rounded border border-slate-300 px-2 py-1 outline-none focus:border-amber-500 bg-white"
                        >
                          <option value="BIOLOGICAL">Sinh học</option>
                          <option value="CHEMICAL">Hóa học</option>
                          <option value="PHYSICAL">Vật lý</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <input
                            type="text"
                            value={h.name}
                            onChange={e => updateHazard(h.id, 'name', e.target.value)}
                            placeholder="Mô tả mối nguy..."
                            className="w-full text-xs rounded border border-slate-300 px-2 py-1 outline-none focus:border-amber-500"
                          />
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                            📍 {step?.name || "Chưa gán bước"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1" max="5"
                          value={h.likelihood}
                          onChange={e => updateHazard(h.id, 'likelihood', parseInt(e.target.value) || 1)}
                          className="w-10 text-center text-xs border border-slate-300 rounded py-1 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          type="number"
                          min="1" max="5"
                          value={h.severity}
                          onChange={e => updateHazard(h.id, 'severity', parseInt(e.target.value) || 1)}
                          className="w-10 text-center text-xs border border-slate-300 rounded py-1 outline-none"
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${isSignificant ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-700'}`}>
                          {risk}
                          {isSignificant && <span className="ml-1 text-[8px]">\u26a0</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => removeHazard(h.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Xóa"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  );

                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary */}
        {data.hazards.length > 0 && (
          <div className="flex gap-4 text-xs">
            <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
              <span className="text-emerald-700">
                Chấp nhận được: {data.hazards.filter(h => h.likelihood * h.severity < 12).length}
              </span>
            </div>
            <div className="bg-red-50 border border-red-200 rounded px-3 py-2">
              <span className="text-red-700">
                Rủi ro cao (cần CCP): {data.hazards.filter(h => h.likelihood * h.severity >= 12).length}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    // Show all steps, but highlight those that are marked as CCP or have significant hazards
    if (data.steps.length === 0) return <div className="text-center p-8 text-slate-500 text-sm">Chưa có công đoạn nào để thiết lập CCP.</div>;

    const addCcp = (stepId: string) => {
      const planPrefix = data.planInfo.name ? data.planInfo.name.split(' ').map(w => w[0]).join('').toUpperCase() : "HACCP";
      const stepHazards = data.hazards.filter(h => h.stepId === stepId);
      const topHazard = stepHazards.sort((a, b) => (b.likelihood * b.severity) - (a.likelihood * a.severity))[0];
      const newCcp = { id: Date.now().toString(), stepId, hazardId: topHazard?.id || "", ccpCode: `${planPrefix}-CCP-`, name: "", criticalLimits: [""] };
      updateData('ccps', [...data.ccps, newCcp]);
    };

    const updateCcp = (id: string, field: string, value: any) => {
      updateData('ccps', data.ccps.map(c => c.id === id ? { ...c, [field]: value } : c));
    };

    const removeCcp = (id: string) => updateData('ccps', data.ccps.filter(c => c.id !== id));

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <p className="text-sm text-slate-600 mb-4 bg-blue-50/50 p-3 rounded border border-blue-100">
          Hãy thiết lập Giới hạn tới hạn cho các Điểm kiểm soát (CCP). Các bước rủi ro cao sẽ được tô màu cam.
        </p>
        {data.steps.map(step => {
          const stepHazards = data.hazards.filter(h => h.stepId === step.id);
          const hasSignificantRisk = stepHazards.some(h => h.isSignificant) || step.isCcp;
          const stepCcps = data.ccps.filter(c => c.stepId === step.id);

          return (
            <div key={step.id} className={`border rounded-lg overflow-hidden ${hasSignificantRisk ? 'border-orange-200' : 'border-slate-200'}`}>
              <div className={`px-4 py-3 border-b flex justify-between items-center gap-4 ${hasSignificantRisk ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <span className="font-bold text-sm truncate">♦ {step.name || "Công đoạn chưa đặt tên"} {hasSignificantRisk && <span className="ml-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase tracking-wider relative top-[-1px]">Rủi ro cao</span>}</span>
                <button onClick={() => addCcp(step.id)} className={`shrink-0 whitespace-nowrap text-xs px-3 py-1 rounded shadow-sm transition-colors text-white ${hasSignificantRisk ? 'bg-orange-500 hover:bg-orange-600' : 'bg-slate-500 hover:bg-slate-600'}`}>+ Thêm CCP</button>
              </div>
              <div className="p-4 bg-white space-y-4">
                {stepCcps.length === 0 ? <p className="text-xs text-slate-400 italic">Không có CCP nào được yêu cầu ở bước này.</p> :
                  stepCcps.map(ccp => {
                    const limits: string[] = ccp.criticalLimits?.length ? ccp.criticalLimits : [""];

                    const updateCcpLimit = (li: number, val: string) => {
                      const next = [...limits];
                      next[li] = val;
                      updateCcp(ccp.id, 'criticalLimits', next);
                    };
                    const addCcpLimit = () => updateCcp(ccp.id, 'criticalLimits', [...limits, ""]);
                    const removeCcpLimit = (li: number) => {
                      if (limits.length <= 1) return;
                      updateCcp(ccp.id, 'criticalLimits', limits.filter((_, i) => i !== li));
                    };

                    return (
                    <div key={ccp.id} className={`p-4 border rounded-lg relative space-y-3 ${hasSignificantRisk ? 'border-orange-200 bg-orange-50/30' : 'border-slate-200 bg-slate-50/30'}`}>
                      <button onClick={() => removeCcp(ccp.id)} className="absolute top-2 right-2 text-slate-400 hover:text-red-500" title="Xóa CCP">✕</button>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Mã CCP</label>
                          <input
                            type="text"
                            value={ccp.ccpCode}
                            onChange={e => updateCcp(ccp.id, 'ccpCode', e.target.value)}
                            className={`w-full text-sm border p-1.5 rounded font-mono outline-none focus:border-orange-400 ${
                              data.ccps.filter(c => c.ccpCode.trim() !== "" && c.ccpCode.trim().toUpperCase() === ccp.ccpCode.trim().toUpperCase()).length > 1
                                ? 'border-red-500 text-red-600 bg-red-50'
                                : 'text-orange-600 border-slate-300'
                            }`}
                            placeholder="VD: CCP-1"
                          />
                          {data.ccps.filter(c => c.ccpCode.trim() !== "" && c.ccpCode.trim().toUpperCase() === ccp.ccpCode.trim().toUpperCase()).length > 1 && (
                            <p className="text-[9px] text-red-500 mt-0.5 font-bold">Mã đã tồn tại!</p>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Tên / Mục tiêu kiểm soát</label>
                          <input type="text" value={ccp.name} onChange={e => updateCcp(ccp.id, 'name', e.target.value)} className="w-full text-sm border p-1.5 rounded outline-none focus:border-cyan-400" placeholder="VD: Kiểm soát Nhiệt độ" />
                        </div>
                      </div>

                      {/* Critical Limits - có thể thêm nhiều */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[10px] font-bold text-orange-600 uppercase">
                            Giới hạn tới hạn (Critical Limits)
                          </label>
                          <span className="text-[9px] text-slate-400">{limits.filter(l => l.trim()).length} giới hạn đã thiết lập</span>
                        </div>
                        <div className="space-y-1.5">
                          {limits.map((lim, li) => (
                            <div key={li} className="flex gap-2 items-center">
                              <span className="text-[10px] font-bold text-orange-400 w-4 shrink-0">{li + 1}.</span>
                              <input
                                type="text"
                                value={lim}
                                onChange={e => updateCcpLimit(li, e.target.value)}
                                placeholder={li === 0 ? "VD: Nhiệt độ ≥ 72°C" : "Thêm điều kiện khác... VD: Thời gian ≥ 15 giây"}
                                className="flex-1 text-sm border border-orange-200 bg-white p-2 rounded font-mono outline-none focus:border-orange-400 shadow-inner"
                              />
                              {limits.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCcpLimit(li)}
                                  className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                  title="Xóa giới hạn này"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addCcpLimit}
                            className="mt-1 text-xs text-orange-600 hover:text-orange-800 border border-dashed border-orange-300 rounded px-3 py-1.5 w-full text-center transition-colors hover:bg-orange-50"
                          >
                            + Thêm giới hạn khác
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })
                }
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderStep5 = () => {
    const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 text-center p-8 space-y-6">
        <div className="w-16 h-16 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center mx-auto text-3xl">
          ✓
        </div>
        <div>
          <h3 className="text-xl font-bold text-slate-800">Hoàn tất Kế Hoạch!</h3>
          <p className="text-slate-500 text-sm mt-2">
            Bạn đang tạo kế hoạch <strong className="text-cyan-700">{data.planInfo.name || "Chưa đặt tên"}</strong> với {data.steps.length} công đoạn, {data.hazards.length} mối nguy đã xác định và {data.ccps.length} điểm kiểm soát tới hạn.
          </p>
        </div>

        {/* Linked Document Info */}
        {selectedDoc && (
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-left text-sm max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-blue-800 font-medium mb-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Đã liên kết với Tài liệu
            </div>
            <div className="text-blue-600 text-xs space-y-1">
              <p><span className="font-medium">Mã:</span> {selectedDoc.doc_code}</p>
              <p><span className="font-medium">Tên:</span> {selectedDoc.title}</p>
              <p><span className="font-medium">Loại:</span> {selectedDoc.doc_type}</p>
              <p><span className="font-medium">Phòng ban:</span> {selectedDoc.department}</p>
              <p><span className="font-medium">Trạng thái:</span> {selectedDoc.status}</p>
            </div>
          </div>
        )}

        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left text-sm max-w-sm mx-auto shadow-inner">
          <p className="font-semibold mb-2 text-slate-700">Tóm tắt:</p>
          <ul className="list-disc list-inside text-slate-600 space-y-1">
            <li>Sản phẩm mặc định sẽ được tạo.</li>
            <li>Lưu toàn bộ bước thiết lập.</li>
            <li>Kích hoạt giám sát tự động cho các CCP.</li>
            {selectedDoc && <li className="text-blue-600">Liên kết với tài liệu {selectedDoc.id}</li>}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={planId ? "Sửa Quy Trình HACCP" : "Tạo Quy Trình HACCP"} maxWidth="4xl">
      <div className="flex h-[600px] flex-col relative">
        {initialLoading && (
          <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center space-y-3">
            <span className="w-10 h-10 border-4 border-cyan-200 border-t-cyan-600 rounded-full animate-spin"></span>
            <p className="text-sm font-bold text-cyan-800">Đang tải dữ liệu quy trình...</p>
          </div>
        )}
        {/* Stepper Header */}
        <div className="bg-white border-b border-slate-100 p-4 flex justify-between relative shrink-0 overflow-x-auto">
          {/* Progress bar line background */}
          <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-100 -z-10 -translate-y-1/2"></div>

          {STEP_TITLES.map((title, index) => {
            const stepNum = index + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;

            return (
              <div key={title} className="flex flex-col items-center gap-2 bg-white px-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${isActive ? 'border-cyan-500 bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' :
                      isCompleted ? 'border-teal-500 bg-teal-500 text-white' :
                        'border-slate-200 bg-white text-slate-400'
                    }`}
                >
                  {isCompleted ? '✓' : stepNum}
                </div>
                <span className={`text-[10px] font-medium uppercase tracking-wide ${isActive ? 'text-cyan-700' : 'text-slate-400'}`}>
                  {title}
                </span>
              </div>
            );
          })}
        </div>

        {/* Content Area with Document Viewer */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Main Content */}
          <div className={`flex-1 bg-slate-50/50 p-6 overflow-y-auto transition-all duration-300 ${showDocumentViewer ? 'w-1/2' : 'w-full'}`}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
          </div>

          {/* Document Viewer Panel */}
          {showDocumentViewer && data.selectedDocumentId && (
            <div className="w-1/2 bg-white border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-300">
              {(() => {
                const selectedDoc = realDocuments.find(d => d.id === data.selectedDocumentId);
                if (!selectedDoc) return null;
                return (
                  <>
                    {/* Header */}
                    <div className="bg-blue-50 border-b border-blue-100 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-semibold text-blue-800">{selectedDoc.title}</h4>
                          <p className="text-xs text-blue-600">{selectedDoc.doc_code} • v{selectedDoc.current_version}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDocumentViewer(false)}
                        className="text-blue-400 hover:text-blue-600 p-1 rounded transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4">
                      {selectedDoc.ai_summary ? (
                        <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 mb-4">
                          <h5 className="text-xs font-bold text-blue-800 uppercase mb-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                            Tóm tắt AI (Dùng cho trích xuất dữ liệu)
                          </h5>
                          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap italic">
                            {selectedDoc.ai_summary}
                          </div>
                        </div>
                      ) : null}

                      {selectedDoc.attachment_url ? (
                        isImageFileForPreview(selectedDoc.attachment_file_type, selectedDoc.attachment_url) ? (
                          <div className="relative border border-slate-200 rounded-lg overflow-hidden bg-slate-100 flex flex-col h-[500px]">
                            {/* Zoom controls */}
                            <div className="absolute top-4 right-4 bg-white/90 backdrop-blur shadow-sm rounded-lg border border-slate-200 p-1 flex items-center gap-1 z-10">
                              <button onClick={() => setImageZoom(z => Math.max(0.25, z - 0.25))} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Thu nhỏ">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                              </button>
                              <span className="text-xs font-medium w-12 text-center text-slate-600">{Math.round(imageZoom * 100)}%</span>
                              <button onClick={() => setImageZoom(z => Math.min(5, z + 0.25))} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded" title="Phóng to">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                              </button>
                              <div className="w-px h-4 bg-slate-300 mx-1"></div>
                              <button onClick={() => setImageZoom(1)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded text-xs font-medium" title="Khôi phục">
                                Đặt lại
                              </button>
                            </div>
                            
                            {/* Image container */}
                            <div 
                              className={`flex-1 overflow-auto flex items-center justify-center p-4 ${isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'}`}
                              ref={imageContainerRef}
                              onMouseDown={handleImageMouseDown}
                              onMouseMove={handleImageMouseMove}
                              onMouseUp={handleImageMouseUp}
                              onMouseLeave={handleImageMouseUp}
                            >
                              <div style={{ transform: `scale(${imageZoom})`, transformOrigin: 'center center', transition: 'transform 0.15s ease-out' }}>
                                <img 
                                  src={resolvePublicFileUrl(selectedDoc.attachment_url)} 
                                  alt={selectedDoc.title}
                                  className="max-w-none shadow-sm rounded pointer-events-none select-none"
                                />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-[500px] border border-slate-200 rounded-lg overflow-hidden">
                            <iframe 
                              src={resolvePublicFileUrl(selectedDoc.attachment_url)} 
                              className="w-full h-full border-0"
                              title={selectedDoc.title}
                            />
                          </div>
                        )
                      ) : (
                        <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <svg className="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-sm">Tài liệu chưa có tệp đính kèm để xem trước</p>
                        </div>
                      )}
                    </div>
                    {/* Footer Info */}
                    <div className="bg-slate-50 border-t border-slate-200 p-3 text-xs text-slate-500">
                      <div className="flex justify-between">
                        <span>Phòng ban: {selectedDoc.department || "—"}</span>
                        <span>Trạng thái: {selectedDoc.status}</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-white border-t border-slate-100 px-6 py-4 flex justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="text-slate-500 hover:bg-slate-100 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Hủy Bỏ
            </button>

            {/* Document Viewer Toggle Button - Moved to footer */}
            {data.selectedDocumentId && !showDocumentViewer && (
              <button
                onClick={() => setShowDocumentViewer(true)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                title="Xem tài liệu"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>Xem tài liệu</span>
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Quay Lại
              </button>
            )}

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="bg-cyan-600 text-white hover:bg-cyan-700 px-8 py-2 rounded-lg text-sm font-bold shadow-md shadow-cyan-600/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
              >
                Tiếp Theo
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="bg-teal-600 text-white hover:bg-teal-700 px-8 py-2 rounded-lg text-sm font-bold shadow-md shadow-teal-600/20 transition-all hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> Đang lưu...</>
                ) : planId ? "Cập nhật Quy trình" : "Lưu & Kích Hoạt"}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
