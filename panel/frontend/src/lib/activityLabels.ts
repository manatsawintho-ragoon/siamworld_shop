// Friendly Thai labels for activity telemetry (page views + feature clicks), shared by
// the Audit Logs view and the Hotspots view. Keep feature keys in sync with the backend
// ALLOWED_FEATURES allowlist.

// Tracked panel routes. Unknown paths fall back to the raw path.
export const PATH_LABELS: Record<string, string> = {
  '/dashboard': 'แดชบอร์ด (หน้าหลัก)',
  '/dashboard/renew': 'ต่ออายุแพ็กเกจ',
  '/dashboard/topup': 'เติมเงิน',
  '/dashboard/domain': 'เชื่อมโดเมน',
  '/dashboard/credentials': 'รหัสแอดมินร้าน',
  '/dashboard/profile': 'โปรไฟล์',
  '/dashboard/support': 'แจ้งปัญหา',
  '/admin': 'แอดมิน: ภาพรวม',
  '/admin/customers': 'แอดมิน: ร้านค้าทั้งหมด',
  '/admin/customers/:id': 'แอดมิน: รายละเอียดร้าน',
  '/admin/users': 'แอดมิน: ผู้ใช้งาน',
  '/admin/payments': 'แอดมิน: รายการชำระเงิน',
  '/admin/vouchers': 'แอดมิน: โค้ดโปรโมชั่น',
  '/admin/announcements': 'แอดมิน: ประกาศ',
  '/admin/showcase': 'แอดมิน: ตัวอย่างฟีเจอร์',
  '/admin/support': 'แอดมิน: Tickets',
  '/admin/audit-logs': 'แอดมิน: บันทึกเหตุการณ์',
  '/admin/activity': 'แอดมิน: พฤติกรรมการใช้งาน',
  '/admin/settings': 'แอดมิน: ตั้งค่าระบบ',
};

// Tagged feature-click keys.
export const FEATURE_LABELS: Record<string, string> = {
  renew_open: 'เปิดหน้าต่ออายุ',
  renew_submit: 'กดต่ออายุ',
  renew_promptpay: 'ต่ออายุ: PromptPay',
  renew_easyslip: 'ต่ออายุ: แนบสลิป',
  topup_open: 'เปิดหน้าเติมเงิน',
  topup_promptpay: 'เติมเงิน: PromptPay',
  topup_truemoney: 'เติมเงิน: TrueMoney',
  topup_submit: 'กดเติมเงิน',
  domain_connect: 'เชื่อมโดเมน',
  domain_verify: 'ตรวจสอบโดเมน',
  support_open: 'เปิดหน้าแจ้งปัญหา',
  support_submit: 'ส่ง Ticket',
  profile_save: 'บันทึกโปรไฟล์',
  account_delete_open: 'เปิดหน้าลบบัญชี',
  credentials_regenerate: 'สุ่มรหัสแอดมินใหม่',
  credentials_copy: 'คัดลอกรหัสแอดมิน',
  order_open: 'เปิดหน้าสั่งซื้อร้าน',
  order_submit: 'ยืนยันสั่งซื้อร้าน',
  dashboard_manage_shop: 'เข้าจัดการร้าน',
};

/** Human label for an activity row's `details` value, given its action type. */
export function activityLabel(action: string, details: string): string {
  if (action === 'page_view') return PATH_LABELS[details] || details;
  if (action === 'feature_click') return FEATURE_LABELS[details] || details;
  return details;
}
