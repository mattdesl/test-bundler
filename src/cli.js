import { getLocalHosts, getPort } from "./util.js";
import { createServer } from "./server.js";
import { createBundler } from "./bundler.js";
import { createWatcher } from "./watcher.js";
import * as path from "node:path";
import * as process from "node:process";
import minimist from "minimist";

async function run(args) {
  const cwd = process.cwd();

  const argv = minimist(args, {
    boolean: ["watch", "bundle"],
    alias: {
      watch: "w",
    },
    default: {
      bundle: true,
      watch: true,
    },
  });

  const entryPoints = argv._;
  const packageFile = path.resolve(cwd, "package.json");
  const useWatch = argv.watch;
  let watcher, bundler, app;
  if (useWatch) {
    // in milliseconds
    const debounce = 0;
    let timeout;
    watcher = await createWatcher((err, changes) => {
      if (err) {
        console.warn("Error from file watcher:", err);
      }
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        // invalidate the bundler so that the next request will trigger
        // a fresh start
        if (bundler) bundler.invalidate();
        // trigger a reload event to any live connections
        if (app) app.reload();
      }, debounce);
    });

    // watch user package.json for changes
    watcher.watchFile(packageFile);
  }

  const useBundler = argv.bundle;
  if (useBundler) {
    bundler = await createBundler({
      buffer: argv["node-buffer"],
      process: argv["node-process"],
      entryPoints,
      applyDependencies: async (deps = []) => {
        if (watcher) {
          await watcher.applyFiles([packageFile, ...deps]);
        }
      },
    });
  }

  // use local host
  const host = undefined;
  const port = await getPort(9966, host);

  app = await createServer({
    serveDir: cwd,
    buildSrc: bundler ? bundler.src : false,
    middleware: bundler ? bundler.middleware : null,
  });

  await app.listen(port, host);

  const localhosts = getLocalHosts();
  const addresses = ["localhost", ...localhosts];
  console.log(
    `Server listening on:\n` +
      [...addresses].map((host) => `  http://${host}:${port}/`).join("\n")
  );
  console.log();

  // trigger a new build
  if (bundler) bundler.build();
}

await run(process.argv.slice(2));
