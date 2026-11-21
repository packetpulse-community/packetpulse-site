"use client";

import type { Trace } from "@packetpulse/netsim";

interface Props {
  trace: Trace;
  eventTimes: number[];
  time: number;
  deviceId: string | null;
}

type Tables = Record<"arp" | "mac" | "tcp" | "dns" | "route", Map<string, string>>;

function foldState(trace: Trace, eventTimes: number[], time: number, deviceId: string): Tables {
  const tables: Tables = { arp: new Map(), mac: new Map(), tcp: new Map(), dns: new Map(), route: new Map() };
  trace.events.forEach((e, i) => {
    if (e.kind !== "state" || e.device !== deviceId) return;
    if ((eventTimes[i] ?? 0) > time) return;
    if (e.op === "set") tables[e.table].set(e.key, e.value);
    else tables[e.table].delete(e.key);
  });
  return tables;
}

function Table({ title, caption, head, rows }: { title: string; caption: string; head: [string, string]; rows: [string, string][] }) {
  return (
    <section className="rounded-md border border-border bg-surface">
      <h4 className="px-3 pt-2 text-sm font-semibold">{title}</h4>
      <p className="px-3 pb-1 text-xs text-text-secondary">{caption}</p>
      <table className="w-full text-left font-mono text-xs">
        <thead className="text-text-secondary">
          <tr>
            <th scope="col" className="px-3 py-1 font-medium">{head[0]}</th>
            <th scope="col" className="px-3 py-1 font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={2} className="px-3 py-2 font-sans text-text-secondary">Empty so far</td></tr>
          ) : (
            rows.map(([k, v]) => (
              <tr key={k} className="border-t border-border">
                <td className="px-3 py-1">{k}</td>
                <td className="px-3 py-1">{v}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

export function DeviceInspector({ trace, eventTimes, time, deviceId }: Props) {
  const device = trace.devices.find((d) => d.id === deviceId);
  if (!device) {
    return <p className="text-sm text-muted-foreground">Click a device in the diagram to look inside it: its addresses, tables and connections at this moment of the run.</p>;
  }
  const t = foldState(trace, eventTimes, time, device.id);
  const list = (m: Map<string, string>) => [...m.entries()] as [string, string][];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-base font-semibold">{device.name}</h3>
        <p className="text-xs text-text-secondary">
          {device.kind === "host" ? "A host: it can start and end conversations." : device.kind === "switch" ? "A layer 2 switch: it forwards frames by MAC address." : "A router: it forwards packets between networks by IP address."}
        </p>
      </div>
      <section className="rounded-md border border-border bg-surface">
        <h4 className="px-3 pt-2 text-sm font-semibold">Interfaces</h4>
        <table className="w-full text-left font-mono text-xs">
          <thead className="text-text-secondary">
            <tr>
              <th scope="col" className="px-3 py-1 font-medium">Port</th>
              <th scope="col" className="px-3 py-1 font-medium">MAC</th>
              <th scope="col" className="px-3 py-1 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {device.ifaces.map((i) => (
              <tr key={i.name} className="border-t border-border">
                <td className="px-3 py-1">{i.name}</td>
                <td className="px-3 py-1">{i.mac}</td>
                <td className="px-3 py-1">{i.ip ? `${i.ip}/${i.prefix}` : "none (layer 2 only)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {device.gateway && <p className="px-3 py-2 font-mono text-xs text-text-secondary">Default gateway: {device.gateway}{device.dnsServer ? ` · DNS server: ${device.dnsServer}` : ""}</p>}
      </section>
      {device.kind !== "switch" && <Table title="ARP cache" caption="IP address to MAC address, learned with ARP" head={["IP address", "MAC address"]} rows={list(t.arp)} />}
      {device.kind === "switch" && <Table title="MAC address table" caption="Which port each MAC address was last seen on, learned from source addresses" head={["MAC address", "Port"]} rows={list(t.mac)} />}
      {device.kind === "router" && <Table title="Routing table" caption="The most specific matching network wins (longest prefix match)" head={["Network", "Next hop"]} rows={list(t.route)} />}
      {device.kind === "host" && <Table title="TCP connections" caption="Sockets and their state in the TCP state machine" head={["Connection", "State"]} rows={list(t.tcp)} />}
      {device.kind === "host" && <Table title="DNS cache" caption="Names this host has already resolved" head={["Name", "Address"]} rows={list(t.dns)} />}
    </div>
  );
}
