import request from "supertest";
import express from "express";
import { z } from "zod";

import { validate } from "../../src/middlewares/validate";
import { errorHandler } from "../../src/middlewares/error-handler";

describe("validate middleware", () => {
  const buildApp = () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/test",
      validate({
        body: z.object({
          name: z.string().min(2),
          age: z.coerce.number().int().positive().max(120),
        }),
        query: z.object({
          sort: z.enum(["asc", "desc"]).optional(),
        }),
        params: z.object({}),
      }),
      (req, res) => {
        res.json({ success: true, body: req.body, query: req.query });
      }
    );
    app.use(errorHandler);
    return app;
  };

  it("accepts a valid request", async () => {
    const res = await request(buildApp())
      .post("/test?sort=asc")
      .send({ name: "Ravi", age: 30 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.body).toEqual({ name: "Ravi", age: 30 });
  });

  it("rejects an invalid body with a 422 and field details", async () => {
    const res = await request(buildApp()).post("/test").send({ name: "x", age: -5 });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toBeDefined();
  });

  it("rejects an invalid query value", async () => {
    const res = await request(buildApp())
      .post("/test?sort=sideways")
      .send({ name: "Ravi", age: 30 });
    expect(res.status).toBe(422);
    expect(res.body.error.details["query.sort"]).toBeDefined();
  });
});
