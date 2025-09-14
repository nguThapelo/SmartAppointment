import handler from "../pages/api/login";
import { createMocks } from "node-mocks-http";

describe("/api/login", () => {
  it("returns success for correct credentials", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { email: "user@example.com", password: "password123" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({
      success: true,
      message: "Login successful",
    });
  });

  it("returns error for wrong credentials", async () => {
    const { req, res } = createMocks({
      method: "POST",
      body: { email: "wrong@example.com", password: "wrongpass" },
    });
    await handler(req, res);
    expect(res._getStatusCode()).toBe(401);
    expect(JSON.parse(res._getData())).toEqual({
      success: false,
      message: "Invalid credentials",
    });
  });
});