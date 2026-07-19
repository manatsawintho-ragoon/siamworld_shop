/**
 * Single source of truth for the landing-page FAQ.
 *
 * Both the visible <FaqSection /> and the FAQPage JSON-LD in app/layout.tsx
 * read from here. Google requires that FAQ structured data matches content
 * that is actually visible on the page, so these must never drift apart.
 * Add or edit a question here and both sides update together.
 */

export interface FaqItem {
  q: string;
  a: string;
}

/** Fee charged per slip-verification call by EasySlip. Keep in sync with
 *  the `easyslip_fee` setting (subscription.service.ts default). */
export const EASYSLIP_FEE_MAX = 0.396;

export const FAQ: FaqItem[] = [
  {
    q: 'ทดลองฟรี 7 วัน ใช้ได้จริงไหม ต้องผูกบัตรหรือเปล่า?',
    a: 'ใช้ได้จริงและไม่ต้องผูกบัตรใดๆ สมัครด้วยอีเมลแล้วเริ่มสร้างร้านได้เลย จำกัด 1 สิทธิ์ต่อบัญชีและต่อ IP เพื่อป้องกันการใช้ซ้ำ ครบ 7 วันระบบจะปิดร้านอัตโนมัติหากไม่อัปเกรด',
  },
  {
    q: 'โปรเดือนแรก ฿99 หมดเขตเมื่อไหร่ และเดือนถัดไปคิดเท่าไหร่?',
    a: 'โปรเดือนแรก ฿99 ใช้ได้กับลูกค้าใหม่ จำกัด 1 สิทธิ์ต่อบัญชี เดือนถัดไปคิดราคาปกติ ฿350 ต่อเดือน ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัด',
  },
  {
    q: 'ต้องตั้ง VPN เพื่อเชื่อมเซิร์ฟเวอร์มายคราฟไหม?',
    a: 'ไม่จำเป็น แนะนำใช้ Bridge Plugin ของเรา วางไฟล์ .jar ลงใน /plugins ใส่ token แล้วปลั๊กอินจะเชื่อมต่อกลับมาเองอัตโนมัติ ไม่ต้องเปิด port ไม่ต้องตั้ง VPN ใช้ได้กับเซิร์ฟเวอร์หลัง NAT หรือ ISP ทั่วไปได้เลย รองรับทั้ง Spigot, Paper และ Folia',
  },
  {
    q: 'ราคารวมค่าธรรมเนียม EasySlip API ไหม?',
    a: `ราคาแพ็กเกจรายเดือนไม่รวมค่าธรรมเนียม EasySlip API ซึ่งคิดสูงสุด ฿${EASYSLIP_FEE_MAX} ต่อรายการตรวจสลิป โดยจะหักจากยอดเติมเงินของลูกค้าเท่านั้น ไม่กระทบยอดค่าเช่ารายเดือน ส่วนการเติมผ่าน TrueMoney อั่งเปา ไม่มีค่าธรรมเนียมส่วนนี้`,
  },
  {
    q: 'ติดตั้งเว็บร้านค้า Minecraft นานไหม?',
    a: 'ระบบเป็นแบบอัตโนมัติเต็มรูปแบบ หลังชำระเงินเสร็จสิ้น เว็บไซต์ของคุณจะออนไลน์ภายใน 5-10 นาที โดยไม่ต้องตั้งค่าเซิร์ฟเวอร์เองเลย',
  },
  {
    q: 'รองรับการเติมเงินช่องทางไหนบ้าง?',
    a: 'รองรับ PromptPay QR Code พร้อมระบบตรวจสอบสลิปอัตโนมัติด้วย EasySlip และ TrueMoney อั่งเปา ซึ่งใช้ฟรี ไม่มีค่าธรรมเนียมเพิ่ม ผู้เล่นเติมเงินได้เอง 24 ชั่วโมง เงินเข้าร้านทันที',
  },
];
