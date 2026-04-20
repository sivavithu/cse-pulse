import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getUserSetting } from "@/lib/db/queries";

/**
 * Returns the signed-in user's email, or null if there's no session.
 * Use this in API routes and server components to scope queries.
 */
export async function currentUserEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function requireCurrentUserEmail(): Promise<string> {
  const email = await currentUserEmail();
  if (!email) redirect("/login");
  return email;
}

export async function requireOnboardedUser(): Promise<string> {
  const email = await requireCurrentUserEmail();
  if (await getUserSetting(email, "onboarding_complete") !== "true") {
    redirect("/onboarding");
  }
  return email;
}
