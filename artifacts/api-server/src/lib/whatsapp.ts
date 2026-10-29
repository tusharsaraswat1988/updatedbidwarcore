import { dispatchPushWhatsApp } from "./communication/policy-engine";
import type { SendResult } from "./comm-sender";

export async function notifyPlayerSold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  teamName: string;
  amount: number;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const amt = `₹${opts.amount.toLocaleString("en-IN")}`;
  const msg =
    `*BidWar Auction Update*\n\nCongratulations ${opts.playerName}!\n\nYou have been *SOLD* to *${opts.teamName}* for *${amt}* in *${opts.tournamentName}*.\n\nGood luck for the tournament!`;
  return dispatchPushWhatsApp({
    event: "player_sold",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });
}

export async function notifyPlayerUnsold(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou went *UNSOLD* in today's auction for *${opts.tournamentName}*.\n\nDon't worry — there may be another round. Stay ready!`;
  return dispatchPushWhatsApp({
    event: "player_unsold",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });
}

export async function notifyPlayerReAuction(opts: {
  mobile: string | null;
  tournamentId: number;
  playerName: string;
  tournamentName: string;
  whatsappConsent?: boolean | null;
}): Promise<SendResult & { blocked?: boolean }> {
  if (!opts.mobile) {
    return { success: false, blocked: true, error: "Missing recipient mobile number" };
  }
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou have been returned to the *auction pool* for *${opts.tournamentName}* and will be *RE-AUCTIONED*.\n\nStay tuned!`;
  return dispatchPushWhatsApp({
    event: "player_reauction",
    tournamentId: opts.tournamentId,
    mobile: opts.mobile,
    body: msg,
    recipientConsent: opts.whatsappConsent,
  });
}
