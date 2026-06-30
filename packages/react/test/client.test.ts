import { submitCase } from "../src/client";
import type { FeedbackCaseInput } from "@feedbackkit/core";

const input: FeedbackCaseInput = { message: "hei", page: "/x" };

it("posts JSON to the configured url", async () => {
  const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  await submitCase({ url: "/api/submit" }, input);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/submit");
  expect(opts?.method).toBe("POST");
  expect(JSON.parse(opts?.body as string)).toEqual(input);
  vi.unstubAllGlobals();
});

it("throws when the url responds non-ok", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 500 })));
  await expect(submitCase({ url: "/x" }, input)).rejects.toThrow();
  vi.unstubAllGlobals();
});

it("calls onCase with the input", async () => {
  const onCase = vi.fn(async () => {});
  await submitCase({ onCase }, input);
  expect(onCase).toHaveBeenCalledWith(input);
});
