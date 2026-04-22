"use client";

import { useMemo, useState } from "react";

const STORAGE_PREFIX = "documentControl:autoSchedule:v1:";

export type ScheduleFrequency = "daily" | "weekly" | "monthly" | "quarterly";

export type DocumentAutoScheduleState = {
  enabled: boolean;
  frequency: ScheduleFrequency;
  /** HH:mm theo giờ máy (chỉ dùng UI; sau này backend/AI chuẩn hóa múi giờ) */
  timeLocal: string;
  /** 1 = Thứ Hai … 7 = Chủ nhật (chỉ dùng khi weekly) */
  dayOfWeek: number;
  /** 1–28 (chỉ dùng khi monthly / quarterly gợi ý) */
  dayOfMonth: number;
  note: string;
  updatedAt: string | null;
};

const DEFAULT_STATE: DocumentAutoScheduleState = {
  enabled: false,
  frequency: "weekly",
  timeLocal: "09:00",
  dayOfWeek: 1,
  dayOfMonth: 1,
  note: "",
  updatedAt: null,
};

const FREQ_LABELS: Record<ScheduleFrequency, string> = {
  daily: "Mỗi ngày",
  weekly: "Mỗi tuần",
  monthly: "Mỗi tháng",
  quarterly: "Mỗi quý",
};

const WEEKDAY_LABELS: Record<number, string> = {
  1: "Thứ Hai",
  2: "Thứ Ba",
  3: "Thứ Tư",
  4: "Thứ Năm",
  5: "Thứ Sáu",
  6: "Thứ Bảy",
  7: "Chủ nhật",
};

export function scheduleStorageKey(orgId: string): string {
  return `${STORAGE_PREFIX}${orgId || "default"}`;
}

export function loadDocumentSchedule(orgId: string): DocumentAutoScheduleState {
  if (typeof window === "undefined") return { ...DEFAULT_STATE };
  try {
    const raw = localStorage.getItem(scheduleStorageKey(orgId));
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<DocumentAutoScheduleState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      dayOfWeek: Math.min(7, Math.max(1, Number(parsed.dayOfWeek) || 1)),
      dayOfMonth: Math.min(28, Math.max(1, Number(parsed.dayOfMonth) || 1)),
      timeLocal:
        typeof parsed.timeLocal === "string" && /^\d{2}:\d{2}$/.test(parsed.timeLocal)
          ? parsed.timeLocal
          : DEFAULT_STATE.timeLocal,
      frequency: (["daily", "weekly", "monthly", "quarterly"] as const).includes(
        parsed.frequency as ScheduleFrequency,
      )
        ? (parsed.frequency as ScheduleFrequency)
        : DEFAULT_STATE.frequency,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveDocumentSchedule(
  orgId: string,
  state: DocumentAutoScheduleState,
): void {
  if (typeof window === "undefined") return;
  const next: DocumentAutoScheduleState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(scheduleStorageKey(orgId), JSON.stringify(next));
}

export function formatDocumentScheduleSummary(
  s: DocumentAutoScheduleState,
): string {
  if (!s.enabled) return "Đang tắt";
  const t = s.timeLocal || "09:00";
  if (s.frequency === "daily") return `${FREQ_LABELS.daily} lúc ${t}`;
  if (s.frequency === "weekly") {
    const d = WEEKDAY_LABELS[s.dayOfWeek] ?? "Thứ Hai";
    return `${FREQ_LABELS.weekly} — ${d} lúc ${t}`;
  }
  if (s.frequency === "monthly") {
    return `${FREQ_LABELS.monthly} — ngày ${s.dayOfMonth} lúc ${t}`;
  }
  return `${FREQ_LABELS.quarterly} — ngày ${s.dayOfMonth} trong tháng đầu quý lúc ${t} (gợi ý)`;
}

type DocumentScheduleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  onSaved: (state: DocumentAutoScheduleState) => void;
};

export default function DocumentScheduleModal({
  isOpen,
  onClose,
  orgId,
  onSaved,
}: DocumentScheduleModalProps) {
  if (!isOpen) return null;
  return (
    <DocumentScheduleModalContent
      key={orgId}
      onClose={onClose}
      orgId={orgId}
      onSaved={onSaved}
    />
  );
}

type DocumentScheduleModalContentProps = {
  onClose: () => void;
  orgId: string;
  onSaved: (state: DocumentAutoScheduleState) => void;
};

function DocumentScheduleModalContent({
  onClose,
  orgId,
  onSaved,
}: DocumentScheduleModalContentProps) {
  const [draft, setDraft] = useState<DocumentAutoScheduleState>(() =>
    loadDocumentSchedule(orgId),
  );
  const [savedFlash, setSavedFlash] = useState(false);

  const summary = useMemo(() => formatDocumentScheduleSummary(draft), [draft]);

  const handleSave = () => {
    saveDocumentSchedule(orgId, draft);
    onSaved({ ...draft, updatedAt: new Date().toISOString() });
    setSavedFlash(true);
    window.setTimeout(() => {
      setSavedFlash(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-[54] flex items-center justify-center bg-slate-900/40 p-4 text-left backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-labelledby="schedule-title"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2
            id="schedule-title"
            className="text-xl font-bold text-slate-800"
          >
            Đặt lịch tự động
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-4">
          <p className="text-xs leading-relaxed text-slate-500">
            Cấu hình chỉ lưu trên trình duyệt của bạn. Sau này có thể nối backend /
            AI để thực sự gửi nhắc rà soát tài liệu.
          </p>

          <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-800">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) =>
                setDraft((d) => ({ ...d, enabled: e.target.checked }))
              }
              className="h-4 w-4 rounded border-slate-300 text-cyan-600"
            />
            Bật lịch tự động (nhắc rà soát / xử lý tài liệu)
          </label>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Tần suất
              </label>
              <select
                value={draft.frequency}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    frequency: e.target.value as ScheduleFrequency,
                  }))
                }
                disabled={!draft.enabled}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 disabled:opacity-50"
              >
                {(Object.keys(FREQ_LABELS) as ScheduleFrequency[]).map((k) => (
                  <option key={k} value={k}>
                    {FREQ_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Giờ chạy
              </label>
              <input
                type="time"
                value={draft.timeLocal}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, timeLocal: e.target.value }))
                }
                disabled={!draft.enabled}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 disabled:opacity-50"
              />
            </div>

            {draft.frequency === "weekly" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Ngày trong tuần
                </label>
                <select
                  value={draft.dayOfWeek}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      dayOfWeek: Number(e.target.value),
                    }))
                  }
                  disabled={!draft.enabled}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 disabled:opacity-50"
                >
                  {([1, 2, 3, 4, 5, 6, 7] as const).map((n) => (
                    <option key={n} value={n}>
                      {WEEKDAY_LABELS[n]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {draft.frequency === "monthly" || draft.frequency === "quarterly" ? (
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">
                  Ngày trong tháng (1–28)
                </label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={draft.dayOfMonth}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      dayOfMonth: Math.min(
                        28,
                        Math.max(1, Number(e.target.value) || 1),
                      ),
                    }))
                  }
                  disabled={!draft.enabled}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 disabled:opacity-50"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Ghi chú (tuỳ chọn)
              </label>
              <textarea
                value={draft.note}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, note: e.target.value }))
                }
                disabled={!draft.enabled}
                rows={3}
                placeholder="Ví dụ: nhắc phòng QA rà soát SOP trước hạn ISO…"
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-700 placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50/60 px-3 py-2.5 text-sm text-slate-800">
            <span className="font-semibold text-cyan-800">Xem trước: </span>
            {summary}
          </div>

          {savedFlash ? (
            <p className="mt-2 text-sm font-medium text-emerald-600">
              Đã lưu cấu hình trên trình duyệt.
            </p>
          ) : null}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-600/20 hover:bg-cyan-700"
          >
            Lưu lịch
          </button>
        </div>
      </div>
    </div>
  );
}
