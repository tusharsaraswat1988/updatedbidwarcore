import { FullscreenLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Link2Off } from "lucide-react";

/** Shown for deprecated `/tournament/:id/register` URLs (sequential ID — no longer supported). */
export default function PlayerRegisterLegacy() {
  return (
    <FullscreenLayout>
      <div className="min-h-[100dvh] bg-[#09090b] flex flex-col items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md border-border">
          <CardContent className="p-8 text-center space-y-3">
            <Link2Off className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-semibold">Registration link expired</h1>
            <p className="text-sm text-muted-foreground">
              This old link format is no longer supported. Ask your tournament organizer to share the
              updated registration link from the Players page.
            </p>
          </CardContent>
        </Card>
      </div>
    </FullscreenLayout>
  );
}
