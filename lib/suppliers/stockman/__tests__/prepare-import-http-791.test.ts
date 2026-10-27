import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

type AdminMode = "ACTIVE" | "READ_ONLY" | "NONE";

const requireFromProject = createRequire(
  resolve(process.cwd(), "package.json"),
);

const source = readFileSync(
  resolve(
    process.cwd(),
    "app/api/admin/suppliers/stockman/discovery/route.ts",
  ),
  "utf8",
);

const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

function makeRoute(adminMode: AdminMode) {
  const calls: string[] = [];
  const exportsObject: Record<string, unknown> = {};

  const forbidden = (name: string): never => {
    calls.push(name);
    throw new Error(`FORBIDDEN_EXTERNAL_ACCESS: ${name}`);
  };

  const prisma = new Proxy(
    {},
    {
      get(_target, property) {
        return forbidden(`prisma.${String(property)}`);
      },
    },
  );

  const stockmanClient = new Proxy(
    {},
    {
      get(_target, property) {
        return forbidden(`stockman.${String(property)}`);
      },
    },
  );

  const mockRequire = (name: string): unknown => {
    switch (name) {
      case "next/server":
        return {
          NextResponse: {
            json: (body: unknown, init?: ResponseInit) =>
              Response.json(body, init),
          },
        };

      case "zod":
        return requireFromProject("zod");

      case "@/lib/auth/admin-session":
        return {
          getCurrentAdmin: async () => {
            calls.push("auth");
            if (adminMode === "NONE") return null;
            return {
              status: "ACTIVE",
              role:
                adminMode === "READ_ONLY"
                  ? "READ_ONLY"
                  : "ADMIN",
            };
          },
        };

      case "@/lib/db/prisma":
        return { prisma };

      case "@/lib/suppliers/stockman/prepare-import-policy":
        return {
          stockmanImportPreparationEnabled: () => false,
        };

      case "@/lib/suppliers/stockman/client":
        return stockmanClient;

      default:
        if (name.startsWith("@/")) {
          return new Proxy(
            {},
            {
              get(_target, property) {
                return forbidden(
                  `dependency.${name}.${String(property)}`,
                );
              },
            },
          );
        }

        throw new Error(`Unexpected module: ${name}`);
    }
  };

  runInNewContext(
    compiled,
    {
      exports: exportsObject,
      require: mockRequire,
      Request,
      Response,
      URL,
      Date,
      Set,
      Promise,
      console: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    },
    { filename: "stockman-discovery-route-mocked.js" },
  );

  const post = exportsObject.POST;

  assert.equal(typeof post, "function");

  return {
    post: post as (request: Request) => Promise<Response>,
    calls,
  };
}

function requestFor(reference: string): Request {
  return new Request(
    "http://localhost/api/admin/suppliers/stockman/discovery",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "prepare_import",
        items: [
          {
            reference,
            designation: "Test isole sans acces fournisseur",
            sourceUrl: "https://example.com/stockman-test",
          },
        ],
      }),
    },
  );
}

test("prepare_import returns HTTP 409 without external access", async () => {
  const { post, calls } = makeRoute("ACTIVE");

  const response = await post(
    requestFor("PS12L29LI-ION100"),
  );

  assert.equal(response.status, 409);

  const body = await response.json();

  assert.equal(body.prepared, 0);
  assert.equal(body.errors.length, 1);
  assert.equal(
    body.errors[0].reference,
    "PS12L29LI-ION100",
  );

  assert.deepEqual(calls, ["auth"]);
});

test("prepare_import refuses multiple references without access", async () => {
  const { post, calls } = makeRoute("ACTIVE");

  const response = await post(
    new Request(
      "http://localhost/api/admin/suppliers/stockman/discovery",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "prepare_import",
          items: [
            {
              reference: "PS12L29LI-ION100",
              designation: "Avec levee initiale",
              sourceUrl: "https://example.com/a",
            },
            {
              reference: "PS12L29-ION100",
              designation: "Sans levee initiale",
              sourceUrl: "https://example.com/b",
            },
          ],
        }),
      },
    ),
  );

  assert.equal(response.status, 409);

  const body = await response.json();

  assert.equal(body.prepared, 0);
  assert.deepEqual(
    body.errors.map((item: { reference: string }) => item.reference),
    ["PS12L29LI-ION100", "PS12L29-ION100"],
  );

  assert.deepEqual(calls, ["auth"]);
});

test("READ_ONLY admin receives 403 without external access", async () => {
  const { post, calls } = makeRoute("READ_ONLY");

  const response = await post(
    requestFor("PS12L29LI-ION100"),
  );

  assert.equal(response.status, 403);
  assert.deepEqual(calls, ["auth"]);
});

test("unauthenticated request receives 401 without external access", async () => {
  const { post, calls } = makeRoute("NONE");

  const response = await post(
    requestFor("PS12L29LI-ION100"),
  );

  assert.equal(response.status, 401);
  assert.deepEqual(calls, ["auth"]);
});