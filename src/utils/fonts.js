export const FONT_OPTIONS = [
  { value: "Overused Grotesk",label: "Overused Grotesk",sample: "Aa — grotesca moderna" },
  { value: "DM Sans",         label: "DM Sans",         sample: "Aa — moderna y limpia" },
  { value: "Outfit",          label: "Outfit",           sample: "Aa — geométrica y suave" },
  { value: "Syne",            label: "Syne",             sample: "Aa — editorial y audaz" },
  { value: "Space Grotesk",   label: "Space Grotesk",    sample: "Aa — técnica y legible" },
  { value: "Josefin Sans",    label: "Josefin Sans",     sample: "Aa — art deco minimalista" },
  { value: "Raleway",         label: "Raleway",          sample: "Aa — elegante y delgada" },
  { value: "Lora",            label: "Lora",             sample: "Aa — serif clásica" },
  { value: "Playfair Display",label: "Playfair Display", sample: "Aa — serif de lujo" },
  { value: "Fraunces",        label: "Fraunces",         sample: "Aa — serif expresiva" },
];

const EXTRA_FONTS = {
  "Outfit":          "Outfit:wght@300;400;500;600",
  "Syne":            "Syne:wght@400;500;600;700",
  "Space Grotesk":   "Space+Grotesk:wght@300;400;500;600",
  "Josefin Sans":    "Josefin+Sans:ital,wght@0,300;0,400;0,600;1,300",
  "Raleway":         "Raleway:wght@300;400;500;600",
  "Lora":            "Lora:ital,wght@0,400;0,500;1,400",
  "Playfair Display":"Playfair+Display:ital,wght@0,400;0,500;1,400",
  "Fraunces":        "Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,500;1,9..144,300",
};

const loaded = new Set(["DM Sans", "Inter"]);

export function ensureFont(family) {
  if (!family || loaded.has(family)) return;
  const spec = EXTRA_FONTS[family];
  if (!spec) return;
  loaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  document.head.appendChild(link);
}
