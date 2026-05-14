import React from 'react';

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">ข้อกำหนดและเงื่อนไขการใช้งาน (Terms of Service)</h1>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">1. การใช้งานระบบ</h2>
        <p>ผู้ใช้ตกลงที่จะใช้งานระบบ Siamsite Panel อย่างถูกต้องตามกฎหมายและไม่กระทำการใดๆ ที่ส่งผลเสียต่อความมั่นคงของระบบ</p>
      </section>
      <section className="mb-6">
        <h2 className="text-xl font-semibold mb-4">2. การรักษาความปลอดภัย</h2>
        <p>ผู้ใช้มีหน้าที่รักษาความลับของบัญชีและไม่เปิดเผยข้อมูลการเข้าสู่ระบบให้แก่บุคคลอื่น</p>
      </section>
      <div className="mt-12 text-sm text-gray-500">
        ปรับปรุงล่าสุดเมื่อ: 6 เมษายน 2569
      </div>
    </div>
  );
}
