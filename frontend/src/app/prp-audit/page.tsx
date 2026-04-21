import AppShell from "@/components/layout/app-shell";
import {
  auditMonths,
  auditZones,
  prpAuditScore,
  prpChecklist,
  prpChecklistTableRows,
  prpNonConformities,
  prpUpcomingAuditNote,
  prpUpcomingAudits,
} from "@/lib/mock-data";

export default function PrpAuditPage() {
  return (
    <AppShell activePath="/prp-audit">
      <h1 className="mb-4 text-2xl font-bold text-slate-800">Đánh giá PRP</h1>
      <div className="mb-6 flex gap-4">
        <select className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700">
          {auditZones.map((zone) => (
            <option key={zone}>{zone}</option>
          ))}
        </select>
        <select className="rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-700">
          {auditMonths.map((month) => (
            <option key={month}>{month}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-6">
        <section className="w-64 space-y-6">
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-white p-6 text-center shadow">
            <h2 className="mb-2 self-start font-bold text-slate-800">Điểm</h2>
            <div className="relative h-32 w-32">
              <svg viewBox="0 0 36 36" className="h-full w-full">
                <path
                  className="text-slate-100"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeWidth="4"
                  strokeDasharray="75, 100"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-orange-400"
                  strokeWidth="4"
                  strokeDasharray="20, 100"
                  strokeDashoffset="-75"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center text-3xl font-bold text-slate-800">
                {prpAuditScore.value}
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="mb-2 font-bold text-slate-800">Xếp hạng</h3>
            <div className="text-4xl font-bold text-[#1e8b9b]">
              #{prpAuditScore.value}
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="mb-4 font-bold text-slate-800">Danh mục kiểm tra</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              {prpChecklist.slice(0, 3).map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <svg
                    className="h-4 w-4 text-emerald-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="flex-1 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-bold text-slate-800">
            Danh mục kiểm tra
          </h2>
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-blue-50/50">
              <tr>
                <th className="w-8 px-2 py-3 font-medium">#</th>
                <th className="px-2 py-3 font-medium">Hạng mục</th>
                <th className="px-2 py-3 text-center font-medium">Đánh giá</th>
                <th className="px-2 py-3 font-medium">Ghi chú</th>
                <th className="px-2 py-3 font-medium">Ảnh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prpChecklistTableRows.map((row) => (
                <tr key={row.id}>
                  <td className="px-2 py-3">
                    <svg
                      className="h-5 w-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </td>
                  <td className="px-2 py-3 font-medium">{row.item}</td>
                  <td className="px-2 py-3 text-center font-bold">
                    {row.rating === "pass" ? (
                      <span className="text-emerald-500">✓</span>
                    ) : row.rating === "fail" ? (
                      <span className="text-red-500">×</span>
                    ) : row.rating === "warn" ? (
                      <span className="text-orange-400">—</span>
                    ) : (
                      <span className="text-orange-400">!</span>
                    )}
                  </td>
                  <td
                    className={`px-2 py-3 ${
                      row.rating === "note"
                        ? "text-orange-400 font-semibold"
                        : ""
                    }`}
                  >
                    {row.note}
                  </td>
                  <td className="px-2 py-3">
                    {row.photoType === "image" ? (
                      <div className="h-8 w-12 overflow-hidden rounded bg-slate-200" />
                    ) : row.photoType === "label" ? (
                      <div className="flex h-8 w-12 items-center justify-center rounded bg-red-100 text-[8px] font-bold text-red-500">
                        ẢNH
                      </div>
                    ) : (
                      <div className="h-8 w-12 rounded bg-slate-200" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="w-64 space-y-6">
          <div className="rounded-xl bg-[#1e8b9b] p-5 text-white shadow">
            <h3 className="mb-3 font-bold">Điểm không phù hợp</h3>
            <ul className="list-disc space-y-2 pl-4 text-sm text-teal-50">
              {prpNonConformities.map((item) => (
                <li key={item.message}>{item.message}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <h3 className="mb-3 font-bold text-slate-800">Đánh giá sắp tới</h3>
            <ul className="space-y-2 text-sm text-slate-600">
              {prpUpcomingAudits.map((audit) => (
                <li
                  key={`${audit.zone}-${audit.date}`}
                  className="flex items-center before:mr-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-teal-500 before:content-['']"
                >
                  {audit.zone} ({audit.date})
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-white p-5 shadow">
            <h3 className="mb-3 font-bold text-slate-800">Đánh giá sắp tới</h3>
            <p className="text-sm text-slate-600">{prpUpcomingAuditNote}</p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
