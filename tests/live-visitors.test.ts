import { describe, expect, it } from "vitest";
import { LIVE_VISITORS_WIDGET_SRC } from "../src/components/LiveVisitors";

describe("LiveVisitors widget", () => {
  it("requests light theme with Video Club styling on DataFast", () => {
    const url = new URL(LIVE_VISITORS_WIDGET_SRC);
    expect(url.pathname).toBe("/widgets/6a90233b9514c70c504828be/realtime");
    expect(url.searchParams.get("theme")).toBe("light");
    expect(url.searchParams.get("primaryColor")).toBe("#e78468");
    expect(url.searchParams.get("mainTextSize")).toBe("16");
  });
});
