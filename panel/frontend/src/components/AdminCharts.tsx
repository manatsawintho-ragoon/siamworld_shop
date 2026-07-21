'use client';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';

interface Props {
  data: any[];
  type: 'revenue' | 'growth';
}

export default function AdminChart({ data, type }: Props) {
  if (!data || data.length === 0) return (
    <div className="h-64 flex items-center justify-center text-[13px] text-muted-foreground">
      ยังไม่มีข้อมูลในช่วง 30 วันที่ผ่านมา
    </div>
  );

  const isRevenue = type === 'revenue';
  const color = isRevenue ? '#f59e0b' : '#3b82f6';

  return (
    <div className="h-72 w-full mt-4">
      <ResponsiveContainer width="100%" height="100%">
        {isRevenue ? (
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={color} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              minTickGap={30}
              tickFormatter={(str) => {
                const d = new Date(str);
                return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
              }}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              tickFormatter={(n) => `฿${n >= 1000 ? (n/1000)+'k' : n}`}
            />
            <Tooltip 
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 800 }}
              formatter={(value: any) => [`฿${Number(value).toLocaleString()}`, 'รายได้']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { dateStyle: 'long' })}
            />
            <Area type="monotone" dataKey="total" stroke={color} strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
          </AreaChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
              minTickGap={30}
              tickFormatter={(str) => {
                const d = new Date(str);
                return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
              }}
            />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }} />
            <Tooltip 
              cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }}
              contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: '12px', fontWeight: 800 }}
              formatter={(value: any) => [value, 'ผู้ใช้ใหม่']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('th-TH', { dateStyle: 'long' })}
            />
            <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
