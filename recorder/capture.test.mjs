import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm, mkdtemp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { captureVideo } from "./capture-engine.mjs";
test("real FFmpeg engine enforces duration and finalizes a readable MP4 without a browser", async () => {
  const root = resolve(".local");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "capture-test-"));
  try {
    const states = [];
    const result = await captureVideo({
      input: ["-re", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15"],
      video: join(dir, "video.mp4"),
      maxSeconds: 2,
      stopPath: join(dir, "stop"),
      onState: async (s) => states.push(s.state),
    });
    assert.equal(result.state, "local_ready");
    assert.equal(result.reason, "time_limit");
    assert.ok(result.bytes > 0);
    assert.ok(states.includes("recording"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
test("explicit stop finalizes early and an early source EOF is not a complete match", async () => {
  const root = resolve(".local");
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, "capture-test-"));
  try {
    const stopPath = join(dir, "stop");
    const result = await captureVideo({
      input: ["-re", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=15"],
      video: join(dir, "video.mp4"),
      maxSeconds: 20,
      stopPath,
      onState: async (s) => {
        if (s.state === "recording") await writeFile(stopPath, "stop");
      },
    });
    assert.equal(result.state, "local_ready");
    assert.equal(result.reason, "player_stop");
    const partial = await captureVideo({
      input: [
        "-re",
        "-f",
        "lavfi",
        "-i",
        "testsrc=size=320x240:rate=15:duration=1",
      ],
      video: join(dir, "partial.mp4"),
      maxSeconds: 20,
      stopPath: join(dir, "no-stop"),
      onState: async () => {},
    });
    assert.equal(partial.state, "failed");
    assert.ok(partial.bytes > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
