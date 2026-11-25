import type { Page } from "playwright";

/** tsx/esbuild keepNames inserts __name inside serialized browser callbacks.
 * Supply the helper in the callback's own lexical scope, without page globals.
 * Only trusted source callbacks and JSON data are accepted here.
 */
export function evaluateStockmanPage<A, R>(
  page: Page,
  callback: (arg: A) => R,
  arg?: A,
): Promise<Awaited<R>> {
  const data = arg === undefined ? "undefined" : JSON.stringify(arg);
  return page.evaluate(`(() => {
    const __name = (fn, name) => Object.defineProperty(fn, "name", { value: name, configurable: true });
    return (${callback.toString()})(${data});
  })()`);
}
