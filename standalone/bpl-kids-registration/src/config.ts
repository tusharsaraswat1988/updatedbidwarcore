export type Role = 'Batsman' | 'Bowler' | 'All Rounder' | 'Wicket Keeper';
export const tournament = {
  name: 'BidWar Premier League — Kids Version', slug: 'bpl-kids-2026', dates: '3rd & 4th October', organiser: 'Bidwar.in & KV TechMedia', venue: 'Venue details will be shared with registered teams.',
  registrationEnabled: true, registrationStartDateTime: '2026-01-01T00:00:00+05:30', registrationEndDateTime: '2026-10-01T23:59:00+05:30', playersPerTeam: 8, mentorCount: 1,
  categories: [{ id: 'class-4-6', label: 'Category 1', detail: 'Class 4, 5 & 6', classes: ['4', '5', '6'] }, { id: 'class-7-9', label: 'Category 2', detail: 'Class 7, 8 & 9', classes: ['7', '8', '9'] }],
  pricing: { registrationFee: 8000, brandingFee: 5000, currency: 'INR' },
  payment: { link: 'https://example.com/replace-with-payment-link', qrImage: '', instructions: 'Make the exact total payment using the link or QR code. Upload a clear screenshot and enter the UTR / transaction ID below.' },
  cloudinary: { folder: 'bpl-kids-2026', maxBytes: 5 * 1024 * 1024, allowedTypes: ['image/jpeg', 'image/png', 'image/webp'] },
  whatsappLink: 'https://chat.whatsapp.com/replace-with-community-link',
  sponsors: [{ type: 'TITLE SPONSOR', name: 'Your Sponsor', logo: '', displayOrder: 1 }, { type: 'ASSOCIATE SPONSOR', name: 'Partner', logo: '', displayOrder: 2 }],
  email: { adminRecipients: [''], templateName: 'bpl-kids-confirmation' },
  roleFields: {
    Batsman: [{ key: 'battingStyle', label: 'Batting style', options: ['Right hand', 'Left hand'] }],
    Bowler: [{ key: 'bowlingStyle', label: 'Bowling style', options: ['Right arm pace', 'Left arm pace', 'Right arm spin', 'Left arm spin'] }],
    'All Rounder': [{ key: 'battingStyle', label: 'Batting style', options: ['Right hand', 'Left hand'] }, { key: 'bowlingStyle', label: 'Bowling style', options: ['Right arm pace', 'Left arm pace', 'Right arm spin', 'Left arm spin'] }],
    'Wicket Keeper': [{ key: 'battingStyle', label: 'Batting style', options: ['Right hand', 'Left hand'] }]
  } satisfies Record<Role, {key: string; label: string; options: string[]}[]>
} as const;
export const isRegistrationOpen = () => tournament.registrationEnabled && Date.now() >= Date.parse(tournament.registrationStartDateTime) && Date.now() <= Date.parse(tournament.registrationEndDateTime);
