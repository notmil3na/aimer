export const APPROVED_GREEN = "#008A3A";

const LEGACY_APPROVED_GREENS = new Set(["#6ec88a", "#6ec8a8", "#6ec8b4"]);

export function normalizeApprovedColor(user) {
  let colors = user?.themeColors;
  for (let i = 0; i < 3 && typeof colors === "string"; i++) {
    try {
      colors = JSON.parse(colors);
    } catch {
      return user;
    }
  }
  if (!colors || typeof colors !== "object") return user;

  const approved = String(colors.aprobada || "").toLowerCase();
  if (!LEGACY_APPROVED_GREENS.has(approved)) return user;

  return {
    ...user,
    themeColors: { ...colors, aprobada: APPROVED_GREEN },
  };
}
