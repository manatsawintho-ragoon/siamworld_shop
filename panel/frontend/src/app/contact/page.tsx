import React from 'react';
import type { Metadata } from 'next';
import LegalLayout, { Section, P, UL, LI } from '@/components/legal/LegalLayout';
import { OPERATOR, CONTACT } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'ติดต่อเรา | Siamsite Panel',
  description: 'ช่องทางติดต่อผู้ให้บริการ Siamsite Panel สำหรับการสนับสนุน เรื่องกฎหมาย และการใช้สิทธิตาม PDPA',
};

export default function ContactPage() {
  return (
    <LegalLayout
      current=""
      title="ติดต่อเรา"
      subtitle="ช่องทางติดต่อผู้ให้บริการสำหรับการสนับสนุนการใช้งาน เรื่องการชำระเงิน ข้อกฎหมาย และการใช้สิทธิตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล (PDPA)"
    >
      <Section n="1." title="ผู้ให้บริการ">
        <P>
          <strong>{OPERATOR.nameTh}</strong> ({OPERATOR.status}) ผู้ให้บริการแพลตฟอร์ม {OPERATOR.service} ที่ {OPERATOR.domain}
        </P>
        <P>
          เราให้บริการเครื่องมือจัดการร้านค้าเซิร์ฟเวอร์ Minecraft แก่ผู้ประกอบการในประเทศไทย
          หากท่านมีคำถามเกี่ยวกับการใช้งาน การชำระเงิน หรือต้องการความช่วยเหลือ ติดต่อได้ตามช่องทางด้านล่าง
        </P>
      </Section>

      <Section n="2." title="ช่องทางติดต่อ">
        <UL>
          <LI><strong>อีเมลหลัก:</strong> {CONTACT.email} (แนะนำสำหรับเรื่องการชำระเงิน เอกสาร และข้อกฎหมาย)</LI>
          <LI><strong>อีเมลสำรอง:</strong> {CONTACT.altEmail}</LI>
          <LI><strong>Facebook:</strong> {CONTACT.facebookLabel}</LI>
          <LI><strong>Discord:</strong> {CONTACT.discordLabel}</LI>
        </UL>
      </Section>

      <Section n="3." title="การใช้สิทธิตาม PDPA และเรื่องร้องเรียน">
        <P>
          หากท่านต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล (ขอเข้าถึง แก้ไข ลบ คัดค้าน หรือถอนความยินยอม)
          หรือต้องการร้องเรียนเกี่ยวกับการให้บริการ โปรดส่งคำขอมาที่ {CONTACT.email}
          พร้อมระบุรายละเอียดและข้อมูลที่ใช้ยืนยันตัวตน เพื่อให้เราดำเนินการได้อย่างถูกต้อง
        </P>
        <P>รายละเอียดเพิ่มเติมเกี่ยวกับการคุ้มครองข้อมูลส่วนบุคคล ดูได้ที่ “นโยบายความเป็นส่วนตัว”</P>
      </Section>

      <Section n="4." title="เวลาในการตอบกลับ">
        <P>
          เราจะพยายามตอบกลับโดยเร็วที่สุดในวันและเวลาทำการ สำหรับคำขอที่ต้องดำเนินการตามกฎหมาย
          เราจะดำเนินการภายในระยะเวลาที่กฎหมายกำหนด
        </P>
      </Section>
    </LegalLayout>
  );
}
