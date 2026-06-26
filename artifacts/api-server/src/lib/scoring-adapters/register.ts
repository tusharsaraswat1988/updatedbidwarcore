import { registerBadmintonScoringAdapter } from "./badminton-scoring-adapter";
import { registerStatisticsAdapter } from "../scoring-platform/projections";
import { cricketStatisticsAdapter } from "./cricket-statistics-adapter";
import { badmintonStatisticsAdapter } from "./badminton-statistics-adapter";

/** Register sport adapters not bundled in @workspace/scoring-core. */
registerBadmintonScoringAdapter();
registerStatisticsAdapter(cricketStatisticsAdapter);
registerStatisticsAdapter(badmintonStatisticsAdapter);
