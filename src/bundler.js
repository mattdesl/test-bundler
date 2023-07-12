import * as esbuild from "esbuild";
import * as path from "node:path";
import { BUILD_SRC } from "./config.js";

export async function createBundler(opts = {}) {
  const { entryPoints = [], applyDependencies = () => {} } = opts;

  if (entryPoints.length > 1) {
    throw new Error("multiple entries not yet supported");
  }

  const src = BUILD_SRC;

  const ctx = await esbuild.context({
    entryPoints,
    sourcemap: "inline", // TODO: figure out external source maps here
    write: false,
    bundle: true,
    metafile: true,
    outfile: src,
    format: "esm",
    logLevel: "silent",
    treeShaking: false,
    minify: false,
  });

  let dirty = true;
  let cachedState = null;

  const build = () => {
    return ctx.rebuild();
  };

  const getBuildState = async () => {
    // trigger a new build if there is none yet, or if we are hitting the entry again
    if (!cachedState || dirty) {
      try {
        const result = await build();
        cachedState = result;
        dirty = false;
        const deps = Object.keys(result.metafile.inputs).filter(
          (d) => !/^https?\:\/\//i.test(d) && !/^(.+)\:(.+)$/.test(d)
        );
        await applyDependencies(deps);
      } catch (err) {
        if (err.errors) {
          const msg = esbuild.formatMessagesSync(err.errors, {
            kind: "error",
            color: true,
            terminalWidth: process.stdout.width,
          });
          console.error(msg.join("\n"));
        } else {
          console.error(err);
        }
        cachedState = { error: err };
      }
    }
    return cachedState;
  };

  return {
    src,
    invalidate() {
      dirty = true;
    },
    build() {
      this.invalidate();
      return getBuildState();
    },
    close() {
      ctx.dispose();
    },
    async middleware(req, res, next) {
      const host = req.headers.host;
      const protocol = req.connection.encrypted ? "https" : "http";
      const urlObj = new URL(req.url, `${protocol}://${host}`);
      const pathname = (urlObj.pathname || "").toLowerCase();

      const isEntry = pathname === src;
      const isSourceMap = pathname === `${src}.map`;

      if (isEntry || isSourceMap) {
        const ext = path.extname(pathname);

        // get the latest build state
        const state = await getBuildState();

        const entry = state.outputFiles
          ? state.outputFiles.find(
              (e) => path.extname(e.path).toLowerCase() === ext
            )
          : null;

        if (state.error) {
          if (isSourceMap) {
            // allow 404 on the source map
            next(null);
          } else {
            const text = state.error.toString();
            const error = {
              message: text,
              errors: state.error.errors,
            };
            const body = getErrorBody(error, text);
            res.status(200).type("js").send(body);
          }
        } else if (entry) {
          const type = isSourceMap ? "application/json" : "text/javascript";
          res.status(200).type(type).send(entry.text);
        } else {
          throw new Error("build error, no build result");
        }
      } else {
        next(null);
      }
    },
  };
}

function getErrorBody(error, text) {
  return `// canvas-sketch-cli: generated from build error
;(() => {
  const api = window[Symbol.for("canvas-sketch-cli")]
  console.error(${JSON.stringify(text)});
  if (api && api.showError) {
    api.showError(${JSON.stringify(error)});
  }
})();`;
}
