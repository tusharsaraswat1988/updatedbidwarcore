import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

export const contactInquiriesTable = pgTable(
  "contact_inquiries",
  {
    id: serial("id").primaryKey(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    inquiryType: text("inquiry_type").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    consent: text("consent").notNull().default("granted"),
    status: text("status").notNull().default("new"),
    source: text("source").notNull().default("website_contact_page"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ix_contact_inquiries_created_at").on(t.createdAt),
    index("ix_contact_inquiries_status").on(t.status),
    index("ix_contact_inquiries_email").on(t.email),
  ],
);

export type ContactInquiry = typeof contactInquiriesTable.$inferSelect;
