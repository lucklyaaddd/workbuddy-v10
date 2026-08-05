// 生成 WorkBuddy PWA 图标
// 流程：裁掉主图底部水印 + 米黄底补齐 -> 双线性缩放至 4 个尺寸 -> 清理临时文件
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PNG } = require('C:/Users/会飞的小象/.workbuddy/binaries/node/workspace/node_modules/pngjs');

const ROOT = path.resolve('E:/mini-workbench');
const ICONS = path.join(ROOT, 'public', 'icons');

// ---------- 1. 选择像素小狗那张主图（构图更稳） ----------
const masterFile = fs
  .readdirSync(ICONS)
  .filter((f) => f.startsWith('A_minimalist_square_mobile_app_'))[0];
if (!masterFile) {
  console.error('找不到主图文件');
  process.exit(1);
}
const masterPath = path.join(ICONS, masterFile);
const master = PNG.sync.read(fs.readFileSync(masterPath));
console.log(`加载主图：${masterFile}  ${master.width}x${master.height}`);

// ---------- 2. 裁掉右下角 "AI生成 WORKBUDD>" 水印 ----------
// AI 生成的米黄底有细微纵向渐变，所以补底用"复制最后一行"策略延续渐变，杜绝接缝
const CROP_BOTTOM = 140;
const ROW_BYTES = master.width * 4;

const clean = new PNG({ width: master.width, height: master.height });
// 先把原图前 (1024 - 140) = 884 行整段拷贝
master.data.copy(
  clean.data,
  0,
  0,
  (master.height - CROP_BOTTOM) * ROW_BYTES
);
// 底部 140 行：用原图最后一行（y = cleanH - 1）逐行复制
const lastRowOffset = (master.height - CROP_BOTTOM - 1) * ROW_BYTES;
for (let y = master.height - CROP_BOTTOM; y < master.height; y++) {
  master.data.copy(clean.data, y * ROW_BYTES, lastRowOffset, lastRowOffset + ROW_BYTES);
}

// ---------- 3. 双线性缩放 ----------
function resize(src, dw, dh) {
  const sw = src.width;
  const sh = src.height;
  const dst = new PNG({ width: dw, height: dh });
  const xRatio = sw / dw;
  const yRatio = sh / dh;
  for (let y = 0; y < dh; y++) {
    const sy = y * yRatio;
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const fy = sy - y0;
    for (let x = 0; x < dw; x++) {
      const sx = x * xRatio;
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, sw - 1);
      const fx = sx - x0;
      const w00 = (1 - fx) * (1 - fy);
      const w01 = fx * (1 - fy);
      const w10 = (1 - fx) * fy;
      const w11 = fx * fy;
      const i00 = (y0 * sw + x0) * 4;
      const i01 = (y0 * sw + x1) * 4;
      const i10 = (y1 * sw + x0) * 4;
      const i11 = (y1 * sw + x1) * 4;
      const di = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        dst.data[di + c] = Math.round(
          src.data[i00 + c] * w00 +
            src.data[i01 + c] * w01 +
            src.data[i10 + c] * w10 +
            src.data[i11 + c] * w11
        );
      }
    }
  }
  return dst;
}

const SIZES = [144, 180, 192, 512];
for (const size of SIZES) {
  const out = path.join(ICONS, `icon-${size}.png`);
  fs.writeFileSync(out, PNG.sync.write(resize(clean, size, size)));
  const stat = fs.statSync(out);
  console.log(`✅ icon-${size}.png  ${size}x${size}  ${(stat.size / 1024).toFixed(1)} KB`);
}

// ---------- 4. 清理主图和中间文件，避免被打进 PWA 包 ----------
for (const f of fs.readdirSync(ICONS)) {
  if (f.startsWith('A_minimalist_') || f.startsWith('_master_')) {
    fs.unlinkSync(path.join(ICONS, f));
    console.log(`🗑  清理：${f}`);
  }
}

console.log('\n最终 public/icons/ 内容：');
for (const f of fs.readdirSync(ICONS).sort()) {
  const s = fs.statSync(path.join(ICONS, f));
  console.log(`  ${f}  ${(s.size / 1024).toFixed(1)} KB`);
}
