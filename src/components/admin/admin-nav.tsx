import Link from "next/link";
import { countOpenDisputes } from "@/lib/disputes/resolve";

export async function AdminNav({ current }: { current: "conversion" | "disputes" }) {
  const openDisputes = await countOpenDisputes();
  const linkClass = (active: boolean) =>
    `text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`;

  return (
    <nav className="flex items-center gap-4">
      <Link href="/admin/conversion" className={linkClass(current === "conversion")}>
        Conversion
      </Link>
      <Link href="/admin/disputes" className={linkClass(current === "disputes")}>
        Disputes{openDisputes > 0 ? ` (${openDisputes})` : ""}
      </Link>
    </nav>
  );
}
