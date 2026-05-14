# 音频源切换指南

## 🚨 GitHub 带宽超限警告

如果你收到 GitHub 的带宽超限邮件，或网站音频无法加载，请按以下步骤切换。

---

## ⚡ 快速切换（推荐）

### 方法 1：修改代码（2 分钟）

1. 打开文件：`/workspace/js/main.js`

2. 找到第 6 行：
   ```javascript
   const AUDIO_SOURCE = 'github';
   ```

3. 改为：
   ```javascript
   const AUDIO_SOURCE = 'supabase';
   ```

4. 保存并提交：
   ```bash
   cd /workspace
   git add -A
   git commit -m "chore: switch audio source to supabase"
   git push
   ```

5. 等待 2-3 分钟，刷新网站即可

---

### 方法 2：使用切换脚本（1 分钟）

运行命令：
```bash
# 切换到 Supabase
sed -i "s/AUDIO_SOURCE = 'github'/AUDIO_SOURCE = 'supabase'/g" /workspace/js/main.js

# 提交推送
cd /workspace && git add -A && git commit -m "chore: switch to supabase audio" && git push
```

---

## 📊 当前配置

| 配置项 | 当前值 | 说明 |
|--------|--------|------|
| `AUDIO_SOURCE` | `github` | 从 GitHub Pages 加载 |
| `AUDIO_SOURCE` | `supabase` | 从 Supabase Storage 加载 |

---

## 🔄 切换回 GitHub

如果 GitHub 带宽恢复，可以切回来：

```bash
# 切换到 GitHub
sed -i "s/AUDIO_SOURCE = 'supabase'/AUDIO_SOURCE = 'github'/g" /workspace/js/main.js

# 提交推送
cd /workspace && git add -A && git commit -m "chore: switch back to github audio" && git push
```

---

## 📈 监控 GitHub 带宽

访问：https://github.com/hank-HUNAU/ilabshadowing/settings/pages

查看 **Bandwidth** 使用量。

免费额度：**100GB/月**

---

## 🎯 速度对比

| 音频源 | 国内延迟 | 加载速度 | 费用 |
|--------|---------|---------|------|
| GitHub Pages | 100-200ms | 1-3 秒 | 免费（100GB/月） |
| Supabase Storage | 150-300ms | 2-5 秒 | 免费（有限额度） |

---

## 🆘 紧急联系

如果切换后仍有问题：
1. 检查浏览器控制台（F12）的错误信息
2. 确认 Supabase bucket 是公开访问
3. 测试单个音频 URL 是否可访问
