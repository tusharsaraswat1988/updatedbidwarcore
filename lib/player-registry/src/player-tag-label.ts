const PLAYER_TAG_LABELS: Record<string, string> = {
  captain: "Captain",
  vice_captain: "Vice Captain",
  owner: "Owner",
  co_owner: "Co-Owner",
  booster: "Booster",
  icon: "Icon",
  star_player: "Star Player",
};

export function playerTagLabel(tag: string | null | undefined): string | null {
  if (!tag) return null;
  return PLAYER_TAG_LABELS[tag] ?? "Tagged";
}
