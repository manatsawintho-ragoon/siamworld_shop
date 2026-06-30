'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const BASE = 'SIAMSITE STORE';

// Path patterns evaluated top to bottom; first match wins.
// Use ":id" placeholders for dynamic segments.
const TITLES: Array<[RegExp, string]> = [
  // Public
  [/^\/$/,                     'SIAMSITE STORE'],
  [/^\/order(?:\/.*)?$/,       'สั่งซื้อแพ็กเกจ'],
  [/^\/terms$/,                'ข้อกำหนดการใช้บริการ'],
  [/^\/privacy$/,              'นโยบายความเป็นส่วนตัว'],
  [/^\/delete-account$/,       'ลบบัญชี'],

  // Customer dashboard
  [/^\/dashboard$/,                'แดชบอร์ด'],
  [/^\/dashboard\/topup$/,         'เติมเงิน'],
  [/^\/dashboard\/credentials$/,   'ข้อมูลเชื่อมต่อ'],
  [/^\/dashboard\/profile$/,       'โปรไฟล์'],
  [/^\/dashboard\/renew$/,         'ต่ออายุแพ็กเกจ'],
  [/^\/dashboard\/support$/,       'ติดต่อช่วยเหลือ'],

  // Admin
  [/^\/admin$/,                    'ภาพรวมระบบ'],
  [/^\/admin\/customers$/,         'ลูกค้าทั้งหมด'],
  [/^\/admin\/users$/,             'ผู้ใช้งาน'],
  [/^\/admin\/payments$/,          'การชำระเงิน'],
  [/^\/admin\/vouchers$/,          'โค้ดส่วนลด'],
  [/^\/admin\/support$/,           'ตั๋วช่วยเหลือ'],
  [/^\/admin\/activity$/,          'พฤติกรรมการใช้งาน'],
  [/^\/admin\/audit-logs$/,        'บันทึกการตรวจสอบ'],
  [/^\/admin\/settings$/,          'ตั้งค่าระบบ'],
];

function titleFor(pathname: string): string {
  for (const [pattern, label] of TITLES) {
    if (pattern.test(pathname)) return label === BASE ? BASE : `${label} · ${BASE}`;
  }
  return BASE;
}

export default function PageTitleManager() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) document.title = titleFor(pathname);
  }, [pathname]);
  return null;
}
