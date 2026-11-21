import { RETENTION_RULES } from "@packetpulse/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/primitives/Card";
import { periodText } from "../lib/data-rights-logic";

// "The page lists what is kept for legal reasons and for how long" (SCR-038). Read from the same
// table the cleanup job runs on. The periods are suggestions until counsel confirms them (OPEN-06).
export function RetentionPanel() {
  return (
    <Card id="retention" aria-labelledby="retention-title">
      <CardHeader>
        <CardTitle id="retention-title">How long we keep things</CardTitle>
        <CardDescription>Data is removed automatically when its time is up. The audit log is never edited.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Retention periods by kind of data</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-4 font-medium">Data</th>
                <th scope="col" className="py-2 font-medium">Kept for</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_RULES.map((r) => (
                <tr key={r.key} className="border-b border-border/60 align-top">
                  <th scope="row" className="py-2 pr-4 font-normal">{r.data}</th>
                  <td className="py-2">{periodText(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
