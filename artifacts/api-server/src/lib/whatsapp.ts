const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

function toWhatsApp(mobile: string): string {
  const digits = mobile.replace(/\D/g, "");
  const withCountry = digits.startsWith("91") ? digits : digits.startsWith("0") ? `91${digits.slice(1)}` : `91${digits}`;
  return `whatsapp:+${withCountry}`;
}

async function sendWhatsApp(to: string, body: string): Promise<void> {
  if (!ACCOUNT_SID || !AUTH_TOKEN) return;
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/Messages.json`;
    const params = new URLSearchParams({ From: FROM, To: toWhatsApp(to), Body: body });
    await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
  } catch {
  }
}

export async function notifyPlayerSold(opts: {
  mobile: string | null;
  playerName: string;
  teamName: string;
  amount: number;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const amt = `₹${opts.amount.toLocaleString("en-IN")}`;
  const msg =
    `*BidWar Auction Update*\n\nCongratulations ${opts.playerName}! 🎉\n\nYou have been *SOLD* to *${opts.teamName}* for *${amt}* in *${opts.tournamentName}*.\n\nGood luck for the tournament!`;
  await sendWhatsApp(opts.mobile, msg);
}

export async function notifyPlayerUnsold(opts: {
  mobile: string | null;
  playerName: string;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou went *UNSOLD* in today's auction for *${opts.tournamentName}*.\n\nDon't worry — there may be another round. Stay ready!`;
  await sendWhatsApp(opts.mobile, msg);
}

export async function notifyPlayerReAuction(opts: {
  mobile: string | null;
  playerName: string;
  tournamentName: string;
}): Promise<void> {
  if (!opts.mobile) return;
  const msg =
    `*BidWar Auction Update*\n\nHi ${opts.playerName},\n\nYou have been returned to the *auction pool* for *${opts.tournamentName}* and will be *RE-AUCTIONED*.\n\nStay tuned!`;
  await sendWhatsApp(opts.mobile, msg);
}
