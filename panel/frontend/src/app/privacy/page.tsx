import React from 'react';

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">นโยบายความเป็นส่วนตัว (Privacy Policy)</h1>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">1. ข้อมูลที่เราจัดเก็บ</h2>
        <p>เราจัดเก็บข้อมูลที่จำเป็นสำหรับการให้บริการ เช่น ชื่อ, อีเมล และรูปโปรไฟล์ เมื่อคุณเข้าสู่ระบบผ่าน Google หรือ Facebook</p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">2. การใช้ข้อมูล</h2>
        <p>ข้อมูลของคุณจะถูกใช้เพื่อการระบุตัวตนในการเข้าใช้งานระบบจัดการ Siamsite Panel เท่านั้น เราไม่มีการเปิดเผยข้อมูลส่วนบุคคลให้แก่บุคคลภายนอก</p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">3. การลบข้อมูล</h2>
        <p>ผู้ใช้สามารถแจ้งขอลบข้อมูลบัญชีและข้อมูลส่วนตัวได้ทุกเมื่อผ่านหน้าโปรไฟล์ในระบบ หรือติดต่อฝ่ายสนับสนุนที่ <a href="https://www.facebook.com/siamsitestore" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Facebook Page: SiamsiteStore</a></p>
      </section>
      <div className="mt-12 text-sm text-gray-500">
        ปรับปรุงล่าสุดเมื่อ: 6 เมษายน 2569
      </div>
    </div>
  );
}
