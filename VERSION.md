# 项目版本历史

---

## 📦 当前版本

**版本：** v1.2 (开发中)

**Commit:** `6ddfb8f`

**更新时间：** 2026-05-16

---

## 🏷️ 版本标签

| 版本 | Commit | 日期 | 说明 |
|------|--------|------|------|
| **v1.2** | `6ddfb8f` | 2026-05-16 | 切换到 Supabase 音频源（开发中） |
| **v1.1** | `5c79c3d` | - | 72 课完整版 + GitHub 音频 |
| **v1.0** | - | - | 初始版本 |

---

## 📋 v1.2 更新日志（开发中）

### ✅ 已完成

- [x] 精简课程列表（保留 NCE1 和 Think Level F）
- [x] 修复音频/LRC 路径拼接问题
- [x] 统一 Think-F 卡片格式与 NCE1 一致
- [x] 切换音频源为 Supabase
- [x] 支持多本书籍配置

### 🔄 进行中

- [ ] 上传音频文件到 Supabase Storage
- [ ] 验证 Supabase 音频加载

---

## 📋 v1.1 更新日志

### 新增功能

- ✅ 72 课完整版（NCE1 L1-L143）
- ✅ GitHub Pages 音频托管
- ✅ 音频源切换功能（GitHub/Supabase）
- ✅ LRC 时间戳校准

### 技术改进

- ✅ 移除 LRC -0.5s 偏移，实现精确同步
- ✅ 修正 Supabase bucket 名称
- ✅ 优化卡片显示逻辑

---

## 🔧 技术栈

| 项目 | 版本 |
|------|------|
| HTML | HTML5 |
| CSS | CSS3 |
| JavaScript | ES6+ |
| 部署 | GitHub Pages |
| 音频存储 | Supabase Storage |

---

## 🌐 访问地址

**生产环境：**
```
https://hank-hunau.github.io/ilabshadowing/
```

**GitHub 仓库：**
```
https://github.com/hank-HUNAU/ilabshadowing
```

---

## 📊 课程内容

| 书籍 | 课程数 | 状态 |
|------|--------|------|
| NCE1（新概念第一册） | 72 课 | ✅ |
| Think Level F | 1 课 | 🆕 |

---

## 🚀 部署流程

```bash
# 1. 修改代码
cd /workspace
git add -A
git commit -m "chore: update description"

# 2. 推送到 GitHub
git push origin master --force

# 3. 等待 GitHub Pages 更新（1-2 分钟）
# 4. 访问网站测试
```

---

## 📝 版本命名规则

采用语义化版本控制（Semantic Versioning）：

- **主版本号（Major）：** 不兼容的 API 修改
- **次版本号（Minor）：** 向下兼容的功能性新增
- **修订号（Patch））：** 向下兼容的问题修正

格式：`v{主版本}.{次版本}.{修订号}`

示例：`v1.2.0`

---

## 🔄 版本切换

### 查看当前版本
```bash
git describe --tags --always
```

### 切换到特定版本
```bash
git checkout v1.1
```

### 创建新版本标签
```bash
git tag -a v1.2.0 -m "Release version 1.2.0"
git push origin v1.2.0
```

---

*最后更新：2026-05-16*
