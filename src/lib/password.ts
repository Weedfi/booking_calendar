/** Rules for the password a user sets for themselves on the account page. */

export const PASSWORD_MIN_LENGTH = 8;
// Supabase hashes passwords with bcrypt, which ignores everything after 72 bytes.
export const PASSWORD_MAX_BYTES = 72;

export type PasswordCheck = { ok: true } | { ok: false; message: string };

export function checkNewPassword(password: string, confirmation: string): PasswordCheck {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, message: `Hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.` };
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) {
    return { ok: false, message: "Hasło jest za długie." };
  }
  if (password.trim() === "") {
    return { ok: false, message: "Hasło nie może składać się z samych spacji." };
  }
  if (password !== confirmation) {
    return { ok: false, message: "Hasła nie są takie same." };
  }
  return { ok: true };
}
