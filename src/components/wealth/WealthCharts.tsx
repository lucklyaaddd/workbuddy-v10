/**
 * 数据可视化组件
 * 功能：周/月支出折线图、月度支出饼图、收入趋势柱状图、月度结余统计卡片
 * 使用 recharts，空状态显示线条小狗
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { formatAmount } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Loading } from '@/components/ui/Loading';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { Transaction } from '@/types';

// ============ 常量定义 ============
/** 饼图颜色数组 */
const PIE_COLORS = [
  '#5A7A4A', '#7DBF8A', '#C4A882', '#D64550', '#E8A87C',
  '#F0D58C', '#A8BBA0', '#2D5A3D', '#8B6F5E', '#D4A574',
];

/** 支出分类列表 */
const EXPENSE_CATEGORIES = ['餐饮', '交通', '购物', '娱乐', '医疗', '住房', '教育', '其他支出'];

/**
 * 数据可视化组件
 */
export function WealthCharts() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // ============ 数据加载 ============

  /** 加载近3个月的所有记录（限制条数） */
  const loadData = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);

    // 计算3个月前的日期
    const threeMonthAgo = new Date();
    threeMonthAgo.setMonth(threeMonthAgo.getMonth() - 3);
    const startDate = threeMonthAgo.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .gte('date', startDate)
      .order('date', { ascending: true })
      .limit(500); // 安全上限

    if (error) {
      setLoading(false);
      return;
    }

    setTransactions((data || []) as Transaction[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============ 数据处理 ============

  /** 月度支出折线图数据 */
  const monthlyTrendData = useMemo(() => {
    const months: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => {
        const month = t.date.slice(0, 7); // YYYY-MM
        months[month] = (months[month] || 0) + t.amount;
      });

    return Object.entries(months).map(([month, total]) => ({
      month: month.slice(5), // MM
      label: month,
      支出: Math.round(total / 100),
    }));
  }, [transactions]);

  /** 当前月支出饼图数据 */
  const currentMonthPieData = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const categoryTotals: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'expense' && t.date.startsWith(currentMonth))
      .forEach((t) => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
      });

    return Object.entries(categoryTotals)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({
        name,
        value: Math.round(value / 100),
      }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  /** 月度收入柱状图数据 */
  const incomeBarData = useMemo(() => {
    const months: Record<string, number> = {};
    transactions
      .filter((t) => t.type === 'income')
      .forEach((t) => {
        const month = t.date.slice(0, 7);
        months[month] = (months[month] || 0) + t.amount;
      });

    return Object.entries(months).map(([month, total]) => ({
      month: month.slice(5),
      label: month,
      收入: Math.round(total / 100),
    }));
  }, [transactions]);

  /** 月度结余统计 */
  const monthlyBalanceData = useMemo(() => {
    const months: Record<string, { income: number; expense: number }> = {};
    transactions.forEach((t) => {
      const month = t.date.slice(0, 7);
      if (!months[month]) months[month] = { income: 0, expense: 0 };
      if (t.type === 'income') months[month].income += t.amount;
      else months[month].expense += t.amount;
    });

    return Object.entries(months)
      .map(([month, data]) => ({
        month: month.slice(5),
        label: month,
        结余: Math.round((data.income - data.expense) / 100),
        收入: Math.round(data.income / 100),
        支出: Math.round(data.expense / 100),
      }))
      .slice(-6); // 最近6个月
  }, [transactions]);

  // ============ 渲染 ============
  if (loading) {
    return <Loading text="加载统计数据..." />;
  }

  if (transactions.length === 0) {
    return (
      <EmptyState
        icon="💰"
        message="还没有记账记录，记下第一笔收支吧 💰"
        description="添加记录后这里将展示统计图表"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* 月度结余统计卡片 */}
      {monthlyBalanceData.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {monthlyBalanceData.slice(-4).reverse().map((item) => (
            <Card key={item.label} padding="sm">
              <p className="text-xs text-secondary mb-1">{item.month}月</p>
              <p className={[
                'text-base font-bold',
                item.结余 >= 0 ? 'text-forest' : 'text-accent-red',
              ].join(' ')}>
                ¥{item.结余.toLocaleString()}
              </p>
              <div className="flex gap-2 mt-1 text-xs">
                <span className="text-secondary">收 {item.收入}</span>
                <span className="text-secondary">支 {item.支出}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 月度支出折线图 */}
      {monthlyTrendData.length > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
            月度支出趋势
          </h3>
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#C4A882" strokeOpacity={0.3} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#C4A882" />
                <YAxis tick={{ fontSize: 11 }} stroke="#C4A882" />
                <Tooltip
                  formatter={(value: number) => [`¥${value}`, '支出']}
                  contentStyle={{
                    backgroundColor: '#FDF8EC',
                    border: '2px solid #5A7A4A',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="支出"
                  stroke="#D64550"
                  strokeWidth={2}
                  dot={{ fill: '#D64550', r: 4 }}
                  activeDot={{ r: 6, stroke: '#D64550', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* 月度支出饼图 + 收入趋势并列 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 当月支出分类饼图 */}
        {currentMonthPieData.length > 0 && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
              本月支出分类
            </h3>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={currentMonthPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                    innerRadius={30}
                  >
                    {currentMonthPieData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`¥${value}`, name]}
                    contentStyle={{
                      backgroundColor: '#FDF8EC',
                      border: '2px solid #5A7A4A',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* 图例 */}
            <div className="flex flex-wrap gap-2 mt-2">
              {currentMonthPieData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1 text-xs">
                  <span
                    className="inline-block w-2 h-2 rounded-sm"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="text-secondary">{item.name}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 收入趋势柱状图 */}
        {incomeBarData.length > 0 && (
          <Card padding="md">
            <h3 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-3">
              月度收入趋势
            </h3>
            <div className="w-full h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeBarData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#C4A882" strokeOpacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#C4A882" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#C4A882" />
                  <Tooltip
                    formatter={(value: number) => [`¥${value}`, '收入']}
                    contentStyle={{
                      backgroundColor: '#FDF8EC',
                      border: '2px solid #5A7A4A',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="收入" fill="#5A7A4A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
