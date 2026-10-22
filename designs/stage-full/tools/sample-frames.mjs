// 独立小样取帧：给 Work 的 materials/tests/<名>/ 这类单文件合成用（不经 Studio、不登记 Draft）。
// 按给定时刻 seek 主时间线截 PNG；每个时刻再经「0 → 片尾 → 该时刻」重 seek 一次比对像素；
// 报告页面错误、出画的文字和单帧 seek 耗时。帧只给执行者自己看，不作交付或审片证据。
//
//   node sample-frames.mjs <小样目录> <输出目录> --times 0,2.5,7 [--timeline main]
//        [--browser <chrome>] [--puppeteer <puppeteer-core 目录>]
//
// 浏览器默认取 HYPERFRAMES_BROWSER_PATH；puppeteer-core 默认从小样目录和本工具目录向上找
// runtime/npm/node_modules/puppeteer-core（部署包布局）。退出码：0 无错误；1 页面错误、
// 重 seek 不一致或参数/启动失败。出画文字只作提示。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

function fail(message) {
  console.error('error: ' + message);
  process.exit(1);
}

const argv = process.argv.slice(2);
const option = (name) => {
  const index = argv.indexOf(name);
  if (index < 0) return null;
  const value = argv[index + 1];
  if (value == null || value.startsWith('--')) fail(name + ' needs a value');
  argv.splice(index, 2);
  return value;
};
const timesText = option('--times');
const timelineId = option('--timeline');
const browserPath = option('--browser') || process.env.HYPERFRAMES_BROWSER_PATH;
const puppeteerOption = option('--puppeteer');
if (argv.length !== 2) fail('usage: node sample-frames.mjs <test dir> <out dir> --times a,b,c [--timeline id]');
const testDir = path.resolve(argv[0]);
const outDir = path.resolve(argv[1]);
const index = path.join(testDir, 'index.html');
if (!fs.existsSync(index)) fail('no index.html in ' + testDir);
const times = [...new Set((timesText || '').split(',').filter((item) => item.trim()).map(Number))].sort((a, b) => a - b);
if (!times.length || times.length > 60 || times.some((time) => !Number.isFinite(time) || time < 0)) {
  fail('--times needs 1..60 comma-separated non-negative seconds');
}
if (!browserPath || !fs.existsSync(browserPath)) fail('set --browser or HYPERFRAMES_BROWSER_PATH to an existing Chrome/Chromium');

function findPuppeteer() {
  if (puppeteerOption) return path.resolve(puppeteerOption);
  for (const start of [testDir, path.dirname(fileURLToPath(import.meta.url))]) {
    for (let dir = start; ; dir = path.dirname(dir)) {
      const candidate = path.join(dir, 'runtime/npm/node_modules/puppeteer-core');
      if (fs.existsSync(candidate)) return candidate;
      if (path.dirname(dir) === dir) break;
    }
  }
  return fail('puppeteer-core not found; pass --puppeteer <dir>');
}
const puppeteerDir = findPuppeteer();
const { default: puppeteer } = await import(pathToFileURL(path.join(puppeteerDir, 'lib/puppeteer/puppeteer-core.js')).href);

fs.mkdirSync(outDir, { recursive: true });
// 浏览器配置放系统临时目录：9p/网络盘上的 profile 会让 Chromium 启动即退出。
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stage-full-frames-'));
const report = { test: testDir, times, pageErrors: [], consoleErrors: [], failedRequests: [], frames: [], determinism: [] };
let browser;
let errors = 0;
try {
  browser = await puppeteer.launch({
    executablePath: browserPath, userDataDir: profile, headless: true,
    args: ['--disable-dev-shm-usage', '--allow-file-access-from-files', '--hide-scrollbars', '--no-first-run',
      ...(process.platform === 'linux' ? ['--no-sandbox'] : [])],
  });
  const page = await browser.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => report.failedRequests.push(request.url()));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(index).href, { waitUntil: 'load', timeout: 60000 });
  const size = await page.evaluate(() => {
    const root = document.querySelector('[data-width][data-height]');
    return root ? { width: +root.dataset.width, height: +root.dataset.height } : { width: 1920, height: 1080 };
  });
  await page.setViewport({ ...size, deviceScaleFactor: 1 });
  let id = null;
  for (let attempt = 0; attempt < 60 && !id; attempt += 1) {
    id = await page.evaluate((wanted) => {
      const timelines = window.__timelines || {};
      const root = document.querySelector('[data-composition-id]');
      const key = wanted || (root && timelines[root.dataset.compositionId] ? root.dataset.compositionId : Object.keys(timelines)[0]);
      return key && timelines[key] ? key : null;
    }, timelineId);
    if (!id) await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!id) throw new Error('no window.__timelines entry registered' + (timelineId ? ' for ' + timelineId : ''));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.decode().catch(() => null)));
  });
  const duration = await page.evaluate((key) => window.__timelines[key].duration(), id);
  report.timeline = id;
  report.duration = duration;
  const seek = (time) => page.evaluate(async (key, at) => {
    // suppressEvents=false：onUpdate 驱动的 WebGL/粒子背景也会按该时刻重画。
    window.__timelines[key].seek(at, false);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, id, time);
  const shot = () => page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...size } });
  const outside = () => page.evaluate(({ width, height }) => {
    const found = [];
    const visible = (node) => {
      for (let element = node; element; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility !== 'visible' || +style.opacity < 0.02) return false;
      }
      return true;
    };
    for (const element of document.querySelectorAll('body *')) {
      const own = [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
      if (!own || !visible(element)) continue;
      const box = element.getBoundingClientRect();
      if (box.width && box.height && (box.left < -1 || box.top < -1 || box.right > width + 1 || box.bottom > height + 1)) {
        found.push({ text: element.textContent.trim().slice(0, 24), box: [box.left, box.top, box.right, box.bottom].map(Math.round) });
      }
    }
    return found.slice(0, 10);
  }, size);
  const costs = [];
  for (const time of times) {
    if (time > duration + 1e-6) { report.frames.push({ time, skipped: 'after timeline end ' + duration }); continue; }
    const started = Date.now();
    await seek(time);
    costs.push(Date.now() - started);
    const file = 't' + time.toFixed(2).padStart(7, '0') + '.png';
    const bytes = Buffer.from(await shot());
    fs.writeFileSync(path.join(outDir, file), bytes);
    report.frames.push({ time, file, textOutside: await outside() });
  }
  for (const frame of report.frames.filter((item) => item.file)) {
    await seek(0);
    await seek(duration);
    await seek(frame.time);
    const again = Buffer.from(await shot());
    const identical = again.equals(fs.readFileSync(path.join(outDir, frame.file)));
    if (!identical) {
      fs.writeFileSync(path.join(outDir, frame.file.replace(/\.png$/, '-reseek.png')), again);
      errors += 1;
    }
    report.determinism.push({ time: frame.time, via: [0, duration], identical });
  }
  report.seekMs = costs.length ? { mean: Math.round(costs.reduce((a, b) => a + b, 0) / costs.length), max: Math.max(...costs) } : null;
  errors += report.pageErrors.length;
} catch (error) {
  report.fatal = String(error && error.message || error);
  errors += 1;
} finally {
  if (browser) await browser.close();
  fs.rmSync(profile, { recursive: true, force: true });
}
fs.writeFileSync(path.join(outDir, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
const hints = report.frames.filter((frame) => frame.textOutside && frame.textOutside.length).map((frame) => frame.time);
console.log(JSON.stringify({
  ok: errors === 0, frames: report.frames.filter((frame) => frame.file).length, outDir,
  determinism: report.determinism.every((item) => item.identical), pageErrors: report.pageErrors.length,
  textOutsideAt: hints, seekMs: report.seekMs, fatal: report.fatal,
}));
process.exitCode = errors ? 1 : 0;
