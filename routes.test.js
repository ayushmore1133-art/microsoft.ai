import request from "supertest";
import { app } from "../server.js";

describe("GET /api/demo-data", () => {
  test("returns a seeded candidate with resume and transcript text", async () => {
    const res = await request(app).get("/api/demo-data");
    expect(res.status).toBe(200);
    expect(res.body.candidateName).toBeTruthy();
    expect(res.body.roleApplied).toBeTruthy();
    expect(typeof res.body.resumeText).toBe("string");
    expect(res.body.resumeText.length).toBeGreaterThan(0);
    expect(typeof res.body.transcriptText).toBe("string");
    expect(res.body.transcriptText.length).toBeGreaterThan(0);
  });
});

describe("POST /api/extract validation", () => {
  test("rejects a request missing resumeText/transcriptText before ever calling an LLM", async () => {
    const res = await request(app).post("/api/extract").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/resumeText and transcriptText/i);
  });

  test("rejects a request with only resumeText provided", async () => {
    const res = await request(app).post("/api/extract").send({ resumeText: "Some resume" });
    expect(res.status).toBe(400);
  });
});

describe("unknown routes", () => {
  test("falls back to serving the SPA index page for non-API routes", async () => {
    const res = await request(app).get("/some-nonexistent-page");
    expect(res.status).toBe(200);
    expect(res.text).toContain("InterviewIQ");
  });
});

describe("rate limiting", () => {
  test("/api routes carry standard rate-limit headers", async () => {
    const res = await request(app).get("/api/demo-data");
    expect(res.headers).toHaveProperty("ratelimit-limit");
  });
});
