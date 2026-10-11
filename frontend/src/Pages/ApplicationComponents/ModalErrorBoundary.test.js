import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ModalErrorBoundary from "./ModalErrorBoundary";

const Boom = () => {
  throw new Error("boom");
};

test("a crash inside shows a message and a Close button instead of blanking the page", () => {
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  const onClose = jest.fn();
  render(
    <div>
      <p>Rest of the page</p>
      <ModalErrorBoundary onClose={onClose}>
        <Boom />
      </ModalErrorBoundary>
    </div>
  );
  expect(screen.getByText("Something went wrong in this window")).toBeInTheDocument();
  expect(screen.getByText("Rest of the page")).toBeInTheDocument();
  fireEvent.click(screen.getByText("Close"));
  expect(onClose).toHaveBeenCalled();
  consoleError.mockRestore();
});

test("renders the window normally when nothing goes wrong", () => {
  render(
    <ModalErrorBoundary onClose={jest.fn()}>
      <p>Window content</p>
    </ModalErrorBoundary>
  );
  expect(screen.getByText("Window content")).toBeInTheDocument();
});
