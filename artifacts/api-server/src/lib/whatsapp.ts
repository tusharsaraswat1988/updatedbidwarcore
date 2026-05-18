import { sendLicensedWhatsApp } from "./comm-sender";

export async function notifyPlayerSold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  teamName: string;
  amount: number;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const amt = `₹${opts.amount.toLocaleString("en-IN")}`;
  const msg =
    `*BidWar Auction Update*\n\nCongratulations ${opts.playerName}!\n\nYou have been *SOLD* to *${opts.teamName}* for *${amt}* in *${opts.tournamentName}*.\n\nGood luck for the tournament!`;
  await sendLicensedWhatsApp(opts.tournamentId, opts.mobile, msg);
}

export async function notifyPlayerUnsold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou went *UNSOLD* in today's auction for *${opts.tournamentName}*.\n\nDon't worry — there may be another round. Stay ready!`;
  await sendLicensedWhatsApp(opts.tournamentId, opts.mobile, msg);
}

export async function notifyPlayerReAuction(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou have been returned to the *auction pool* for *${opts.tournamentName}* and will be *RE-AUCTIONED*.\n\nStay tuned!`;
  await sendLicensedWhatsApp(opts.tournamentId, opts.mobile, msg);
}
