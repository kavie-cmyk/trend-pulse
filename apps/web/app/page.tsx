import BackboneSignals from "./backbone-signals";
import IntelligenceOutput from "./intelligence-output";
import LiveSignals from "./live-signals";
import PermissionlessSocialSignals from "./permissionless-social-signals";
import SocialSignals from "./social-signals";
import SourceIntelligencePanel from "./source-intelligence-panel";
import TrendCandidates from "./trend-candidates";
import WorkspaceConsole from "./workspace-console";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <SourceIntelligencePanel />
      <SocialSignals />
      <PermissionlessSocialSignals />
      <BackboneSignals />
      <LiveSignals />
      <TrendCandidates />
      <IntelligenceOutput />
    </main>
  );
}
