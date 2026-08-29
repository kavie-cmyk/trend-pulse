import IntelligenceOutput from "./intelligence-output";
import LiveSignals from "./live-signals";
import WorkspaceConsole from "./workspace-console";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <LiveSignals />
      <IntelligenceOutput />
    </main>
  );
}
