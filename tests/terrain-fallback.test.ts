import { it, expect, vi } from "vitest";
import { demCrop, fetchDemTile } from "../src/map/terrain";
it("selects the exact child quadrant from coarser DEM tiles", () => {
  expect(demCrop(9, 455, 206, 8)).toEqual({
    z: 8,
    x: 227,
    y: 103,
    crop: [128, 0, 128],
  });
  expect(demCrop(11, 1819, 825, 8)).toEqual({
    z: 8,
    x: 227,
    y: 103,
    crop: [96, 32, 32],
  });
});
it("uses high-resolution DEM whenever it exists", async () => {
  const f = vi.fn().mockResolvedValue(new Response("PNG"));
  const result = await fetchDemTile(
    9,
    455,
    206,
    new AbortController().signal,
    f,
  );
  expect(result.crop).toEqual([0, 0, 256]);
  expect(f).toHaveBeenCalledTimes(1);
});
it("uses a real coarse tile on coastal 404 without masking a network failure", async () => {
  const f = vi
    .fn()
    .mockResolvedValueOnce(new Response(null, { status: 404 }))
    .mockResolvedValueOnce(new Response("DEM"));
  const signal = new AbortController().signal;
  expect((await fetchDemTile(9, 455, 206, signal, f)).crop).toEqual([
    128, 0, 128,
  ]);
  expect(f.mock.calls[1][0]).toContain("/demgm_png/8/227/103.png");
  expect(f.mock.calls[1][1].signal).toBe(signal);
});
it("does not substitute missing data for 503 or connection errors", async () => {
  const f = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  await expect(
    fetchDemTile(9, 455, 206, new AbortController().signal, f),
  ).rejects.toThrow();
  expect(f).toHaveBeenCalledTimes(1);
});
it("tries coarser actual coverage and fails if all DEM levels are absent", async () => {
  const f = vi.fn().mockResolvedValue(new Response(null, { status: 404 }));
  await expect(
    fetchDemTile(9, 455, 206, new AbortController().signal, f),
  ).rejects.toThrow("提供範囲");
  expect(f).toHaveBeenCalledTimes(10);
});
