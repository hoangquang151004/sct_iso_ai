import AppShell from "@/components/app-shell";
import {
  auditLogs,
  passwordPolicy,
  securityFeatures,
  userRoles,
} from "@/lib/mock-data";

export default function UserManagementPage() {
  return (
    <AppShell activePath="/user-management">
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-center text-5xl font-extrabold text-slate-800">
          Quản lý người dùng & Bảo mật
        </h1>

        <div className="mt-5 rounded-lg bg-cyan-100 px-4 py-3 text-slate-700">
          Người dùng sẽ bị vô hiệu hóa sau {passwordPolicy.inactivityTimeout}{" "}
          ngày không hoạt động
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {securityFeatures.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 p-4"
            >
              <h3 className="text-2xl font-bold">{feature.title}</h3>
              <p className="mt-2 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <section className="rounded-xl border border-slate-200 p-4 lg:col-span-2">
            <h2 className="text-2xl font-bold">Quản lý vai trò</h2>
            <table className="mt-4 w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-2">Vai trò</th>
                  <th className="py-2">Xem</th>
                  <th className="py-2">Sửa</th>
                  <th className="py-2">Xóa</th>
                </tr>
              </thead>
              <tbody>
                {userRoles.map((role) => (
                  <tr key={role.name} className="border-b border-slate-100">
                    <td className="py-2 font-semibold">{role.name}</td>
                    <td className="py-2">
                      {role.permissions.view ? "✓" : "-"}
                    </td>
                    <td className="py-2">
                      {role.permissions.edit ? "✓" : "-"}
                    </td>
                    <td className="py-2">
                      {role.permissions.delete ? "✓" : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="rounded-xl border border-slate-200 p-4">
            <h2 className="text-2xl font-bold">Dòng thời gian kiểm toán</h2>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {auditLogs.map((log) => (
                <li key={log.action}>{log.action}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
