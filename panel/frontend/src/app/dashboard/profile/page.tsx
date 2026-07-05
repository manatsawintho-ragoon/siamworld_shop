'use client';
import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Icon, type IconName } from '@/components/ui/icon';

function InputField({
  label, icon, value, onChange, type = 'text', disabled = false, placeholder = '', rightEl,
}: {
  label: string; icon: IconName; value: string;
  onChange: (v: string) => void;
  type?: string; disabled?: boolean; placeholder?: string;
  rightEl?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/70 text-sm pointer-events-none">
          <Icon name={icon} />
        </span>
        <input
          type={type}
          className={`w-full bg-secondary/50 border border-border rounded-xl pl-11 ${rightEl ? 'pr-11' : 'pr-4'} py-3 text-sm font-bold outline-none transition-all text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary ${disabled ? 'opacity-50 cursor-not-allowed bg-secondary/30' : ''}`}
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
        {rightEl && <span className="absolute right-3 top-1/2 -translate-y-1/2">{rightEl}</span>}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ displayName: '', phone: '' });
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showCfm, setShowCfm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!loading && !user) router.push('/?auth=login'); }, [user, loading, router]);
  useEffect(() => {
    if (user) setForm({ displayName: user.displayName, phone: user.phone || '' });
  }, [user]);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/auth/me', form);
      await refreshUser();
      toast.success('บันทึกสำเร็จ', 'อัปเดตข้อมูลโปรไฟล์แล้ว');
    } catch {
      toast.error('บันทึกไม่สำเร็จ', 'ไม่สามารถบันทึกข้อมูลได้');
    } finally { setSaving(false); }
  };

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirm) {
      toast.error('รหัสผ่านไม่ตรงกัน', 'กรุณากรอกรหัสผ่านใหม่ให้ตรงกันทั้งสองช่อง');
      return;
    }
    setSaving(true);
    try {
      await api.put('/api/auth/me/password', { oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ', 'รหัสผ่านของคุณถูกอัปเดตแล้ว');
      setPwForm({ oldPassword: '', newPassword: '', confirm: '' });
    } catch (e: any) {
      const msg = e.response?.data?.error || 'ไม่สามารถเปลี่ยนรหัสผ่านได้';
      toast.error('เปลี่ยนรหัสผ่านไม่สำเร็จ', msg);
    } finally { setSaving(false); }
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* ── หัวข้อ ── */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl cursor-pointer" asChild>
            <Link href="/dashboard">
              <Icon name="arrow-left" className="text-xs" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">โปรไฟล์ของฉัน</h1>
            <p className="text-sm text-muted-foreground font-medium mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* ── User Header Card ── */}
        <Card className="mb-6 overflow-hidden border-primary/20 shadow-sm">
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-6 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="w-20 h-20 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-3xl shadow-lg border border-primary/20 ring-4 ring-primary/10">
              {user?.displayName?.charAt(0).toUpperCase()}
            </div>
            <div className="text-center sm:text-left min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{user?.displayName}</h2>
              <p className="text-sm text-muted-foreground font-medium mt-1">{user?.email}</p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-3">
                <Badge variant={user?.role === 'admin' ? "default" : "secondary"} className="px-3 py-1 font-bold uppercase tracking-wider text-[10px]">
                  <Icon name={user?.role === 'admin' ? 'shield-halved' : 'user'} className={`mr-1.5`} />
                  {user?.role === 'admin' ? 'แอดมิน' : 'ลูกค้า'}
                </Badge>
                <Badge variant="outline" className="px-3 py-1 font-bold border-border bg-background/50 text-[10px]">
                  ID: #{user?.id}
                </Badge>
              </div>
            </div>
            <div className="sm:ml-auto">
               {/* Could add more stats here later */}
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-6 items-start">
          {/* ข้อมูลส่วนตัว */}
          <form onSubmit={saveProfile}>
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon name="user-gear" />
                  </div>
                  ข้อมูลส่วนตัว
                </CardTitle>
                <CardDescription className="font-medium">แก้ไขชื่อที่แสดงและข้อมูลติดต่อ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField label="ชื่อที่แสดง" icon="id-card"
                  value={form.displayName}
                  onChange={v => setForm(f => ({ ...f, displayName: v }))} />
                <InputField label="อีเมล (เปลี่ยนไม่ได้)" icon="envelope"
                  value={user?.email || ''} onChange={() => {}} disabled
                  placeholder="อีเมลไม่สามารถเปลี่ยนได้" />
                <InputField label="เบอร์โทรศัพท์" icon="phone"
                  value={form.phone}
                  onChange={v => setForm(f => ({ ...f, phone: v }))}
                  placeholder="08x-xxx-xxxx" />
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 ml-1 font-semibold">
                  <Icon name="envelope" className="text-primary" />
                  ระบบจะส่งอีเมลแจ้งเตือนก่อนร้านหมดอายุไปยังอีเมลของคุณอัตโนมัติ
                </p>
              </CardContent>
              <CardFooter>
                <Button data-track="profile_save" type="submit" className="w-full rounded-xl font-bold h-11 cursor-pointer shadow-sm hover:shadow-md transition-all" disabled={saving}>
                  {saving ? <><Icon name="spinner" className="mr-2 animate-spin" /> กำลังบันทึก...</> : <><Icon name="floppy-disk" className="mr-2" /> บันทึกข้อมูล</>}
                </Button>
              </CardFooter>
            </Card>
          </form>

          {/* เปลี่ยนรหัสผ่าน */}
          <form onSubmit={changePassword}>
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-secondary text-foreground flex items-center justify-center">
                    <Icon name="lock" />
                  </div>
                  เปลี่ยนรหัสผ่าน
                </CardTitle>
                <CardDescription className="font-medium">รักษาความปลอดภัยของบัญชีคุณ</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <InputField label="รหัสผ่านเดิม" icon="lock" type={showOld ? 'text' : 'password'}
                  value={pwForm.oldPassword}
                  onChange={v => setPwForm(f => ({ ...f, oldPassword: v }))}
                  rightEl={
                    <button type="button" onClick={() => setShowOld(s => !s)}
                      className="text-muted-foreground hover:text-primary transition-colors cursor-pointer w-8 h-8 flex items-center justify-center">
                      <Icon name={showOld ? 'eye-slash' : 'eye'} className={`text-sm`} />
                    </button>
                  } />
                <InputField label="รหัสผ่านใหม่" icon="key" type={showNew ? 'text' : 'password'}
                  value={pwForm.newPassword}
                  onChange={v => setPwForm(f => ({ ...f, newPassword: v }))}
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  rightEl={
                    <button type="button" onClick={() => setShowNew(s => !s)}
                      className="text-muted-foreground hover:text-primary transition-colors cursor-pointer w-8 h-8 flex items-center justify-center">
                      <Icon name={showNew ? 'eye-slash' : 'eye'} className={`text-sm`} />
                    </button>
                  } />
                <InputField label="ยืนยันรหัสผ่านใหม่" icon="key" type={showCfm ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={v => setPwForm(f => ({ ...f, confirm: v }))}
                  placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                  rightEl={
                    <button type="button" onClick={() => setShowCfm(s => !s)}
                      className="text-muted-foreground hover:text-primary transition-colors cursor-pointer w-8 h-8 flex items-center justify-center">
                      <Icon name={showCfm ? 'eye-slash' : 'eye'} className={`text-sm`} />
                    </button>
                  } />
              </CardContent>
              <CardFooter>
                <Button type="submit" variant="secondary" className="w-full rounded-xl font-bold h-11 cursor-pointer border border-border" disabled={saving}>
                  {saving ? <><Icon name="spinner" className="mr-2 animate-spin" /> กำลังเปลี่ยน...</> : <><Icon name="shield-keyhole" className="mr-2" /> เปลี่ยนรหัสผ่าน</>}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
}
