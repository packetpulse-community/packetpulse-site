import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Alert } from "./Alert";
import { Button } from "./Button";
import { StatusChip, VerificationChip, VERIFICATION_LABELS, type VerificationLabel } from "./StatusChip";

describe("StatusChip", () => {
  it.each(["success", "warning", "danger", "information", "neutral"] as const)(
    "%s chip always has visible text and a hidden glyph",
    (tone) => {
      const html = renderToStaticMarkup(<StatusChip tone={tone}>Label here</StatusChip>);
      expect(html).toContain("Label here");
      expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
    },
  );

  it("verification chips show their own wording and a glyph for all labels", () => {
    for (const key of Object.keys(VERIFICATION_LABELS) as VerificationLabel[]) {
      const html = renderToStaticMarkup(<VerificationChip label={key} />);
      expect(html).toContain(VERIFICATION_LABELS[key].text);
      expect(html).toContain("<svg");
    }
    expect(Object.keys(VERIFICATION_LABELS)).toHaveLength(7);
  });
});

describe("Button", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderEl = (props: any) => (Button as any).render(props, null);

  it("loading keeps the label, marks busy and swallows repeat clicks", () => {
    const onClick = vi.fn();
    const el = renderEl({ variant: "grove-primary", loading: true, onClick, children: "Save" });
    expect(el.props["aria-busy"]).toBe(true);
    expect(el.props["aria-disabled"]).toBe(true);
    const preventDefault = vi.fn();
    el.props.onClick({ preventDefault });
    expect(onClick).not.toHaveBeenCalled();
    expect(preventDefault).toHaveBeenCalled();
    const html = renderToStaticMarkup(<Button variant="grove-primary" loading>Save</Button>);
    expect(html).toContain("Save");
    expect(html).toContain("<svg");
  });

  it("not loading passes clicks through and adds no aria-busy", () => {
    const onClick = vi.fn();
    const el = renderEl({ onClick, children: "Go" });
    expect(el.props.onClick).toBe(onClick);
    expect(el.props["aria-busy"]).toBeUndefined();
  });

  it("pre-Grove variants resolve to the theme tokens", () => {
    const html = renderToStaticMarkup(<Button variant="gradient">x</Button>);
    expect(html).toContain("bg-primary");
    expect(html).not.toContain("indigo");
  });

  it("grove variants set the 40px / 44px touch minimum height", () => {
    const html = renderToStaticMarkup(<Button variant="grove-lime">x</Button>);
    expect(html).toContain("min-h-10");
    expect(html).toContain("min-h-11");
  });
});

describe("Alert", () => {
  it("danger uses the alert role; other grove alerts use status; legacy variants keep alert", () => {
    expect(renderToStaticMarkup(<Alert variant="grove-danger">x</Alert>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Alert variant="grove-success">x</Alert>)).toContain('role="status"');
    expect(renderToStaticMarkup(<Alert variant="error">x</Alert>)).toContain('role="alert"');
    expect(renderToStaticMarkup(<Alert>x</Alert>)).toContain('role="alert"');
  });
});
