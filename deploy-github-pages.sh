#!/bin/bash
# ========================================
# 公考工作台 - GitHub Pages 一键部署脚本
# ========================================
# 使用方法：
#   1. 在 GitHub 创建一个新仓库（如 gongkao-workbench），不要勾选 README
#   2. 在 GitHub Settings → Developer settings → Personal access tokens 生成 Token（勾选 repo 权限）
#   3. 运行此脚本：bash deploy-github-pages.sh
#   4. 按提示输入 GitHub 用户名、仓库名、Token
#   5. 等待部署完成，获得永久 HTTPS 链接
# ========================================

set -e

echo "============================================"
echo "  公考工作台 → GitHub Pages 部署工具"
echo "============================================"
echo ""

read -p "GitHub 用户名（如：zhangsan）: " USERNAME
read -p "仓库名（如：gongkao-workbench）: " REPO
read -s -p "GitHub Personal Access Token: " TOKEN
echo ""
echo ""

# 检查 gh 是否已安装
if command -v gh &> /dev/null; then
    echo "[1/5] 使用 gh CLI 认证..."
    echo "$TOKEN" | gh auth login --with-token 2>/dev/null || true
    # 用 gh 创建仓库
    echo "[2/5] 创建 GitHub 仓库..."
    gh repo create "$REPO" --public --source=. --remote=origin 2>/dev/null || {
        echo "  仓库可能已存在，继续推送..."
    }
else
    echo "[1/5] 未安装 gh，使用 git + API 方式..."
    # 通过 API 创建仓库
    echo "[2/5] 创建 GitHub 仓库..."
    curl -s -X POST https://api.github.com/user/repos \
        -H "Authorization: token $TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "{\"name\":\"$REPO\",\"public\":true}" || true
fi

# 设置远程并推送
echo "[3/5] 配置远程仓库..."
git remote remove origin 2>/dev/null || true
git remote add origin "https://$USERNAME:$TOKEN@github.com/$USERNAME/$REPO.git"
git branch -M main
echo "[4/5] 推送文件到 GitHub..."
git push -u origin main --force

# 启用 GitHub Pages
echo "[5/5] 启用 GitHub Pages..."
sleep 3
curl -s -X POST "https://api.github.com/repos/$USERNAME/$REPO/pages" \
    -H "Authorization: token $TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -d '{"source":{"branch":"main","path":"/"}}' || true

echo ""
echo "============================================"
echo "  ✅ 部署完成！"
echo "============================================"
echo ""
echo "📎 你的永久工作台网址："
echo "   https://$USERNAME.github.io/$REPO/"
echo ""
echo "⏳ GitHub Pages 首次部署需要 1-2 分钟生效。"
echo "   如果暂时打不开，等 2 分钟后刷新即可。"
echo ""
echo "📱 手机使用：在 Safari/Chrome 中打开上面的网址，"
echo "   然后添加到主屏幕即可像 App 一样使用。"
echo "============================================"
