import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Moduły „server-only” rzucają przy imporcie poza serwerem Next; w testach są zbędne.
vi.mock("server-only", () => ({}));
