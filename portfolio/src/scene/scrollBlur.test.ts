// node --experimental-strip-types --no-warnings --test src/scene/scrollBlur.test.ts
// The hero brain is sharp at the top, softens with scroll, and sharpens again on the way back.
import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_BLUR, approach, blurFor, blurRange, filterFor } from "./scrollBlur.ts";

const VH = 900;
const range = blurRange(900, VH);

test("sharp at the top of the page, on every screen", () => {
  assert.equal(blurFor(0, range, MAX_BLUR.desktop), 0);
  assert.equal(blurFor(0, blurRange(1400, 844), MAX_BLUR.mobile), 0);
  assert.equal(filterFor(0), "none");
  assert.equal(filterFor(0.04), "none");
});

test("blur rises continuously with scroll, never jumps, and stops at the maximum", () => {
  let prev = 0;
  let biggestStep = 0;
  for (let y = 0; y <= 2 * VH; y += 10) {
    const b = blurFor(y, range, MAX_BLUR.desktop);
    assert.ok(b >= prev, `not monotonic at ${y}`);
    biggestStep = Math.max(biggestStep, b - prev);
    prev = b;
  }
  assert.equal(prev, MAX_BLUR.desktop);
  assert.ok(biggestStep < 0.2, `a 10px scroll changed the blur by ${biggestStep}px`);
  const quarter = blurFor(range / 4, range, MAX_BLUR.desktop);
  assert.ok(quarter > 0.5 && quarter < 2, `a quarter of the way is gentle (${quarter}px)`);
});

test("scrolling back up retraces the same values", () => {
  for (const y of [700, 450, 200, 0]) assert.equal(blurFor(y, range, 8), blurFor(y, range, 8));
  assert.ok(blurFor(200, range, 8) < blurFor(450, range, 8));
  assert.equal(blurFor(0, range, 8), 0);
});

test("phones top out lower than desktops", () => {
  assert.equal(blurFor(5000, blurRange(1600, 844), MAX_BLUR.mobile), 5);
  assert.ok(MAX_BLUR.mobile < MAX_BLUR.desktop);
});

test("the range stays between 0.6 and 1.2 viewports, whatever the hero measures", () => {
  assert.equal(blurRange(100, VH), 540);
  assert.equal(blurRange(5000, VH), 1080);
  assert.equal(blurRange(Number.NaN, VH), VH);
  assert.equal(blurRange(0, VH), VH);
});

test("easing from a restored scroll position starts at 0 and settles on the target", () => {
  let b = 0;
  const target = blurFor(range, range, 8);
  const seen: number[] = [];
  for (let i = 0; i < 200 && b !== target; i++) seen.push((b = approach(b, target, 16.7)));
  assert.equal(b, target);
  assert.ok(seen[0]! < 2, "the first frame is far from the maximum");
  for (let i = 1; i < seen.length; i++) assert.ok(seen[i]! >= seen[i - 1]!);
});

test("the easing takes the same time at 30, 60 and 120 frames a second", () => {
  const after = (fps: number, ms: number) => {
    let b = 0;
    for (let t = 0; t < ms; t += 1000 / fps) b = approach(b, 8, 1000 / fps);
    return b;
  };
  for (const fps of [30, 60, 120]) {
    assert.ok(Math.abs(after(fps, 220) - after(60, 220)) < 0.35, `${fps} fps`);
    assert.equal(after(fps, 1500), 8, `${fps} fps settles`);
  }
});
