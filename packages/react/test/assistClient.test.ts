import { requestAssist, AssistError } from "../src/assistClient";
import type { AssistRequest } from "@feedbackkit/core";

const req: AssistRequest = { mode: "chat", messages: [{ role: "user", content: "hei" }] };

it("posts JSON to the url and returns the parsed result", async () => {
  const fetchMock = vi.fn<typeof fetch>(
    async () => new Response(JSON.stringify({ reply: "hallo", categories: ["bug"] }), { status: 200 }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const res = await requestAssist({ url: "/assist" }, req);
  expect(res).toEqual({ reply: "hallo", categories: ["bug"] });
  const [url, opts] = fetchMock.mock.calls[0];
  expect(url).toBe("/assist");
  expect(opts?.method).toBe("POST");
  expect(JSON.parse(opts?.body as string)).toEqual(req);
  vi.unstubAllGlobals();
});

it("throws AssistError with the http status on non-ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ error: "AI er ikke tilgjengelig." }), { status: 503 })),
  );
  const err = await requestAssist({ url: "/x" }, req).catch((e) => e);
  expect(err).toBeInstanceOf(AssistError);
  expect((err as AssistError).status).toBe(503);
  vi.unstubAllGlobals();
});

it("throws AssistError with status 0 when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("boom"); }));
  const err = await requestAssist({ url: "/x" }, req).catch((e) => e);
  expect(err).toBeInstanceOf(AssistError);
  expect((err as AssistError).status).toBe(0);
  vi.unstubAllGlobals();
});

it("calls onAssist and returns its result", async () => {
  const onAssist = vi.fn(async () => ({ draft: "utkast" }));
  const res = await requestAssist({ onAssist }, { mode: "draft", messages: [] });
  expect(onAssist).toHaveBeenCalledTimes(1);
  expect(res).toEqual({ draft: "utkast" });
});
