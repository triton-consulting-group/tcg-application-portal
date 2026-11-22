import React from "react";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import Navbar from "./Navbar";

// Chakra v3 and react-router v7 can't load under this Jest setup (see App.test.js), so stand in for them.
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  Link: ({ children }) => children,
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: "/" })
}), { virtual: true });

jest.mock("@chakra-ui/react", () => {
  const React = require("react");
  const passthrough = (tag) =>
    React.forwardRef(({ children, as, to, onClick, id, src, alt, ...rest }, ref) =>
      React.createElement(
        as && typeof as !== "string" ? as : tag,
        { ref, to, onClick, id, src, alt, "aria-label": rest["aria-label"], "aria-expanded": rest["aria-expanded"], "aria-controls": rest["aria-controls"], disabled: rest.disabled },
        children
      )
    );
  return { Flex: passthrough("div"), Box: passthrough("div"), Link: passthrough("a"), Button: passthrough("button"), Image: passthrough("img") };
});

let mockAuthCallback;
jest.mock("firebase/auth", () => ({
  onAuthStateChanged: (_auth, cb) => {
    mockAuthCallback = cb;
    return () => {};
  },
  signInWithPopup: jest.fn(),
  signOut: async () => {}
}));
jest.mock("../../Pages/Home/firebaseConfig", () => ({ auth: {}, provider: {}, getSignInErrorMessage: () => "" }));
jest.mock("axios", () => ({
  post: async () => ({}),
  get: async () => ({ data: { role: "associate" } })
}));

const renderNavbar = () => render(<Navbar />);

const signIn = async () => {
  await act(async () => {
    await mockAuthCallback({ email: "member@ucsd.edu", displayName: "Member", getIdToken: async () => "t" });
  });
};

test("the menu button opens and closes the mobile menu", () => {
  renderNavbar();
  expect(document.getElementById("mobile-nav-menu")).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = document.getElementById("mobile-nav-menu");
  expect(menu).not.toBeNull();
  expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");

  fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
  expect(document.getElementById("mobile-nav-menu")).toBeNull();
});

test("signed out, the mobile menu shows View My Application and Sign in", () => {
  renderNavbar();
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = within(document.getElementById("mobile-nav-menu"));
  expect(menu.getByText("View My Application")).toBeInTheDocument();
  expect(menu.getByText("Sign in")).toBeInTheDocument();
  expect(menu.queryByText("Logout")).toBeNull();
  expect(menu.queryByText("Associate View")).toBeNull();
});

test("signed in as an associate, the mobile menu shows Associate View and Logout", async () => {
  renderNavbar();
  await signIn();
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  const menu = within(document.getElementById("mobile-nav-menu"));
  expect(menu.getByText("Associate View")).toBeInTheDocument();
  expect(menu.getByText("Logout")).toBeInTheDocument();
  expect(menu.queryByText("Sign in")).toBeNull();
});

test("picking an action closes the mobile menu", async () => {
  renderNavbar();
  await signIn();
  fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
  await act(async () => {
    fireEvent.click(within(document.getElementById("mobile-nav-menu")).getByText("Logout"));
  });
  expect(document.getElementById("mobile-nav-menu")).toBeNull();
});
