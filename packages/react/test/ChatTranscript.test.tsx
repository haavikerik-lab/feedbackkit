import { render, screen } from "@testing-library/react";
import { ChatTranscript } from "../src/components/ChatTranscript";

it("returns nothing when the transcript is empty", () => {
  const { container } = render(<ChatTranscript transcript={[]} />);
  expect(container.firstChild).toBeNull();
});

it("renders one bubble per message inside a log region", () => {
  render(
    <ChatTranscript
      transcript={[
        { role: "user", content: "for mye tekst" },
        { role: "assistant", content: "Hvilken side var du på?" },
      ]}
    />,
  );
  expect(screen.getByRole("log", { name: "AI-samtale" })).toBeTruthy();
  expect(screen.getByText("for mye tekst")).toBeTruthy();
  expect(screen.getByText("Hvilken side var du på?")).toBeTruthy();
});
