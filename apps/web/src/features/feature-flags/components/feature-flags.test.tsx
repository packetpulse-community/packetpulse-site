import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { FeatureOffState } from "./FeatureOffState";
import { FeatureSwitch } from "./FeatureSwitch";

describe("FeatureOffState", () => {
  it("is a friendly status, not an error: names the feature, blames no one, offers a way back", () => {
    const html = renderToStaticMarkup(<FeatureOffState feature="Forum posting" stillWorks="You can still read every thread." backHref="/forums" backLabel="Back to forums" />);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).toContain("Forum posting is switched off for now");
    expect(html).toContain("Nothing is wrong with your account");
    expect(html).toContain("You can still read every thread.");
    expect(html).toContain('href="/forums"');
    expect(html).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});

describe("FeatureSwitch", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = (props: any) => (FeatureSwitch as any)(props);

  it("is a labelled switch whose aria-checked follows the value", () => {
    const on = renderToStaticMarkup(<FeatureSwitch labelledBy="t" describedBy="d" checked onChange={() => undefined} />);
    expect(on).toContain('role="switch"');
    expect(on).toContain('aria-checked="true"');
    expect(on).toContain('aria-labelledby="t"');
    expect(on).toContain('aria-describedby="d"');
    expect(renderToStaticMarkup(<FeatureSwitch labelledBy="t" checked={false} onChange={() => undefined} />)).toContain('aria-checked="false"');
  });

  it("asks for the opposite value when pressed", () => {
    const onChange = vi.fn();
    el({ labelledBy: "t", checked: true, onChange }).props.onClick();
    expect(onChange).toHaveBeenCalledWith(false);
  });
});
