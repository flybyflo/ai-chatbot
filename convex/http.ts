import { httpRouter } from "convex/server";
import { authComponent, createAuth, jwks } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

http.route({
  path: "/api/auth/jwks",
  method: "GET",
  handler: jwks,
});

export default http;
