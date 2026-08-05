# WorkBuddy V10.0 个人工作台

> 像素森系风格 PWA 个人工作台 — 待办管理、记账、情侣日志、备忘录、智能提醒，Bark 锁屏推送，Supabase 云端持久化。

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Vite + React 18 + TypeScript | 原生 Web 标准 PWA |
| 路由 | React Router v6 | 懒加载 + 路由守卫 |
| 状态管理 | Zustand | 轻量级状态管理 |
| 样式 | TailwindCSS | 像素森系自定义主题 |
| 图表 | Recharts | 数据可视化 |
| 数据库 | Supabase PostgreSQL | RLS 行级安全 |
| 文件存储 | Supabase Storage | 用户路径隔离 |
| 认证 | Supabase Auth | 邮箱密码登录 |
| 推送 | Bark API | iOS 锁屏推送（兼容 iOS 16.2+） |
| 部署 | Vercel | Serverless Functions + Cron Jobs |
| 离线 | IndexedDB + Service Worker | 双向同步 + 乐观锁冲突控制 |

## 目录结构

```
mini-workbench/
├── api/                        # Vercel Serverless Functions
│   ├── _lib/                   # 共享工具（认证、响应、Supabase管理员）
│   ├── auth/                   # 认证（注册拦截、数据导出）
│   ├── bark/                   # Bark 推送（订阅、发送、测试、管理）
│   ├── files/                  # 文件上传与删除
│   └── cron/                   # 定时任务（6个Cron作业）
├── public/                     # 静态资源
│   ├── manifest.json           # PWA 清单
│   └── icons/                  # 应用图标
├── src/
│   ├── components/             # 组件
│   │   ├── ui/                 # 基础UI组件
│   │   ├── common/             # 通用组件
│   │   ├── pixel/              # 像素风格组件
│   │   ├── dashboard/          # 今日中枢
│   │   ├── inspiration/        # 灵感补给站
│   │   ├── wealth/             # 财富工坊
│   │   ├── capsule/            # 时光胶囊
│   │   ├── reminders/          # 智能提醒中心
│   │   └── settings/           # 设置
│   ├── hooks/                  # 自定义 Hooks
│   ├── layouts/                # 布局组件
│   ├── lib/                    # 工具库
│   ├── pages/                  # 页面组件
│   ├── router/                 # 路由配置
│   ├── stores/                 # Zustand 状态管理
│   ├── types/                  # TypeScript 类型定义
│   ├── App.tsx                 # 根组件
│   ├── main.tsx                # 应用入口
│   └── index.css               # 全局样式
├── supabase/
│   └── migrations/             # 数据库迁移脚本
│       ├── 001_init.sql        # 建表+索引+触发器
│       ├── 002_rls.sql         # RLS 策略
│       ├── 003_storage.sql     # Storage 桶配置
│       └── 004_rollback.sql    # 回滚脚本
├── docs/                       # 文档
│   ├── 部署操作手册.md
│   └── 安全核对清单.md
├── index.html                  # HTML 入口
├── vite.config.ts              # Vite 配置
├── tailwind.config.js          # TailwindCSS 配置
├── vercel.json                 # Vercel 部署配置
├── package.json
└── .env.example                # 环境变量模板
```

## 功能模块

| 模块 | 功能 |
|------|------|
| 🏠 今日中枢 | 待办管理（增删改查、定时提醒、超时标记、统计饼图） |
| 📚 灵感补给站 | 好词好句摘抄（分类筛选、全文搜索、导出TXT） |
| 💰 财富工坊 | 记账（收支记录、图表分析、月度结余） |
| 💞 时光胶囊 | 情侣日志（多图、心情、日历标记）+ 备忘录（分类、置顶、画板） |
| ⏰ 智能提醒中心 | 生日提醒（农历/公历）+ 自定义周期提醒 |
| ⚙️ 设置 | Bark推送配置、数据导出、回收站、存储管理、主题切换 |

## 安全特性

- ✅ 公开注册关闭（前端无注册入口 + 后端 403 拦截）
- ✅ 全表 RLS 策略（auth.uid() = user_id）
- ✅ Storage 路径隔离（{user_id}/ 前缀）
- ✅ Bark URL AES-256-GCM 加密存储
- ✅ 文件上传魔数校验 + UUID 重命名
- ✅ CSP 策略 + XSS 防护
- ✅ 推送频率限制（10条/小时，50条/天）
- ✅ 乐观锁冲突控制（version 字段）
- ✅ 软删除 + 30天回收站
- ✅ Cron 密钥校验 + 幂等性

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 复制环境变量
cp .env.example .env

# 3. 填写环境变量（Supabase URL、密钥等）

# 4. 启动开发服务器
npm run dev

# 5. 构建生产版本
npm run build
```

详细部署步骤请参阅 [部署操作手册](./docs/部署操作手册.md)。

## 许可证

个人专用，保留所有权利。
