const express = require("express");
const next = require("next");
require("dotenv").config();

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  // Custom routes can go here

  server.all("*", (req: import("express").Request, res: import("express").Response) => {
    return handle(req, res);
  });

  server.listen(port, (err?: unknown) => {
    if (err) throw err;
    console.log(`> Server listening at http://localhost:${port} as ${dev ? "development" : "production"}`);
  });
});