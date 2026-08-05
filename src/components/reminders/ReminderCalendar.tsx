/**
 * 月历视图组件
 * 功能：当月日历展示、提醒日期标记、点击查看当日提醒、农历日期显示
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, getCurrentUserId } from '@/lib/supabase';
import { escapeHtml, solarToLunar } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import type { Reminder } from '@/types';

// ============ 类型定义 ============
interface ReminderCalendarProps {
  refreshKey: number;
}

/** 日期格子数据 */
interface DayCell {
  day: number;
  date: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  reminders: Reminder[];
  lunarDay: string;
}

/**
 * 月历视图组件
 */
export function ReminderCalendar({ refreshKey }: ReminderCalendarProps) {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ============ 加载数据 ============

  const loadReminders = useCallback(async () => {
    const userId = await getCurrentUserId();
    if (!userId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('reminders')
      .select('*')
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .limit(200);

    if (!error) {
      setReminders((data || []) as Reminder[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReminders();
  }, [refreshKey]);

  // ============ 构建日历格子 ============

  const calendarGrid = useMemo((): DayCell[] => {
    const today = new Date().toISOString().slice(0, 10);
    const cells: DayCell[] = [];

    // 当月第一天
    const firstDay = new Date(currentYear, currentMonth - 1, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0=周日

    // 当月天数
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();

    // 前月补位
    const prevMonthDays = new Date(currentYear, currentMonth - 1, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = `${currentYear}-${String(currentMonth - 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      cells.push({
        day,
        date,
        isCurrentMonth: false,
        isToday: date === today,
        reminders: [],
        lunarDay: '',
      });
    }

    // 当月
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateReminders = reminders.filter((r) => r.date === date);
      const lunarParts = solarToLunar(date).split('-');
      cells.push({
        day: d,
        date,
        isCurrentMonth: true,
        isToday: date === today,
        reminders: dateReminders,
        lunarDay: lunarParts[lunarParts.length - 1] || '',
      });
    }

    // 补满6行
    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const date = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        date,
        isCurrentMonth: false,
        isToday: false,
        reminders: [],
        lunarDay: '',
      });
    }

    return cells;
  }, [currentYear, currentMonth, reminders]);

  // ============ 切换月份 ============
  const goPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDate(null);
  };

  const goNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDate(null);
  };

  // ============ 选中日期提醒 ============
  const selectedDateReminders = selectedDate
    ? reminders.filter((r) => r.date === selectedDate)
    : [];

  // ============ 渲染 ============
  const weekNames = ['日', '一', '二', '三', '四', '五', '六'];

  if (loading) {
    return <Loading text="加载日历..." />;
  }

  return (
    <div className="space-y-3">
      {/* 月份切换 */}
      <div className="flex items-center justify-between">
        <button
          onClick={goPrevMonth}
          className="w-8 h-8 flex items-center justify-center rounded text-secondary hover:bg-forest/10 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-ink-dark dark:text-ink-light">
          {currentYear}年{currentMonth}月
        </span>
        <button
          onClick={goNextMonth}
          className="w-8 h-8 flex items-center justify-center rounded text-secondary hover:bg-forest/10 transition-colors"
        >
          ›
        </button>
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* 星期标题 */}
        {weekNames.map((w) => (
          <div
            key={w}
            className="text-center text-xs text-secondary py-1 font-medium"
          >
            {w}
          </div>
        ))}

        {/* 日期格子 */}
        {calendarGrid.map((cell) => (
          <button
            key={cell.date}
            onClick={() => setSelectedDate(cell.date)}
            className={[
              'relative flex flex-col items-center justify-center py-1.5 rounded transition-colors min-h-[44px]',
              'hover:bg-forest/5',
              !cell.isCurrentMonth ? 'opacity-30' : '',
              cell.isToday ? 'bg-forest/10 ring-1 ring-forest' : '',
              selectedDate === cell.date ? 'bg-forest/20 ring-1 ring-forest-light' : '',
            ].join(' ')}
          >
            {/* 公历日期 */}
            <span
              className={[
                'text-xs font-medium',
                cell.isToday ? 'text-forest font-bold' : 'text-ink-dark dark:text-ink-light',
              ].join(' ')}
            >
              {cell.day}
            </span>

            {/* 农历日期 */}
            {cell.lunarDay && cell.isCurrentMonth && (
              <span className="text-[10px] text-secondary/60 leading-tight">
                {cell.lunarDay === '1' ? cell.lunarDay : cell.lunarDay}
              </span>
            )}

            {/* 提醒标记 */}
            {cell.reminders.length > 0 && (
              <span className="text-xs mt-0.5">
                {cell.reminders.some((r) => r.type === 'birthday') ? '🎂' : '❤️'}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 当日提醒列表 */}
      {selectedDate && (
        <Card padding="md">
          <h4 className="text-sm font-semibold text-ink-dark dark:text-ink-light mb-2">
            {selectedDate} 的提醒
          </h4>
          {selectedDateReminders.length === 0 ? (
            <p className="text-xs text-secondary">当天没有提醒</p>
          ) : (
            <div className="space-y-1.5">
              {selectedDateReminders.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 text-sm py-1"
                >
                  <span>{r.type === 'birthday' ? '🎂' : '🔔'}</span>
                  <span className="text-ink-dark dark:text-ink-light">
                    {escapeHtml(r.name)}
                  </span>
                  {r.lunar && (
                    <span className="text-xs text-oak-dark">农历</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
