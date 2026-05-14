import React from 'react';

export default function DeletionPage() {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8 text-gray-800">
      <h1 className="text-3xl font-bold mb-8">การขอเพิกถอนและลบข้อมูล (User Data Deletion)</h1>
      <p className="mb-6">หากคุณต้องการลบข้อมูลบัญชี Siamsite Panel ของคุณ รวมถึงข้อมูลที่ได้มาจาก Facebook หรือ Google โปรดปฏิบัติตามขั้นตอนดังนี้:</p>
      <ul className="list-disc pl-6 mb-6">
        <li>เข้าสู่ระบบและไปที่หน้า "โปรไฟล์" จากนั้นกดปุ่ม "ขอลบข้อมูลบัญชี"</li>
        <li>หรือ ส่งอีเมลแจ้งความประสงค์มาที่ผู้ดูแลระบบ</li>
      </ul>
      <p>เมื่อดำเนินการเสร็จสิ้น ข้อมูลทั้งหมดของคุณจะถูกลบออกจากฐานข้อมูลภายใน 30 วัน</p>
    </div>
  );
}
