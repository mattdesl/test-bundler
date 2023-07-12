# test-bundler

> ⚠️ This is not being maintained for general use. It is a proof of concept, and open source for remix/adaptation.

Testing a minimal-dependency server and bundling tool to eventually replace canvas-sketch-cli backend, using:

- esbuild — for bundling
- @parcel/watcher — for file watching
- @tinyhttp/app + sirv — for server architecture
- ws — for websockets
- minimist — for CLI arg parsing

Clone, `npm install` dependencies, then run:

```
npm run test

# or typescript version
npm run test:ts
```

Try changing the sketch.js or sketch.ts in `test/` folder while the browser is open.

## License

MIT, see [LICENSE.md](http://github.com/mattdesl/test-bundler/blob/master/LICENSE.md) for details.
