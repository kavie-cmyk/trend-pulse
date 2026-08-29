import LiveSignals from "./live-signals";
import WorkspaceConsole from "./workspace-console";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <LiveSignals />
    </main>
  );
}
