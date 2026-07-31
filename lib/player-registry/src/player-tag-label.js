const PLAYER_TAG_LABELS = {
    captain: "Captain",
    vice_captain: "Vice Captain",
    owner: "Owner",
    co_owner: "Co-Owner",
    booster: "Booster",
    icon: "Icon",
    star_player: "Star Player",
};
export function playerTagLabel(tag) {
    if (!tag)
        return null;
    return PLAYER_TAG_LABELS[tag] ?? "Tagged";
}
