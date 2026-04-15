import AppShell from "@/components/app-shell";
import { documents } from "@/lib/mock-data";

export default function DocumentControlPage() {
  const statusClass = (status: string) => {
    if (status === "Đã phê duyệt") {
      return "text-emerald-600";
    }
    if (status === "Đang xem xét") {
      return "text-amber-600";
    }
    return "text-rose-600";
  };

  return (
    <AppShell activePath="/document-control">
      <div className="flex items-center justify-between">
        <h1 className="text-5xl font-extrabold text-slate-800">
          Quản lý tài liệu
        </h1>
        <button className="rounded-lg bg-cyan-600 px-5 py-2.5 font-semibold text-white">
          + Tạo tài liệu
        </button>
      </div>
      <div className="mt-4 rounded-xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-700">Tất cả tài liệu</span>
          <input
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Tìm kiếm"
          />
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-2">Tên</th>
              <th className="py-2">Loại</th>
              <th className="py-2">Phòng ban</th>
              <th className="py-2">Tiêu chuẩn</th>
              <th className="py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="text-slate-700">
            {documents.map((doc, index) => (
              <tr
                key={doc.id}
                className={
                  index === documents.length - 1
                    ? ""
                    : "border-b border-slate-100"
                }
              >
                <td className="py-2">{doc.name}</td>
                <td>{doc.type}</td>
                <td>{doc.department}</td>
                <td>{doc.standard}</td>
                <td className={statusClass(doc.status)}>{doc.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
