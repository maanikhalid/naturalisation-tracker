const { createServer } = require("http");
const next = require("next");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
      // Keep logs short; Plesk captures stdout.
      console.log(`Next.js server ready at http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js server", err);
    process.exit(1);
  });
