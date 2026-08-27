// Gate del Marketer IA: hoy es una feature privada de Ales (Dirección).
// Cambiar aquí para ampliar o migrar a un flag por profesional en la BD.
const MARKETER_IA_ALLOWLIST = ["fisiofitteam@fisiofitteam.com"];

export function canUseMarketerIA(email: string | null | undefined): boolean {
  if (!email) return false;
  return MARKETER_IA_ALLOWLIST.includes(email.toLowerCase());
}
