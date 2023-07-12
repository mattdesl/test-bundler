import { App } from "@tinyhttp/app";
import sirv from "sirv";
import * as path from "path";
import { parse as parseUrl } from "url";
import { readFile } from "fs/promises";
import * as http from "http";
import { LIVE_RELOAD_API, LIVE_RELOAD_SRC } from "./config.js";
import { WebSocket } from "ws";
import { moduleDirname, tinyws } from "./util.js";

const __dirname = moduleDirname(import.meta);

export async function createServer(opts = {}) {
  const {
    serveDir = process.cwd(),
    buildSrc,
    middleware,
    title = "canvas-sketch",
  } = opts;
  const scriptSources = [LIVE_RELOAD_SRC, buildSrc].filter(Boolean);
  const entryScripts = scriptSources
    .map((src) => {
      return `<script src=${JSON.stringify(src)} type="module"></script>`;
    })
    .join("\n");

  const html = (
    await readFile(path.resolve(__dirname, "templates/index.html"), "utf8")
  )
    .replace("{{entryPoints}}", entryScripts)
    .replace("{{title}}", title);

  const clients = new Set();
  const app = new App({
    onError: (err, req, res) => {
      res
        .status(500)
        .type("html")
        .end(
          `<body style="font-family: monospace; padding: 20px; font-size: 14px; color: #e31919;"><pre>Server responded with error code 500\n${
            err.stack || err.message
          }</pre></body>`
        );
    },
    noMatchHandler: (req, res) => {
      const { url } = req;
      res
        .status(404)
        .type("html")
        .end(
          `<body style="font-family: monospace; padding: 20px; font-size: 14px; color: #e31919;">404 resource not found: ${url}</body>`
        );
    },
  });
  app.use(tinyws());
  app.use(LIVE_RELOAD_API, async (req, res) => {
    if (req.ws) {
      const socket = await req.ws();
      clients.add(socket);
      // console.log("[canvas-sketch-cli] connected");
      socket.send(JSON.stringify({ event: "connect" }));
      socket.onmessage = (m) => {
        socket.send(m.data);
      };
      socket.on("close", () => {
        // console.log("[canvas-sketch-cli] closed");
        clients.delete(socket);
      });
    } else {
      res.send(
        `${LIVE_RELOAD_API} should be accessed from websocket request, not HTTP`
      );
    }
  });
  app.use(LIVE_RELOAD_SRC, async (req, res) => {
    const text = await readFile(
      path.resolve(__dirname, "templates/livereload.js")
    );
    res.status(200).type("js").send(text);
  });
  if (middleware) {
    app.use(middleware);
  }
  app.use("/", (req, res, next) => {
    const host = req.headers.host;
    const protocol = req.connection.encrypted ? "https" : "http";
    const urlObj = new URL(req.url, `${protocol}://${host}`);
    const pathname = (urlObj.pathname || "").toLowerCase();

    if (/^\/(index.html?)?$/i.test(pathname)) {
      res.status(200).send(html);
    } else {
      next(null);
    }
  });
  app.use(
    sirv(serveDir, {
      dev: true,
    })
  );

  return {
    reload() {
      clients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: "reload" }));
        }
      });
    },
    close() {
      clients.forEach((socket) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(1000);
        }
      });
    },
    listen(port = 3000, host = undefined) {
      return new Promise((resolve, reject) => {
        const noop = () => {};
        try {
          const server = http
            .createServer()
            .on("request", app.attach)
            .once("error", (err) => {
              reject(err);
              reject = resolve = noop;
            })
            .listen(port, host, () => {
              resolve(server);
              reject = resolve = noop;
            });
        } catch (err) {
          reject(err);
        }
      });
    },
  };
}
