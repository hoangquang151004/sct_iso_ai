import AppShell from "@/components/app-shell";
import { ActionsBySourceChart } from "@/components/charts";
import { capaStats, capaTableRows } from "@/lib/mock-data";

export default function CapaManagementPage() {
  const getStat = (label: string) =>
    capaStats.find((stat) => stat.label === label)?.count ?? 0;

  const statusClass = (status: string) => {
    if (status === "Đang xử lý") {
      return "bg-blue-500";
    }
    return "bg-orange-400";
  };

  return (
    <AppShell activePath="/capa-management">
      <h1 className="mb-6 text-2xl font-bold text-slate-800">Quản lý CAPA</h1>

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow">
          <div className="flex gap-4">
            <div className="text-center">
              <span className="text-2xl font-bold text-orange-400">
                {getStat("Mở")}
              </span>
              <span className="ml-1 font-medium text-slate-600">Mở</span>
            </div>
            <div className="border-l border-slate-200" />
            <div className="text-center">
              <span className="text-2xl font-bold text-blue-500">
                {getStat("Đang xử lý")}
              </span>
              <span className="ml-1 font-medium text-slate-600">
                Đang xử lý
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white p-4 shadow">
          <span className="text-2xl font-bold text-slate-800">
            {getStat("Đã đóng")}
          </span>
          <svg
            className="h-5 w-5 text-emerald-500"
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
          <span className="font-medium text-slate-600">Đã đóng</span>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-white p-4 shadow">
          <span className="text-2xl font-bold text-emerald-500">
            {getStat("Đóng đúng hạn")}%
          </span>
          <span className="font-medium text-slate-600">Đóng đúng hạn</span>
        </div>
      </div>

      <div className="rounded-xl bg-white shadow">
        <div className="flex items-start justify-between p-6">
          <div className="w-1/3">
            <h2 className="mb-6 font-bold text-slate-800">
              Hành động theo nguồn
            </h2>
            <div className="mx-auto mb-6 h-60 w-60">
              <ActionsBySourceChart />
            </div>
            <div className="grid grid-cols-2 gap-4 px-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400" />
                <span className="font-medium text-slate-700">HACCP</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="font-medium text-slate-700">PRP</span>
                </div>
                <span className="text-slate-500">30%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-teal-500" />
                <span className="font-medium text-slate-700">Khiếu nại</span>
              </div>
              <div className="flex items-center justify-end">
                <span className="text-slate-500">20% 50%</span>
              </div>
            </div>
          </div>

          <div className="flex-1 pl-8">
            <div className="mb-4 flex justify-end">
              <button className="flex items-center rounded bg-cyan-600 px-4 py-1.5 text-sm font-medium text-white shadow">
                + Tạo CAPA
              </button>
            </div>
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="rounded-tl-lg px-4 py-3 font-medium">ID</th>
                  <th className="px-4 py-3 font-medium">Mô tả</th>
                  <th className="px-4 py-3 font-medium">Nguồn</th>
                  <th className="px-4 py-3 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 font-medium">Hạn</th>
                  <th className="rounded-tr-lg px-4 py-3 font-medium">
                    Phụ trách
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {capaTableRows.map((row, index) => (
                  <tr key={`${row.id}-${index}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {row.id}
                    </td>
                    <td className="px-4 py-3">{row.description}</td>
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`${statusClass(row.status)} rounded px-2 py-1 text-xs text-white`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{row.dueDate}</td>
                    <td className="px-4 py-3">{row.assignee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
