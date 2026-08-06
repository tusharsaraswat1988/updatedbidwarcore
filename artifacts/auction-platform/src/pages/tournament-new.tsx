import { useLocation } from "wouter";
import { useCreateTournament } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  TournamentCreationWizard,
  type TournamentCreationPayload,
} from "@/components/tournament-creation/tournament-creation-wizard";

export default function NewTournament() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createTournament = useCreateTournament();

  async function submit(payload: TournamentCreationPayload) {
    try {
      const data = await createTournament.mutateAsync({
        data: payload as Parameters<typeof createTournament.mutateAsync>[0]["data"],
      });
      return {
        success: true as const,
        tournament: {
          id: data.id,
          name: data.name,
          auctionCode: (data as { auctionCode?: string | null }).auctionCode ?? null,
        },
      };
    } catch {
      return { success: false as const, error: "Failed to create tournament." };
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Button>

        <div className="rounded-2xl border border-border/60 bg-card/20 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
            Create Tournament
          </p>
          <TournamentCreationWizard
            mode="page"
            onCancel={() => setLocation("/")}
            submit={submit}
            onCreated={(tournament) => {
              toast({
                title: "Tournament created",
                description: `Code: ${tournament.auctionCode ?? "—"}`,
              });
              setLocation(`/tournament/${tournament.id}`);
            }}
          />
        </div>
      </div>
    </AppLayout>
  );
}
