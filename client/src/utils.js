export const statuses = ['PLANEJADA', 'EM ANDAMENTO', 'AJUSTADA', 'META ATINGIDA', 'ENCERRADA'];

export function money(value, locale = 'pt-BR') {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(Math.abs(number));
  if (number > 0) return `+${formatted}`;
  if (number < 0) return `-${formatted}`;
  return formatted;
}

export function shortMoney(value, locale = 'pt-BR') {
  const number = Number(value || 0);
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(Math.abs(number));
  if (number > 0) return `+${formatted}`;
  if (number < 0) return `-${formatted}`;
  return formatted;
}

export function tone(value) {
  const number = Number(value);
  return number > 0 ? 'positive' : number < 0 ? 'negative' : 'neutral';
}

export function dateTime(value) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(`${value.replace(' ', 'T')}Z`));
}
