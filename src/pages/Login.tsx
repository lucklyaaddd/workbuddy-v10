/**
 * 登录页面
 * 像素森系风格，手绘植物装饰背景，邮箱密码登录，忘记密码入口
 *
 * 【已加固】错误展示带详细诊断信息，自动区分网络/凭据/CORS 等错误类型
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { resetPassword, debugConfig } from '@/lib/supabase';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Loading } from '@/components/ui/Loading';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [errorDetail, setErrorDetail] = useState('');
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // 忘记密码
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [sendingReset, setSendingReset] = useState(false);

  // ============ 错误诊断器 ============
  // 把 supabase-js 抛出的错误翻译成中文，并给出可执行的解决方案
  const diagnoseError = (rawError: string): { summary: string; detail: string; fix: string } => {
    const e = rawError.toLowerCase();

    // 1. 网络失败
    if (e.includes('failed to fetch') || e.includes('networkerror') || e.includes('网络请求失败')) {
      return {
        summary: '🌐 网络请求失败',
        detail: rawError,
        fix: '可能原因：\n' +
          '• 浏览器扩展拦截 → 请尝试无痕/隐私模式\n' +
          '• 公司/校园代理 → 请换网络或手机 4G 热点\n' +
          '• 防火墙拦截 → 临时关闭安全软件测试\n' +
          '• 浏览器缓存 → Ctrl+Shift+R 强制刷新',
      };
    }

    // 2. API Key 无效（必须先于"凭据"匹配，否则会被吞掉归因为密码错误）
    if (e.includes('invalid api key') || e.includes('no api key') || e.includes('apikey')) {
      return {
        summary: '🔑 API Key 无效（项目配置错误）',
        detail: rawError,
        fix: '【前端实际加载的 key】\n' +
          `  前缀: ${debugConfig.supabaseKeyPreview}\n` +
          `  长度: ${debugConfig.supabaseKeyLength} 字符\n` +
          `  格式: ${debugConfig.supabaseKeyFormat}\n` +
          `  URL:  ${debugConfig.supabaseUrl}\n\n` +
          '【必须做的事】\n' +
          '① 打开浏览器 DevTools Console (F12)，看 [Supabase 自检] 的输出\n' +
          '   - 如果显示 HTTP 200 + "anon key 被服务端认可" → 那就是 supabase-js v2.112 处理 publishable key 的 bug，需要换回 JWT 格式\n' +
          '   - 如果显示 HTTP 401 或 400 → anon key 真的不被服务端认\n' +
          '② 如果需要换回 JWT：\n' +
          '   1. 打开 Supabase Dashboard → Settings → API\n' +
          '   2. 找 "Legacy API Key" 区域 → 复制 anon / public（eyJ 开头）\n' +
          '   3. 覆盖 .env 中的 VITE_SUPABASE_ANON_KEY= 后面\n' +
          '   4. 重启 dev server',
      };
    }

    // 3. 凭据错误（精确匹配，避免吞掉 API key 错误）
    if (
      e.includes('invalid login credentials') ||
      e.includes('invalid_credentials') ||
      (e.includes('invalid') && e.includes('password'))
    ) {
      return {
        summary: '🔑 邮箱或密码错误',
        detail: rawError,
        fix: '请检查邮箱密码是否正确，注意大小写。\n忘记密码可点击下方"忘记密码"重置。',
      };
    }

    // 4. 用户不存在或邮箱未确认
    if (e.includes('email not confirmed')) {
      return {
        summary: '📧 邮箱未验证',
        detail: rawError,
        fix: '请到邮箱查收 Supabase 验证邮件并点击链接确认。\n（管理员在后台手动创建账号时需勾选 Auto Confirm）',
      };
    }

    // 4. 环境变量未配置
    if (rawError.includes('环境变量') || !debugConfig.isConfigured) {
      return {
        summary: '⚙️ 项目配置缺失',
        detail: 'VITE_SUPABASE_URL 或 VITE_SUPABASE_ANON_KEY 未配置',
        fix: '请在 .env 文件中配置后重启 dev server。\n参考 docs/部署操作手册.md',
      };
    }

    // 5. 频率限制
    if (e.includes('rate limit') || e.includes('too many')) {
      return {
        summary: '⏱️ 登录尝试过于频繁',
        detail: rawError,
        fix: '请等待几分钟后重试。',
      };
    }

    // 6. CORS
    if (e.includes('cors')) {
      return {
        summary: '🔀 跨域错误',
        detail: rawError,
        fix: 'Supabase Dashboard → API → 设置允许的域名，添加当前访问地址。',
      };
    }

    // 默认
    return {
      summary: '❓ 登录失败',
      detail: rawError,
      fix: '请稍后重试，或查看浏览器 Console 获取详细日志。',
    };
  };

  // ============ 登录 ============
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrorDetail('');

    if (!email.trim() || !password.trim()) {
      setError('请输入邮箱和密码');
      return;
    }

    // 预检：环境变量
    if (!debugConfig.isConfigured) {
      const diag = diagnoseError('环境变量');
      setError(diag.summary);
      setErrorDetail(diag.fix);
      return;
    }

    // 调试：打印前端实际加载的 anon key（仅 dev）
    if (import.meta.env.DEV) {
      console.info(
        '%c[Login 调试] 前端实际加载的 Supabase 配置：',
        'color: blue; font-weight: bold'
      );
      console.info('  URL:    ', debugConfig.supabaseUrl);
      console.info('  Key:    ', debugConfig.supabaseKeyPreview);
      console.info('  长度:   ', debugConfig.supabaseKeyLength, '字符');
      console.info('  格式:   ', debugConfig.supabaseKeyFormat);
    }

    const result = await login(email, password);
    if (result.error) {
      const diag = diagnoseError(result.error);
      setError(diag.summary);
      setErrorDetail(diag.detail + (diag.detail !== diag.fix ? '\n\n' + diag.fix : ''));
    } else {
      navigate('/');
    }
  };

  // ============ 发送重置邮件 ============
  const handleResetPassword = async () => {
    if (!forgotEmail.trim()) {
      toast.warning('请输入邮箱');
      return;
    }

    setSendingReset(true);
    const { error } = await resetPassword(forgotEmail.trim());
    setSendingReset(false);

    if (error) {
      toast.error(error.message || '发送失败');
    } else {
      toast.success('重置邮件已发送，请检查邮箱');
      setShowForgot(false);
      setForgotEmail('');
    }
  };

  // ============ 渲染 ============
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: '#FDF8EC' }}
    >
      {/* 手绘植物背景装饰 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* 左上角藤蔓 */}
        <svg
          className="absolute -top-10 -left-10 opacity-[0.06]"
          width="200" height="300" viewBox="0 0 200 300" fill="none"
        >
          <path d="M20 250 Q60 200 40 150 Q30 100 70 60 Q90 40 80 20" stroke="#5A7A4A" strokeWidth="3" fill="none" />
          <path d="M70 60 Q100 80 90 100 Q85 115 100 120" stroke="#5A7A4A" strokeWidth="2" fill="none" />
          <path d="M40 150 Q15 145 10 130" stroke="#5A7A4A" strokeWidth="2" fill="none" />
          <ellipse cx="80" cy="50" rx="8" ry="4" transform="rotate(-30 80 50)" fill="#5A7A4A" opacity="0.4" />
          <ellipse cx="55" cy="70" rx="6" ry="3" transform="rotate(45 55 70)" fill="#5A7A4A" opacity="0.3" />
          <ellipse cx="95" cy="115" rx="5" ry="3" transform="rotate(-20 95 115)" fill="#5A7A4A" opacity="0.4" />
        </svg>

        {/* 右下角植物 */}
        <svg
          className="absolute -bottom-10 -right-10 opacity-[0.06]"
          width="200" height="250" viewBox="0 0 200 250" fill="none"
        >
          <path d="M180 200 Q160 150 170 100 Q175 60 160 30" stroke="#C4A882" strokeWidth="3" fill="none" />
          <path d="M170 100 Q140 120 130 110" stroke="#C4A882" strokeWidth="2" fill="none" />
          <path d="M160 30 Q180 20 190 25" stroke="#C4A882" strokeWidth="2" fill="none" />
          <ellipse cx="170" cy="90" rx="10" ry="5" transform="rotate(30 170 90)" fill="#C4A882" opacity="0.3" />
          <ellipse cx="135" cy="108" rx="6" ry="3" transform="rotate(-15 135 108)" fill="#C4A882" opacity="0.3" />
        </svg>

        {/* 散布波点 */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-forest/10 w-2 h-2"
            style={{
              left: `${10 + i * 12}%`,
              top: `${15 + (i % 3) * 25}%`,
              transform: `scale(${0.5 + Math.random() * 0.8})`,
            }}
          />
        ))}
      </div>

      {/* 登录卡片 */}
      <div className="relative w-full max-w-sm">
        {/* 品牌区域 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3 animate-bounce-gentle">🍎</div>
          <h1 className="text-xl font-bold" style={{ color: '#5A7A4A' }}>
            WorkBuddy
          </h1>
          <p className="text-sm mt-1" style={{ color: '#C4A882' }}>
            像素森系个人工作台
          </p>
        </div>

        {/* 登录表单 */}
        <div
          className="rounded-2xl p-6 shadow-lg"
          style={{
            background: 'rgba(253, 248, 236, 0.8)',
            backdropFilter: 'blur(12px)',
            border: '2px solid rgba(90, 122, 74, 0.15)',
          }}
        >
          <h2 className="text-sm font-semibold text-center mb-4" style={{ color: '#5A7A4A' }}>
            欢迎回来
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label="邮箱"
              type="email"
              placeholder="请输入邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
            <Input
              label="密码"
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {/* 错误提示（简化版） */}
            {error && (
              <div className="px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20">
                <p className="text-xs font-medium text-accent-red">{error}</p>
              </div>
            )}

            {/* 详细错误诊断（可折叠） */}
            {errorDetail && errorDetail !== error && (
              <details className="text-xs">
                <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                  查看排查建议
                </summary>
                <pre className="mt-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                  {errorDetail}
                </pre>
              </details>
            )}

            {/* 登录按钮 */}
            {loading ? (
              <Loading text="登录中..." size="md" />
            ) : (
              <Button type="submit" fullWidth size="lg" variant="primary">
                登录
              </Button>
            )}
          </form>

          {/* 忘记密码 */}
          <div className="mt-4 text-center">
            <button
              onClick={() => setShowForgot(true)}
              className="text-xs underline"
              style={{ color: '#C4A882' }}
            >
              忘记密码？
            </button>
          </div>
        </div>

        {/* 调试信息（dev 环境常驻显示，便于排查 .env / anon key 问题） */}
        {import.meta.env.DEV && (
          <div className="mt-4 mx-auto max-w-sm px-3 py-2 rounded-lg bg-gray-100 border border-gray-200 font-mono text-[10px] text-gray-600">
            <p className="font-semibold text-gray-700 mb-1">🔧 调试信息（dev only）</p>
            <p>URL: {debugConfig.supabaseUrl || '(空)'}</p>
            <p>Key: {debugConfig.supabaseKeyPreview} ({debugConfig.supabaseKeyLength} 字符)</p>
            <p>格式: {debugConfig.supabaseKeyFormat}</p>
          </div>
        )}

        {/* 页脚 */}
        <p className="text-center mt-6 text-xs" style={{ color: '#C4A882', opacity: 0.6 }}>
          像素森系 · 记录你的每一天
        </p>
      </div>

      {/* 忘记密码弹窗 */}
      <Modal
        open={showForgot}
        onClose={() => { setShowForgot(false); setForgotEmail(''); }}
        title="忘记密码"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => { setShowForgot(false); setForgotEmail(''); }}>
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleResetPassword} loading={sendingReset}>
              发送重置邮件
            </Button>
          </>
        }
      >
        <p className="text-xs text-secondary mb-3">
          请输入注册时使用的邮箱，我们将发送密码重置链接。
        </p>
        <Input
          label="邮箱"
          type="email"
          placeholder="请输入邮箱"
          value={forgotEmail}
          onChange={(e) => setForgotEmail(e.target.value)}
        />
      </Modal>
    </div>
  );
}
