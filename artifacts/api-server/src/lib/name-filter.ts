const BLOCKLIST = [
  "fuck","shit","ass","bitch","bastard","cunt","dick","cock","pussy","whore","slut","nigger","nigga","faggot","fag","retard","rape","raping","rapist",
  "chutiya","madarchod","behenchod","bhenchod","gaandu","gandu","chut","lund","bsdk","mc","bc","maderchod","bhosdi","randi","harami","saala","bhosdike","teri ma","sala","lavde","laude","lawde","hijra",
  "motherfucker","fucker","asshole","dumbass","jackass","bullshit","piss","pissed","damn","crap",
].map(w => w.toLowerCase());

export function isNameClean(name: string): boolean {
  const lower = name.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
  return !BLOCKLIST.some(bad => lower.split(/\s+/).includes(bad) || lower.includes(bad));
}
