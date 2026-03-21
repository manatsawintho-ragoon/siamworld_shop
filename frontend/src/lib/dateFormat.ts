export function fmtDate(s: string): { date: string; time: string } {
  const d = new Date(s);
  return {
    date: d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  };
}

export function fmtMoney(v?: number): string {
  return parseFloat(String(v || 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 });
}
