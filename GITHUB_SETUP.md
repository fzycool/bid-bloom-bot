# 将本项目与 GitHub 关联

本地已完成：
- ✅ `git init` 初始化仓库
- ✅ `.gitignore` 已加入 `.env`，避免把密钥推上去
- ✅ 已做首次提交（Initial commit）

## 方式一：你还没有在 GitHub 上建仓库

1. 打开 https://github.com/new
2. 仓库名可填：`bid-bloom-bot`（或任意名称）
3. 选择 **Private** 或 **Public**，**不要**勾选 “Add a README”（保持空仓库）
4. 创建后，在仓库页复制 **HTTPS** 或 **SSH** 地址，例如：
   - HTTPS: `https://github.com/你的用户名/bid-bloom-bot.git`
   - SSH: `git@github.com:你的用户名/bid-bloom-bot.git`

在项目目录执行（把下面的地址换成你复制的地址）：

```powershell
cd "e:\工作\Code\bid-bloom-bot"
git remote add origin https://github.com/你的用户名/bid-bloom-bot.git
git branch -M main
git push -u origin main
```

如使用 SSH：

```powershell
git remote add origin git@github.com:你的用户名/bid-bloom-bot.git
git branch -M main
git push -u origin main
```

## 方式二：你已经有 GitHub 仓库地址

在项目目录执行（把 `你的仓库地址` 换成实际地址）：

```powershell
cd "e:\工作\Code\bid-bloom-bot"
git remote add origin 你的仓库地址
git branch -M main
git push -u origin main
```

当前本地分支是 `master`，上面命令会改名为 `main` 并推送；若你希望保持 `master`，可改为：

```powershell
git push -u origin master
```

## 可选：修改本仓库的 Git 作者信息

提交时用的是临时名称，若希望显示你的名字和邮箱：

```powershell
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"
```

之后新提交会使用上述信息；已存在的提交不会改变。
