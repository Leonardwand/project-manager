# 详细部署指南

本指南将手把手教你将项目管理器部署到 Vercel，完全免费，无需服务器。

---

## 📋 准备工作

### 需要注册的账号（都是免费的）

| 平台 | 用途 | 网址 |
|------|------|------|
| GitHub | 存放代码 | https://github.com |
| Vercel | 托管网站 | https://vercel.com |
| Supabase | 云端数据库 | https://supabase.com |

---

## 第一步：创建 Supabase 项目

### 1.1 注册/登录 Supabase

1. 访问 https://supabase.com
2. 点击右上角 **"Start your project"**
3. 选择用 GitHub 登录（推荐）或邮箱注册

### 1.2 创建组织

1. 登录后，点击 **"New organization"**
2. 输入组织名称（如：MyProjects）
3. 选择免费计划（Free Plan）
4. 点击 **"Create organization"**

### 1.3 创建项目

1. 在组织中点击 **"New project"**
2. 填写项目信息：
   - **Name**: `project-manager`（或任意名称）
   - **Database Password**: 自动生成或自己设置（记住这个密码）
   - **Region**: 选择 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`
3. 点击 **"Create new project"**
4. 等待约 2 分钟，项目创建完成

### 1.4 获取 API 密钥

1. 项目创建后，进入项目首页
2. 点击左侧菜单 **"Settings"**（齿轮图标）
3. 点击 **"API"**
4. 记录以下信息：
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

> ⚠️ 这些信息稍后在 Vercel 部署时需要用到

### 1.5 创建数据表

1. 点击左侧菜单 **"SQL Editor"**
2. 点击 **"New query"**
3. 复制以下 SQL 粘贴到编辑器：

```sql
-- ============================================
-- 项目管理器数据库表结构
-- ============================================

-- 1. 用户资料表
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 用户设置表
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  theme TEXT DEFAULT 'minimal' CHECK (theme IN ('minimal', 'cute', 'business')),
  custom_progress_states JSONB DEFAULT '{}',
  collapsed_groups JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 3. 项目表
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  start_date DATE,
  end_date DATE,
  progress TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- 4. 任务表
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  progress TEXT,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- 5. 已完成任务表
CREATE TABLE completed_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  project_id UUID,
  text TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  progress TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 已删除任务表（墓碑机制）
CREATE TABLE deleted_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  unique_id TEXT UNIQUE NOT NULL,
  text TEXT,
  completed BOOLEAN DEFAULT false,
  priority TEXT DEFAULT 'medium',
  progress TEXT,
  end_date DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 启用行级安全（RLS）
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE completed_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_todos ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 创建 RLS 策略（用户只能访问自己的数据）
-- ============================================

-- profiles 表策略
CREATE POLICY "用户可以查看自己的资料" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "用户可以更新自己的资料" ON profiles
  FOR UPDATE USING (id = auth.uid());
CREATE POLICY "用户可以插入自己的资料" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- user_settings 表策略
CREATE POLICY "用户可以管理自己的设置" ON user_settings
  FOR ALL USING (user_id = auth.uid());

-- projects 表策略
CREATE POLICY "用户可以管理自己的项目" ON projects
  FOR ALL USING (user_id = auth.uid());

-- todos 表策略
CREATE POLICY "用户可以管理自己的任务" ON todos
  FOR ALL USING (user_id = auth.uid());

-- completed_todos 表策略
CREATE POLICY "用户可以管理自己的已完成任务" ON completed_todos
  FOR ALL USING (user_id = auth.uid());

-- deleted_todos 表策略
CREATE POLICY "用户可以管理自己的已删除任务" ON deleted_todos
  FOR ALL USING (user_id = auth.uid());

-- ============================================
-- 创建索引（提高查询性能）
-- ============================================

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_unique_id ON projects(unique_id);
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_unique_id ON todos(unique_id);
CREATE INDEX idx_todos_project_id ON todos(project_id);
CREATE INDEX idx_completed_todos_user_id ON completed_todos(user_id);
CREATE INDEX idx_completed_todos_unique_id ON completed_todos(unique_id);
CREATE INDEX idx_deleted_todos_user_id ON deleted_todos(user_id);
CREATE INDEX idx_deleted_todos_unique_id ON deleted_todos(unique_id);

-- ============================================
-- 创建触发器（自动创建用户设置）
-- ============================================

-- 创建函数：新用户注册时自动创建设置
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- 创建用户资料
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  
  -- 创建用户设置
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

4. 点击右下角 **"Run"** 按钮
5. 看到 "Success. No rows returned" 表示成功

### 1.6 启用邮箱登录

1. 点击左侧菜单 **"Authentication"**
2. 点击 **"Providers"**
3. 确保 **"Email"** 是启用状态（默认已启用）
4. （可选）关闭 "Confirm email" 以便测试时无需验证邮箱

---

## 第二步：上传代码到 GitHub

### 2.1 创建 GitHub 仓库

1. 访问 https://github.com
2. 登录后，点击右上角 **"+" → "New repository"**
3. 填写信息：
   - **Repository name**: `project-manager`
   - **Description**: 项目管理器应用
   - **Public** 或 **Private** 都可以
4. 点击 **"Create repository"**

### 2.2 推送代码到 GitHub

#### 方法一：在本地电脑操作（推荐）

需要先安装 Git：https://git-scm.com/downloads

```bash
# 1. 下载项目代码
# 从 Coze Coding 下载项目压缩包，解压到本地文件夹

# 2. 打开终端，进入项目目录
cd path/to/project-manager

# 3. 初始化 Git
git init

# 4. 添加所有文件
git add .

# 5. 提交
git commit -m "初始提交：项目管理器应用"

# 6. 设置主分支
git branch -M main

# 7. 连接远程仓库（替换成你的用户名）
git remote add origin https://github.com/你的用户名/project-manager.git

# 8. 推送到 GitHub
git push -u origin main
```

#### 方法二：直接在 GitHub 网页上传

1. 在 GitHub 仓库页面，点击 **"uploading an existing file"**
2. 拖拽所有项目文件到上传区域
3. 输入提交信息
4. 点击 **"Commit changes"**

---

## 第三步：部署到 Vercel

### 3.1 注册/登录 Vercel

1. 访问 https://vercel.com
2. 点击 **"Sign Up"**
3. 选择 **"Continue with GitHub"**（用 GitHub 登录）
4. 授权 Vercel 访问你的 GitHub

### 3.2 导入项目

1. 登录后，点击右上角 **"Add New" → "Project"**
2. 在 **"Import Git Repository"** 部分，找到你的 `project-manager` 仓库
3. 如果没看到，点击 **"Adjust GitHub App Permissions"** 授权更多仓库
4. 点击仓库右侧的 **"Import"** 按钮

### 3.3 配置项目

在 **"Configure Project"** 页面：

#### 基本设置

| 设置项 | 值 |
|--------|-----|
| **Project Name** | `project-manager`（可自定义） |
| **Framework Preset** | Vite（自动检测） |
| **Root Directory** | `./`（默认） |
| **Build Command** | `pnpm build`（默认） |
| **Output Directory** | `dist`（默认） |

#### 环境变量设置（重要！）

1. 展开 **"Environment Variables"** 部分
2. 添加以下两个变量：

**第一个变量：**
- **Name**: `VITE_SUPABASE_URL`
- **Value**: 你的 Supabase 项目 URL（如 `https://xxxxx.supabase.co`）

**第二个变量：**
- **Name**: `VITE_SUPABASE_ANON_KEY`
- **Value**: 你的 Supabase anon key（以 `eyJ` 开头的长字符串）

> 💡 这些值在 Supabase 的 Settings → API 页面可以找到

### 3.4 开始部署

1. 点击 **"Deploy"** 按钮
2. 等待构建（约 1-2 分钟）
3. 看到 **"🎉 Congratulations!"** 表示部署成功

### 3.5 访问网站

1. 部署成功后，点击 **"Continue to Dashboard"**
2. 在项目概览页面，点击网站域名（如 `project-manager.vercel.app`）
3. 你的应用已经上线了！

---

## 第四步：绑定自定义域名（可选）

如果你有自己的域名，可以绑定：

1. 在 Vercel 项目页面，点击 **"Settings"**
2. 点击 **"Domains"**
3. 输入你的域名（如 `app.yourdomain.com`）
4. 按照提示在域名服务商处添加 DNS 记录
5. 等待 DNS 生效（几分钟到几小时）

---

## 常见问题

### Q1: 部署后页面空白？

**原因**：环境变量没有正确设置

**解决**：
1. 进入 Vercel 项目 → Settings → Environment Variables
2. 检查 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 是否正确
3. 修改后需要重新部署（Deployments → 点击最新的部署 → Redeploy）

### Q2: 登录时报错？

**原因**：Supabase 数据表没有创建

**解决**：按照第一步的 1.5 节，在 Supabase SQL Editor 中执行建表 SQL

### Q3: 注册后收不到验证邮件？

**原因**：Supabase 默认需要邮箱验证

**解决**：
1. Supabase → Authentication → Providers
2. 关闭 "Confirm email" 选项
3. 或者检查垃圾邮件文件夹

### Q4: 数据同步有问题？

**原因**：RLS 策略没有正确配置

**解决**：确保执行了建表 SQL 中的所有 RLS 策略

### Q5: 如何更新代码？

1. 本地修改代码
2. 执行 `git add . && git commit -m "更新说明" && git push`
3. Vercel 会自动检测并重新部署

---

## 部署成功后的使用流程

1. 打开网站，点击 **"云端登录"**
2. 点击 **"注册账号"**
3. 输入邮箱和密码注册
4. 登录后即可使用所有功能
5. 数据会自动同步到云端

---

## 技术支持

如有问题，可以：
1. 查看 Vercel 的部署日志：Deployments → 点击部署 → Build Logs
2. 查看 Supabase 的日志：Logs → API Logs
3. 检查浏览器控制台是否有错误信息（F12 → Console）

---

祝部署顺利！🎉
