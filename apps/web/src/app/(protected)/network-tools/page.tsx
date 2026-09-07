import { NetworkToolRunner } from "@/features/network-tools/components/NetworkToolRunner";

export default function NetworkToolsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-3xl font-semibold">Network Tools</h1>
        <p className="text-muted-foreground">Run diagnostics against any host in a safe, simulated sandbox.</p>
      </div>

      <NetworkToolRunner />
    </div>
  );
}
