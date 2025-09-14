import handler from "../pages/api/appointments";
import { createMocks } from "node-mocks-http";
describe("/api/appointments", () => {
    it("returns all appointments", async () => {
        const { req, res } = createMocks({ method: "GET" });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(200);
        const data = JSON.parse(res._getData());
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        // Check for required fields
        expect(data[0]).toHaveProperty("type");
        expect(data[0]).toHaveProperty("date");
        expect(data[0]).toHaveProperty("email");
        expect(data[0]).toHaveProperty("notes");
    });

    it("creates a new appointment", async () => {
        const { req, res } = createMocks({
            method: "POST",
            body: {
                type: "Consultation",
                date: "2025-09-20T10:00:00",
                email: "test@example.com",
                notes: "Test appointment",
            },
        });
        await handler(req, res);
        expect(res._getStatusCode()).toBe(201);
        const data = JSON.parse(res._getData());
        expect(data.type).toBe("Consultation");
        expect(data.email).toBe("test@example.com");
        expect(data.notes).toBe("Test appointment");
        expect(data.date).toBe("2025-09-20T10:00:00");
    });
});