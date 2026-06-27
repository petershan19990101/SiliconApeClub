/**
 * 前端格式化工具，封装日期、相对时间和类名拼接等通用方法。
 */
export function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function formatDateTime(value?: string) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatRelativeTime(value?: string) {
  if (!value) {
    return '刚刚';
  }

  const diffMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' });

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < hour) {
    return rtf.format(Math.round(diffMs / minute), 'minute');
  }

  if (absMs < day) {
    return rtf.format(Math.round(diffMs / hour), 'hour');
  }

  return rtf.format(Math.round(diffMs / day), 'day');
}

export function truncateText(value: string, max = 120) {
  if (value.length <= max) {
    return value;
  }

  return `${value.slice(0, max).trim()}...`;
}
