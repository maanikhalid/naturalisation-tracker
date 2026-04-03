"use server";

import { redirect } from "next/navigation";
import { clearAdminCookie } from "@/lib/auth";

export async function logoutAdmin() {
  await clearAdminCookie();
  redirect("/admin");
}
