import { redirect } from "next/navigation";

/** Trang gốc luôn dẫn tới đăng nhập (middleware cũng redirect `/` → `/login`). */
export default function Home() {
  redirect("/login");
}
