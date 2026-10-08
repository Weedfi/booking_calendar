"use server";

import { getCurrentUser } from "@/lib/auth";
import { DEMO_READ_ONLY_MESSAGE, isDemoMode } from "@/lib/demo";
import { checkNewPassword } from "@/lib/password";
import { createClient } from "@/lib/supabase/server";

export type PasswordState = { status: "idle" | "saved" | "error"; message?: string };

/** Sets or changes the signed-in user's own password. */
export async function setPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  // The demo accounts are shared by every visitor.
  if (isDemoMode()) return { status: "error", message: DEMO_READ_ONLY_MESSAGE };
  if (!(await getCurrentUser())) return { status: "error", message: "Zaloguj się ponownie." };

  const password = String(formData.get("password") ?? "");
  const check = checkNewPassword(password, String(formData.get("confirmation") ?? ""));
  if (!check.ok) return { status: "error", message: check.message };

  // updateUser acts on the session in the cookies, so a user can only ever
  // change their own password.
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error?.code === "same_password") {
    return { status: "error", message: "To jest Twoje obecne hasło. Wpisz nowe." };
  }
  if (error?.code === "weak_password") {
    return { status: "error", message: "To hasło jest za słabe. Wybierz dłuższe lub mniej oczywiste." };
  }
  if (error?.code === "reauthentication_needed") {
    return { status: "error", message: "Ze względów bezpieczeństwa wyloguj się, zaloguj linkiem na email i spróbuj ponownie." };
  }
  if (error) return { status: "error", message: "Nie udało się zapisać hasła. Spróbuj ponownie." };

  return { status: "saved", message: "Hasło zapisane. Od teraz możesz logować się emailem i hasłem." };
}
