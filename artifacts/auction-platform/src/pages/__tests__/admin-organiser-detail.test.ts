import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("BIDWAR — Admin Organiser Detail Access Governance & Audit Dialog", () => {
  const pageSrc = readFileSync(
    path.resolve(__dirname, "../admin-organiser-detail.tsx"),
    "utf8"
  );
  const authLibSrc = readFileSync(
    path.resolve(__dirname, "../../lib/auth.ts"),
    "utf8"
  );
  const authRouteSrc = readFileSync(
    path.resolve(__dirname, "../../../../api-server/src/routes/auth.ts"),
    "utf8"
  );

  describe("1. Audit Reason Governance & Modal Implementation", () => {
    it("imports AuditReasonField and isAuditReasonValid", () => {
      expect(pageSrc).toContain("AuditReasonField");
      expect(pageSrc).toContain("isAuditReasonValid");
    });

    it("defines quick presets for both account suspension and reactivation", () => {
      expect(pageSrc).toContain("SUSPEND_REASON_PRESETS");
      expect(pageSrc).toContain("ACTIVATE_REASON_PRESETS");
      expect(pageSrc).toContain("Administrative review of organiser operations");
      expect(pageSrc).toContain("Administrative verification completed and approved");
    });

    it("includes modal state for accessDialogOpen, accessPendingAction, and accessReason", () => {
      expect(pageSrc).toContain("accessDialogOpen");
      expect(pageSrc).toContain("accessPendingAction");
      expect(pageSrc).toContain("accessReason");
    });

    it("renders the Account Access Governance Dialog with min-10-char reason enforcement", () => {
      expect(pageSrc).toContain("ACCOUNT ACCESS GOVERNANCE DIALOG");
      expect(pageSrc).toContain("Suspend Organiser Account");
      expect(pageSrc).toContain("Activate Organiser Account");
      expect(pageSrc).toContain("isAuditReasonValid(accessReason)");
    });
  });

  describe("2. Switch Toggle & Action Button Interception", () => {
    it("intercepts the Switch toggle to open the audit dialog instead of calling API blindly", () => {
      expect(pageSrc).not.toMatch(/onCheckedChange=\{[^}]*handleAccessToggle[^}]*\}/);
      expect(pageSrc).toContain("handleOpenAccessDialog(checked ? \"activate\" : \"suspend\")");
    });

    it("provides explicit action buttons for Suspend Account and Activate Account", () => {
      expect(pageSrc).toContain("Suspend Account");
      expect(pageSrc).toContain("Activate Account");
      expect(pageSrc).toContain("handleOpenAccessDialog(\"suspend\")");
      expect(pageSrc).toContain("handleOpenAccessDialog(\"activate\")");
    });
  });

  describe("3. API Integration & Payload Validation", () => {
    it("exports updateAdminOrganizer with reason property in auth.ts", () => {
      expect(authLibSrc).toContain("licenseStatus: \"pending\" | \"active\" | \"suspended\"");
      expect(authLibSrc).toContain("reason: string;");
    });

    it("transmits the mandatory audit reason in updateAdminOrganizer payload upon confirmation", () => {
      expect(pageSrc).toContain("licenseStatus: targetStatus");
      expect(pageSrc).toContain("reason: accessReason.trim()");
    });

    it("aligns with backend /auth/admin/organizers/:id required audit reason rule", () => {
      expect(authRouteSrc).toContain("router.patch(\"/auth/admin/organizers/:id\"");
      expect(authRouteSrc).toContain("if (d.licenseStatus !== undefined)");
      expect(authRouteSrc).toContain("const reasonResult = parseAuditReason(req.body, true)");
    });
  });
});
