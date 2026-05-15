const BLOCKLIST = [
  "fuck","shit","ass","bitch","bastard","cunt","dick","cock","pussy","whore","slut","nigger","nigga","faggot","fag","retard","rape","raping","rapist",
  "chutiya","madarchod","behenchod","bhenchod","gaandu","gandu","chut","lund","bsdk","mc","bc","maderchod","bhosdi","randi","harami","saala","bhosdike","sala","lavde","laude","lawde","hijra",
  "motherfucker","fucker","asshole","dumbass","jackass","bullshit","piss","crap",
].map(w => w.toLowerCase());

export function isNameClean(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  const tokens = new Set(lower.split(/\s+/).filter(Boolean));
  return !BLOCKLIST.some(bad => {
    if (tokens.has(bad)) return true;
    if (bad.length > 4 && lower.includes(bad)) return true;
    return false;
  });
}
