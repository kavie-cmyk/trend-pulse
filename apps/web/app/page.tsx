import BackboneSignals from "./backbone-signals";
import IntelligenceOutput from "./intelligence-output";
import LiveSignals from "./live-signals";
import SocialSignals from "./social-signals";
import SourceIntelligencePanel from "./source-intelligence-panel";
import WorkspaceConsole from "./workspace-console";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <SourceIntelligencePanel />
      <SocialSignals />
      <BackboneSignals />
      <LiveSignals />
      <IntelligenceOutput />
    </main>
  );
}
