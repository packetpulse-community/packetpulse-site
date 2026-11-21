// @vitest-environment jsdom
// Component-level axe-core scan of the shared primitives (TASK-050, TEST-A11Y). Runs in the normal
// `pnpm --filter @packetpulse/web test`, so an accessibility regression in a primitive fails CI.
import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./Accordion";
import { Alert, AlertDescription, AlertTitle } from "./Alert";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./Card";
import { DataTable } from "./DataTable";
import { Dialog } from "./Dialog";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Select } from "./Select";
import { SkeletonScreen } from "./Skeleton";
import { StatusChip, VerificationChip } from "./StatusChip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./Table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./Tooltip";
import { expectNoViolations, render, type Rendered } from "@/test/axe";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

let mounted: Rendered | undefined;
afterEach(() => {
  mounted?.unmount();
  mounted = undefined;
  document.body.innerHTML = "";
});

async function check(ui: React.ReactElement) {
  mounted = await render(ui);
  await expectNoViolations(document.body);
}

describe("primitives have no axe violations", () => {
  it("Button variants, sizes, loading and disabled", async () => {
    await check(
      <main>
        <h1>Buttons</h1>
        <Button variant="grove-primary">Save</Button>
        <Button variant="grove-lime" size="sm">Small</Button>
        <Button variant="outline" loading>Loading</Button>
        <Button variant="glass" disabled>Disabled</Button>
        <Button aria-label="Close" size="icon" variant="ghost">×</Button>
      </main>,
    );
  });

  it("Alert, Badge and StatusChip", async () => {
    await check(
      <main>
        <h1>Feedback</h1>
        <Alert variant="error"><AlertTitle>Something failed</AlertTitle><AlertDescription>Try again.</AlertDescription></Alert>
        <Alert variant="success" dismissible onDismiss={() => {}}><AlertTitle>Saved</AlertTitle></Alert>
        <Badge>New</Badge>
        <StatusChip tone="success">Active</StatusChip>
        <StatusChip tone="danger">Failed</StatusChip>
        <VerificationChip label="pending" />
      </main>,
    );
  });

  it("Card, EmptyState, ErrorState, SkeletonScreen", async () => {
    await check(
      <main>
        <h1>Cards</h1>
        <h2>Section</h2>
        <Card><CardHeader><CardTitle>Title</CardTitle><CardDescription>Description</CardDescription></CardHeader><CardContent>Body</CardContent></Card>
        <EmptyState title="Nothing here" description="Add your first item." action={{ label: "Add item", href: "/add" }} />
        <ErrorState title="Could not load" description="Check your connection." retry={{ label: "Try again", onClick: () => {} }} />
        <SkeletonScreen label="Loading items"><div /></SkeletonScreen>
      </main>,
    );
  });

  it("Table and DataTable (search, sort, pagination)", async () => {
    await check(
      <main>
        <h1>Tables</h1>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
          <TableBody><TableRow><TableCell>Asha</TableCell><TableCell>Member</TableCell></TableRow></TableBody>
        </Table>
        <DataTable
          columns={[
            { field: "name", header: "Name", sortable: true },
            { field: "role", header: "Role" },
          ]}
          data={[{ name: "Asha", role: "Member" }, { name: "Ravi", role: "Admin" }]}
        />
      </main>,
    );
  });

  it("Select closed and open", async () => {
    const options = [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }];
    mounted = await render(<main><h1>Select</h1><Select value="a" options={options} onChange={() => {}} /></main>);
    await expectNoViolations(document.body);
    const trigger = document.querySelector("button")!;
    await act(async () => trigger.click());
    await expectNoViolations(document.body);
  });

  it("Accordion open and closed", async () => {
    await check(
      <main>
        <h1>FAQ</h1>
        <h2>Questions</h2>
        <Accordion type="single" collapsible defaultValue="a">
          <AccordionItem value="a"><AccordionTrigger>First</AccordionTrigger><AccordionContent>One</AccordionContent></AccordionItem>
          <AccordionItem value="b"><AccordionTrigger>Second</AccordionTrigger><AccordionContent>Two</AccordionContent></AccordionItem>
        </Accordion>
      </main>,
    );
  });

  it("Tooltip trigger", async () => {
    await check(
      <main>
        <h1>Tips</h1>
        <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button">Help</button></TooltipTrigger><TooltipContent>More info</TooltipContent></Tooltip></TooltipProvider>
      </main>,
    );
  });
});

describe("Dialog", () => {
  it("open dialog is labelled, modal and has no violations", async () => {
    mounted = await render(
      <main>
        <h1>Page</h1>
        <button type="button">Open</button>
        <Dialog open onClose={() => {}} title="Delete item" description="This cannot be undone.">
          <button type="button">Confirm</button>
        </Dialog>
      </main>,
    );
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog!.getAttribute("aria-modal")).toBe("true");
    expect(dialog!.getAttribute("aria-labelledby")).toBeTruthy();
    await expectNoViolations(document.body);
  });

  it("moves focus into the dialog and Escape closes it", async () => {
    const onClose = vi.fn();
    mounted = await render(
      <Dialog open onClose={onClose} title="Edit" description="Change details.">
        <button type="button">Inside</button>
      </Dialog>,
    );
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});
