const PRESETS = {
  brandWordmark: "w_960,c_limit,f_auto,q_auto",
  obsBroadcastLogo: "w_960,c_limit,e_trim,f_auto,q_auto",
} as const;

export type CldPreset = keyof typeof PRESETS;

export function cldUrl(url: string | null | undefined, preset: CldPreset): string {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  const params = PRESETS[preset];
  if (url.includes(params)) return url;
  return url.replace("/upload/", `/upload/${params}/`);
}
