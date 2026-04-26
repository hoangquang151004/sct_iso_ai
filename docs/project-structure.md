# Cấu trúc thư mục chuẩn - SCT-ISO.AI

Ngày cập nhật: 2026-04-22.

Tài liệu này định nghĩa cấu trúc thư mục chuẩn ở mức monorepo để team mở rộng thống nhất, không phá vỡ luồng hiện tại của backend/frontend.

## 1) Cấu trúc chuẩn đề xuất

```text
sct_iso_ai/
  backend/              # FastAPI + SQLAlchemy + Alembic
    core/               # config, security core, shared backend utils
    database/           # models, session/get_db, base metadata
    modules/            # domain modules (auth, users, rbac, ...)
    alembic/            # migrations
    tests/              # pytest
    script/             # script nghiệp vụ backend (seed, bootstrap)

  frontend/             # Next.js App Router
    src/
      app/              # routes, page/layout
      api/              # API calls tập trung theo domain (auth/users/rbac/sessions/documents/reports)
      components/       # layout/shared/ui components
      services/         # compatibility exports (legacy), không thêm API mới
      types/            # shared TS types
      hooks/            # reusable hooks
      lib/              # infra helpers (api client, auth context, route helpers, mock), không chứa API domain
    e2e/                # Playwright tests

  docs/                 # tài liệu kiến trúc, API, quy ước, vận hành
  ui/                   # HTML prototype/legacy demo (nếu còn dùng)

  scripts/              # script ở mức repo (CI helper, tooling scripts)
  infra/                # hạ tầng dùng chung (docker, k8s, deploy templates)
  shared/               # tài nguyên dùng chung nhiều app (schema/contracts)
  tools/                # công cụ dev nội bộ (generator, migration helper)

  .github/              # workflows, templates, prompts
  .cursor/              # rules/config phục vụ agent trong workspace
```

## 2) Quy tắc tổ chức nhanh

- Không đặt logic nghiệp vụ mới ở repo root.
- Script chỉ phục vụ backend giữ trong `backend/script`; script dùng cho toàn repo đặt ở `scripts/`.
- Mọi định nghĩa dùng chung giữa backend/frontend (contract/schema) ưu tiên đặt trong `shared/`.
- File hạ tầng (compose override, deployment manifests, provisioning templates) đặt trong `infra/`.
- Khi thêm thư mục mới ở root, cần cập nhật lại tài liệu này và `README.md`.
