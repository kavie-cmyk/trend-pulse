import WorkspaceConsole from "./workspace-console";
import WorkspaceIntelligence from "./workspace-intelligence";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <WorkspaceIntelligence />
    </main>
  );
}
