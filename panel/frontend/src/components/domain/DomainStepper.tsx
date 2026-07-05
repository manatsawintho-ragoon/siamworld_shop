'use client';
import { Icon, type IconName } from '@/components/ui/icon';

type DomainStatus = 'pending_dns' | 'pending_ssl' | 'active' | 'failed' | null;

/** 4-step progress indicator for the custom-domain flow, derived from the API status. */
export default function DomainStepper({ status }: { status: DomainStatus }) {
  // step index that is currently in progress (0-based). active => all done.
  const current =
    status === 'active' ? 4 :
    status === 'pending_ssl' ? 2 :
    status === 'pending_dns' ? 1 :
    0; // no domain yet / failed -> at step 1 (add)

  const steps = ['เพิ่มโดเมน', 'ตั้งค่า CNAME', 'ออกใบรับรอง (SSL)', 'พร้อมใช้งาน'];

  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const done = i < current;
        const activeStep = i === current && status !== 'active';
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors ${
                  done ? 'bg-emerald-500 text-white'
                  : activeStep ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground border border-border'
                }`}
              >
                {done ? <Icon name="check" /> : activeStep ? <Icon name="spinner" className="animate-spin" /> : i + 1}
              </div>
              <span className={`text-[10px] font-bold text-center leading-tight ${done || activeStep ? 'text-foreground' : 'text-muted-foreground'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-1 -mt-5 rounded ${i < current ? 'bg-emerald-500' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
