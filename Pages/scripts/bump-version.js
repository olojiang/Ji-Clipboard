// 版本号自动增加脚本
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '..', 'package.json');
const versionFilePath = path.join(__dirname, '..', 'src', 'version.ts');

// 读取 package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// 解析当前版本号
const versionParts = packageJson.version.split('.');
let major = parseInt(versionParts[0]) || 0;
let minor = parseInt(versionParts[1]) || 0;
let patch = parseInt(versionParts[2]) || 0;

// 增加 patch 版本号
patch++;

// 如果 patch 超过 99，增加 minor
if (patch > 99) {
  patch = 0;
  minor++;
}

// 如果 minor 超过 99，增加 major
if (minor > 99) {
  minor = 0;
  major++;
}

// 生成新版本号
const newVersion = `${major}.${minor}.${patch}`;

// 更新 package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

// 生成 version.ts 文件
const versionTsContent = `// 自动生成的版本号文件
export const APP_VERSION = '${newVersion}'
export const BUILD_TIME = '${new Date().toISOString()}'
`;

fs.writeFileSync(versionFilePath, versionTsContent);

console.log(`✅ 版本号已更新: ${packageJson.version} → ${newVersion}`);
console.log(`📦 Build Time: ${new Date().toLocaleString()}`);