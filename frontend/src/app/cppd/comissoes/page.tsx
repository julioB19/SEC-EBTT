import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import CppdCommissionManagement from "@/components/CppdCommissionManagement";

async function ensureCentralCppdRole() {
  const jar = await cookies();
  const access = jar.get("accessToken")?.value;

  if (!access) {
    redirect("/login");
  }

  try {
    const payload = JSON.parse(
      Buffer.from(access.split(".")[1], "base64url").toString("utf8"),
    );
    if (payload?.selectedRole === "CPPD_CENTRAL") return;
  } catch {
    redirect("/login");
  }

  redirect("/forbidden");
}

export default async function CentralCppdCommissionsPage() {
  await ensureCentralCppdRole();
  return <CppdCommissionManagement backHref="/cppd" />;
}
