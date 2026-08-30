import WorkspaceConsole from "./workspace-console";
import WorkspaceIntelligence04F from "./workspace-intelligence-04f";
import PaidCreativeStage04G from "./paid-creative-stage-04g";
import BrandFitStage05B from "./brand-fit-stage-05b";

export default function Home() {
  return (
    <main className="shell">
      <WorkspaceConsole />
      <WorkspaceIntelligence04F />
      <PaidCreativeStage04G />
      <BrandFitStage05B />
    </main>
  );
}
