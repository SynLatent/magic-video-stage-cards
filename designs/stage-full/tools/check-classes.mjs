import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const skipped = new Set(['runtime', 'vendor', 'node_modules', '.runtime']);

function collectFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && !skipped.has(entry.name)) collectFiles(file, files);
    else if (entry.isFile() && /\.(html|js|css)$/.test(entry.name)) files.push(file);
  }
  return files;
}

function usedClasses(text) {
  const classes = new Set();
  const add = (value) => {
    for (const name of value.split(/\s+/)) if (name) classes.add(name);
  };
  const patterns = [
    /\bclassName\s*(?:=|:)\s*(["'])(.*?)\1/gs,
    /\b(?:el|make|create\w*|node)\s*\(\s*["'][a-zA-Z-]+["']\s*,\s*(["'])([^"']+)\1/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) add(match[2]);
  }
  // 只提取直接传入的字面量，不执行变量或拼接表达式。
  for (const call of text.matchAll(/\bclassList\s*\.\s*add\s*\(((?:[^()"']|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')*)\)/g)) {
    for (const match of call[1].matchAll(/(?:^|,)\s*(["'])(.*?)\1/gs)) add(match[2]);
  }
  return classes;
}

function hiddenContainers(text) {
  const classes = new Set();
  const css = text.replace(/\/\*[\s\S]*?\*\//g, '');
  // 同时识别 CSS 文件与 rig 中按行保存的 CSS 字符串。
  for (const rule of css.matchAll(/(?:^|(?<=[{}"'`]))\s*\.([a-zA-Z_][\w-]*)\s*\{([^{}]*)\}/g)) {
    if (/(?:^|;)\s*visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(rule[2])) classes.add(rule[1]);
  }
  return classes;
}

function main() {
  const args = process.argv.slice(2);
  if (![1, 3].includes(args.length) || !args[0] || args[0].startsWith('--') || (args.length === 3 && args[1] !== '--rig')) {
    console.error('用法：node check-classes.mjs <工程目录> [--rig <stage-rig.js 路径>]');
    return 1;
  }
  const root = path.resolve(args[0]);
  const files = collectFiles(root);
  const definitions = files.filter((file) => file.endsWith('.css'));
  const rig = path.resolve(args[2] || path.join(root, 'runtime', 'stage-rig.js'));
  if (args[2] || fs.existsSync(rig)) definitions.push(rig);

  const defined = new Set();
  const notices = [];
  for (const file of definitions) {
    const text = fs.readFileSync(file, 'utf8');
    for (const match of text.matchAll(/\.([a-zA-Z_][\w-]*)/g)) defined.add(match[1]);
    for (const name of [...hiddenContainers(text)].sort()) {
      notices.push(`提示：${path.relative(root, file)}: .${name} 设置了 visibility:hidden；子节点需显式写回 visible`);
    }
  }

  // JS 字符串中的选择器也覆盖仅用于动画或查询的结构类。
  for (const file of files.filter((file) => file.endsWith('.js'))) {
    const text = fs.readFileSync(file, 'utf8');
    for (const literal of text.matchAll(/(["'`])(?:\\.|(?!\1)[^\\])*\1/gs)) {
      for (const match of literal[0].matchAll(/\.([a-zA-Z_][\w-]*)/g)) defined.add(match[1]);
    }
  }

  const allUsed = new Set();
  let missing = false;
  for (const file of files.filter((file) => /\.(html|js)$/.test(file))) {
    const text = fs.readFileSync(file, 'utf8');
    const used = usedClasses(text);
    if (file.endsWith('.html')) {
      const staticClasses = new Set();
      // 内联脚本仍按 JS 创建类名检查，不把脚本文本当静态标记。
      const markup = text.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '');
      for (const match of markup.matchAll(/\bclass\s*=\s*(["'])(.*?)\1/gs)) {
        for (const name of match[2].split(/\s+/)) if (name) staticClasses.add(name);
      }
      for (const name of staticClasses) if (defined.has(name)) allUsed.add(name);
      const uncoveredStatic = [...staticClasses].filter((name) => !defined.has(name)).sort();
      if (uncoveredStatic.length) {
        notices.push(`提示：${path.relative(root, file)}: 静态类名缺少 CSS 规则或 JS 选择器：${uncoveredStatic.join(', ')}`);
      }
    }
    for (const name of used) if (defined.has(name)) allUsed.add(name);
    const uncovered = [...used].filter((name) => !defined.has(name)).sort();
    if (uncovered.length) {
      console.log(`${path.relative(root, file)}: 缺少 CSS 规则或 JS 选择器：${uncovered.join(', ')}`);
      missing = true;
    }
  }
  if (!missing) console.log(`ok: ${allUsed.size} classes covered`);
  for (const notice of notices) console.log(notice);
  return missing ? 1 : 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`检查失败：${error.message}`);
  process.exitCode = 1;
}
