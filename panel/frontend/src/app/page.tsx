'use client';
import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/components/Navbar';
import AuthCodeExchange from '@/components/AuthCodeExchange';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/icon';

interface Package { months: number; price: number; label: string; save: number; kind?: 'regular' | 'trial' | 'intro' }
interface Promo {
  kind: 'trial' | 'intro';
  months: number;
  days?: number;
  price: number;
  label: string;
  regularPrice: number;
}

const DEFAULT_PACKAGES: Package[] = [
  { months: 1, price: 350,  label: '1 เดือน',  save: 0,   kind: 'regular' },
  { months: 3, price: 945,  label: '3 เดือน',  save: 105, kind: 'regular' },
  { months: 6, price: 1785, label: '6 เดือน',  save: 315, kind: 'regular' },
];

const DEFAULT_PROMOS: Promo[] = [
  { kind: 'trial', months: 0, days: 7, price: 0,  label: 'ทดลองฟรี 7 วัน', regularPrice: 350 },
  { kind: 'intro', months: 1,           price: 99, label: 'เดือนแรกพิเศษ',  regularPrice: 350 },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  {
    icon: 'rocket',
    title: 'ระบบ Auto-Deploy',
    desc: 'พร้อมขายทันที ไม่ต้องเขียนโค้ด ไม่ต้องตั้งค่ายาก'
  },
  {
    icon: 'qrcode',
    title: 'รับเงิน 24 ชม.',
    desc: 'PromptPay + TrueMoney อั่งเปา (ฟรี ไม่มีค่าธรรมเนียม) เงินเข้าทันทีแม้คุณนอน'
  },
  {
    icon: 'box-open',
    title: 'Loot Box ดึงดูดผู้เล่น',
    desc: 'ระบบสุ่มพร้อมแอนิเมชั่น CS:GO กระตุ้นยอดขายซ้ำ'
  },
  {
    icon: 'gears',
    title: 'จัดการครบจากเว็บ',
    desc: 'ส่งของผ่าน RCON แม่นยำ ดู logs ดูยอดได้ทุกที่'
  },
];

interface ShowcaseSlide { src: string; title: string; desc: string }

// Fallback slides shown when the admin hasn't configured any in the panel yet.
const DEFAULT_SHOWCASE: ShowcaseSlide[] = [
  { src: '/images/homepage.png', title: 'หน้าแรกที่ทันสมัย', desc: 'ดึงดูดผู้เล่นด้วยดีไซน์ที่สวยงามและใช้งานง่าย' },
  { src: '/images/items_shop.png', title: 'ร้านค้าไอเท็ม', desc: 'จัดการหมวดหมู่และสินค้าได้ง่ายดายผ่านระบบหลังบ้าน' },
  { src: '/images/gacha_system.jpg', title: 'ระบบกล่องสุ่ม Gacha', desc: 'เพิ่มความตื่นเต้นด้วยการสุ่มไอเท็มพร้อมแอนิเมชั่นระดับพรีเมียม' },
  { src: '/images/inventory_system.jpg', title: 'ระบบคลังเว็บ', desc: 'เก็บไอเท็มที่สุ่มได้ไว้ในคลังเว็บ เลือกรับเข้าตัวได้ทุกเมื่อ' },
  { src: '/images/topup_system.jpg', title: 'ระบบเติมเงินอัตโนมัติ', desc: 'รองรับ PromptPay และ TrueMoney อั่งเปา ตรวจสอบยอดเงินทันที 24 ชม.' },
  { src: '/images/theme_change.png', title: 'ปรับแต่งธีมได้อิสระ', desc: 'เปลี่ยนสีและรูปแบบของร้านค้าให้เข้ากับเซิร์ฟเวอร์ของคุณ' },
];

function PackageCard({ pkg, isPromo = false, isTrial = false, onShowEasySlip }: { pkg: any, isPromo?: boolean, isTrial?: boolean, onShowEasySlip: () => void }) {
  return (
    <div className={`animate-fade-in-up ${isPromo ? 'z-10' : ''}`}>
      <Card className={`flex flex-col relative border-border shadow-sm h-full transition-all duration-300 ${isPromo ? 'border-primary shadow-xl scale-105 bg-card' : 'hover:border-primary/30 bg-card/50'}`}>
        {isPromo && (
          <div className="absolute top-0 right-6 -translate-y-1/2">
            <Badge className="bg-primary text-primary-foreground px-3 py-1 text-[10px] uppercase tracking-wider font-black shadow-md border-none">
              แนะนำที่สุด
            </Badge>
          </div>
        )}
        
        <CardHeader className="pb-4">
          <div className="flex justify-between items-start mb-2">
            <CardTitle className="text-xl font-black">{isTrial ? 'ทดลองใช้ฟรี' : pkg.label}</CardTitle>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase tracking-tighter border border-emerald-500/20">
               <Icon name="arrows-rotate" className="text-[9px]" /> อัปเดตฟรี
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tracking-tighter text-foreground">฿{pkg.price}</span>
            <span className="text-sm font-bold text-muted-foreground">/{pkg.days ? `${pkg.days} วัน` : (pkg.months === 1 ? 'เดือนแรก' : pkg.label)}</span>
          </div>
        </CardHeader>

        <CardContent className="flex-1 pb-6 space-y-6">
          <ul className="space-y-3.5">
            <li className="flex items-center gap-2.5 text-sm font-bold text-foreground/90">
              <Icon name="circle-check" className="text-primary text-sm" /> ฟีเจอร์พรีเมียมครบทุกอย่าง
            </li>
            <li className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
              <Icon name="box-open" className="text-primary/60 text-sm" /> ระบบสุ่ม Loot Box แอนิเมชั่น CS:GO
            </li>
            <li className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
              <Icon name="archive" className="text-primary/60 text-sm" /> ระบบคลังเว็บ (Web Inventory)
            </li>
            <li className={`flex items-center gap-2.5 text-[13px] font-medium ${isTrial ? 'text-muted-foreground/40' : 'text-muted-foreground'}`}>
              <Icon name={isTrial ? 'circle-xmark' : 'qrcode'} className={`text-sm ${isTrial ? 'text-destructive/40' : 'text-primary/60'}`} /> ตรวจสลิป PromptPay อัตโนมัติ 24 ชม.
            </li>
            <li className="flex items-center gap-2.5 text-[13px] font-bold text-emerald-600">
              <Icon name="wallet" className="text-emerald-500 text-sm" />
              <span className="flex items-center gap-1.5 flex-wrap">
                เติมผ่าน TrueMoney อั่งเปา ฟรี ไม่มีค่าธรรมเนียม
                <span className="text-[8px] font-black uppercase tracking-wider bg-emerald-500 text-white px-1.5 py-0.5 rounded-full leading-none">ใหม่</span>
              </span>
            </li>
            <li className="flex items-center gap-2.5 text-[13px] font-medium text-muted-foreground">
              <Icon name="shield-halved" className="text-primary/60 text-sm" /> ระบบความปลอดภัย Docker Isolation
            </li>
          </ul>

          {!isTrial && (
            <div className="text-[10px] text-muted-foreground/80 leading-relaxed bg-secondary/30 p-3 rounded-2xl border border-border/50 font-medium">
              <div className="flex flex-col gap-2">
                <span>* เฉพาะการตรวจสลิป PromptPay มีค่าธรรมเนียม API 0.359 บาท/สลิป (EasySlip) ส่วน TrueMoney อั่งเปา ใช้ฟรี ไม่มีค่าธรรมเนียม</span>
                <button
                  onClick={onShowEasySlip}
                  className="w-fit text-[9px] font-black text-primary hover:text-primary/80 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Icon name="circle-info" className="text-[11px]" />
                  ดูรายละเอียดค่าบริการ EasySlip
                </button>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="pt-0">
          <Button 
            className={`w-full rounded-full font-black tracking-wide h-12 shadow-sm hover:shadow-xl transition-all cursor-pointer ${isPromo ? 'bg-primary hover:bg-primary/90' : 'bg-background border-2 border-border hover:bg-secondary text-foreground'}`}
            variant={isPromo ? 'default' : 'outline'}
            asChild
          >
            <Link href={isTrial ? '/order?kind=trial' : (isPromo ? '/order?kind=intro' : `/order?months=${pkg.months}`)}>
               {isTrial ? 'เริ่มทดลองใช้งาน' : 'สั่งซื้อแพ็กเกจ'}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

function LandingContent() {
  const [packages, setPackages] = useState<Package[]>(DEFAULT_PACKAGES);
  const [promos, setPromos] = useState<Promo[]>(DEFAULT_PROMOS);
  const [easyslipFee, setEasyslipFee] = useState<number>(0.396);
  const [totalShops, setTotalShops] = useState<number>(0);
  const [statsData, setStatsData] = useState<any>(null);
  const [shops, setShops] = useState<{ name: string; domain: string }[]>([]);
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const [showEasySlipPlan, setShowEasySlipPlan] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showcase, setShowcase] = useState<ShowcaseSlide[]>(DEFAULT_SHOWCASE);

  useEffect(() => {
    api.get('/api/subscriptions/packages').then(r => {
      if (r.data.packages?.length) setPackages(r.data.packages);
      if (r.data.promos?.length) setPromos(r.data.promos);
      if (typeof r.data.easyslipFee === 'number') setEasyslipFee(r.data.easyslipFee);
    }).catch(() => {});
    api.get('/api/subscriptions/public-stats').then(r => { 
      if (r.data.total_shops !== undefined) setTotalShops(r.data.total_shops); 
      setStatsData(r.data);
    }).catch(() => {});
    api.get('/api/subscriptions/public-shops').then(r => { if (r.data.shops?.length) setShops(r.data.shops); }).catch(() => {});
    // Admin-managed feature showcase; keep the built-in defaults if none configured.
    api.get('/api/showcase').then(r => {
      const items = (r.data.items || []) as { title: string; description: string; image_data: string }[];
      if (items.length) setShowcase(items.map(i => ({ src: i.image_data, title: i.title, desc: i.description })));
    }).catch(() => {});
  }, []);

  const segments = useMemo(() => [
    { text: "ยกระดับเซิร์ฟเวอร์มายคราฟสู่ธุรกิจ", color: "text-foreground" },
    { text: "ระดับมืออาชีพ", color: "text-primary block mt-2" }
  ], []);

  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const fullText = segments.map(s => s.text).join('');

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (charIndex < fullText.length) {
          setCharIndex(prev => prev + 1);
        } else {
          setTimeout(() => setIsDeleting(true), 1800);
        }
      } else {
        if (charIndex > 0) {
          setCharIndex(prev => prev - 1);
        } else {
          setTimeout(() => setIsDeleting(false), 600);
        }
      }
    }, isDeleting ? 45 : 90);
    return () => clearTimeout(timeout);
  }, [charIndex, isDeleting, fullText]);

  const typedSegments = useMemo(() => {
    let remaining = charIndex;
    return segments.map(s => {
      if (remaining <= 0) return { text: '', color: s.color };
      const slice = s.text.slice(0, remaining);
      remaining -= s.text.length;
      return { text: slice, color: s.color };
    });
  }, [charIndex, segments]);

  const nextImage = () => {
    setCurrentIndex((prev) => (prev + 1) % showcase.length);
  };

  const prevImage = () => {
    setCurrentIndex((prev) => (prev - 1 + showcase.length) % showcase.length);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      nextImage();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentIndex]);

  const stats: { label: string; value: string; icon: IconName }[] = useMemo(() => {
    return [
      { label: 'ลูกค้าทั้งหมด', value: (statsData?.total_shops || 0).toLocaleString() + '+', icon: 'shopping-cart' },
      { label: 'สมาชิกทั้งหมด', value: (statsData?.total_users || 0).toLocaleString() + '+', icon: 'users' },
      { label: 'ความเร็วในการติดตั้ง', value: statsData?.delivery_speed || '< 1 วินาที', icon: 'bolt' },
      { label: 'Uptime ระบบ', value: statsData?.uptime || '99.9%', icon: 'server' },
    ];
  }, [statsData]);

  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-16 pb-8 md:pt-10 md:pb-10 overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-6 items-center relative z-10">
          <div className="animate-fade-in-up">
            <h1 className="relative text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-8 tracking-tight">
              {/* Real heading text: reserves the exact space, and is what
                  crawlers and screen readers read. The typed layer below is
                  decoration only. */}
              <div className="opacity-0 pointer-events-none select-none">
                <span className="block">ยกระดับเซิร์ฟเวอร์มายคราฟสู่ธุรกิจ</span>
                <span className="block mt-2">ระดับมืออาชีพ</span>
              </div>

              {/* Animated typing overlay (decorative duplicate of the text above) */}
              <div aria-hidden="true" className="absolute top-0 left-0 w-full h-full text-foreground">
                <span className="text-foreground">
                  {typedSegments[0]?.text}
                  {charIndex <= segments[0].text.length && (
                    <span aria-hidden className="inline-block w-[3px] md:w-[4px] h-[0.85em] bg-primary ml-1 align-middle animate-pulse" />
                  )}
                </span>
                {charIndex > segments[0].text.length && (
                  <span className="text-primary block mt-2">
                    {typedSegments[1]?.text}
                    <span aria-hidden className="inline-block w-[3px] md:w-[4px] h-[0.85em] bg-primary ml-1 align-middle animate-pulse" />
                  </span>
                )}
              </div>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-10 max-w-lg font-medium">
              เปิดร้านค้า Minecraft แบบไม่ต้องเขียนโค้ด พร้อมระบบรับชำระเงินอัตโนมัติ และฟีเจอร์ Gacha ระดับพรีเมียม
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Button size="lg" className="h-14 px-8 text-base rounded-full shadow-lg cursor-pointer" asChild>
                <Link href="/order?kind=trial">
                  <Icon name="rocket" className="mr-2" /> เริ่มทดลองฟรี 7 วัน
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="h-14 px-8 text-base rounded-full cursor-pointer" asChild>
                <a href="#pricing">ดูแพ็กเกจทั้งหมด</a>
              </Button>
            </div>
            
            {shops.length > 0 && (
              <div className="mt-8 pt-8 border-t border-border">
                <p className="font-bold text-sm text-foreground mb-4 flex items-center gap-2">
                  <Icon name="heart" className="text-primary animate-pulse" />
                  ไว้วางใจโดย {totalShops}+ เซิร์ฟเวอร์ชั้นนำ
                </p>
                <div className="relative w-full overflow-hidden h-10">
                  <motion.div 
                    className="flex gap-4 absolute whitespace-nowrap items-center"
                    animate={{ x: ["0%", "-50%"] }}
                    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  >
                    {[...shops, ...shops, ...shops].map((s, i) => (
                      <a 
                        key={i} 
                        href={`https://${s.domain}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 bg-secondary/50 px-4 py-1.5 rounded-full border border-border hover:border-primary/40 hover:bg-secondary transition-all cursor-pointer group/shop"
                      >
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover/shop:scale-125 transition-transform" />
                        <span className="text-sm font-bold text-muted-foreground tracking-tight group-hover/shop:text-primary transition-colors">{s.name}</span>
                        <Icon name="external-link-alt" className="text-[11px] text-muted-foreground/50 opacity-0 group-hover/shop:opacity-100 transition-opacity" />
                      </a>
                    ))}
                  </motion.div>
                  {/* Gradient Masks */}
                  <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent z-10" />
                  <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent z-10" />
                </div>
              </div>
            )}
          </div>

          <div className="relative animate-fade-in-up group/hero" style={{ animationDelay: '0.2s' }}>
            <div className="relative z-20 rounded-[2rem] overflow-hidden shadow-2xl transition-all duration-500 border border-border bg-card">
              <img src="/dashboard-admin.png" alt="Siamsite Shop Dashboard Preview" className="w-full h-auto" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-card border border-border p-4 rounded-2xl shadow-xl z-30 animate-float-y">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-xl">
                  <Icon name="check" />
                </div>
                <div>
                  <p className="font-bold text-sm text-foreground">ออนไลน์ทันที</p>
                  <p className="text-xs text-muted-foreground">หลังชำระเงินเสร็จสิ้น</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="py-8 bg-secondary/50 border-y border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-6 animate-fade-in-up">
            <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight">ครบ จบในที่เดียว</h2>
            <p className="text-muted-foreground text-lg">ไม่ต้องยุ่งยากกับการตั้งค่า หรือปวดหัวกับการดูแลระบบด้วยตัวเอง</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <Card className="bg-card hover:border-primary/50 transition-all hover:-translate-y-1 shadow-sm h-full">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <Icon name={f.icon} className="text-xl" />
                    </div>
                    <CardTitle className="text-lg">{f.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Showcase Slider */}
      <section className="py-20 bg-background overflow-hidden border-b border-border">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
                สัมผัสประสบการณ์ <span className="text-primary">ระดับพรีเมียม</span>
              </h2>
              <p className="text-muted-foreground text-lg">
                ระบบถูกออกแบบมาให้ทันสมัย ใช้งานง่าย และรองรับทุกความต้องการของเซิร์ฟเวอร์มายคราฟ
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full w-12 h-12"
                onClick={(e) => { e.stopPropagation(); prevImage(); }}
                aria-label="ก่อนหน้า"
              >
                <Icon name="chevron-left" />
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                className="rounded-full w-12 h-12"
                onClick={(e) => { e.stopPropagation(); nextImage(); }}
                aria-label="ถัดไป"
              >
                <Icon name="chevron-right" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="flex gap-6 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center"
                >
                  {/* Image Side - Fixed Height, Contain to show details */}
                  <div className="lg:col-span-7 relative group cursor-pointer" onClick={() => setSelectedImage(currentIndex)}>
                    <div className="overflow-hidden rounded-[2rem] border border-border bg-secondary/30 shadow-xl relative h-[300px] md:h-[500px] flex items-center justify-center">
                      <motion.img 
                        src={showcase[currentIndex].src} 
                        alt={showcase[currentIndex].title}
                        className="max-w-full max-h-full object-contain p-4"
                        initial={{ scale: 0.95 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.5 }}
                      />
                      <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-2 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-full text-foreground text-xs font-bold border border-border shadow-sm">
                          <Icon name="search-plus" />
                          <span>ดูรูปขยาย</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Text Side */}
                  <div className="lg:col-span-5 space-y-8">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, duration: 0.5 }}
                      className="space-y-6"
                    >
                      <Badge variant="outline" className="text-primary border-primary/20 px-4 py-1.5 text-sm rounded-full">
                        ตัวอย่างฟีเจอร์
                      </Badge>
                      <h3 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
                        {showcase[currentIndex].title}
                      </h3>
                      <p className="text-xl text-muted-foreground leading-relaxed">
                        {showcase[currentIndex].desc}
                      </p>
                    </motion.div>
                    
                    <div className="flex gap-3 pt-4">
                      {showcase.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentIndex(i)}
                          className={`h-2.5 rounded-full transition-all duration-500 ${
                            i === currentIndex ? 'w-10 bg-primary shadow-lg shadow-primary/20' : 'w-2.5 bg-muted hover:bg-muted-foreground/30'
                          }`}
                          aria-label={`Go to slide ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Lightbox / Zoom Modal */}
        <AnimatePresence>
          {selectedImage !== null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
              onClick={() => setSelectedImage(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-7xl w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
              >
                <img 
                  src={showcase[selectedImage].src} 
                  alt={showcase[selectedImage].title}
                  className="max-w-full max-h-full object-contain rounded-xl shadow-2xl border border-border"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-0 right-0 md:-top-12 md:-right-12 text-foreground hover:bg-primary/10 rounded-full"
                  onClick={() => setSelectedImage(null)}
                  aria-label="ปิด"
                >
                  <Icon name="times" className="text-2xl" />
                </Button>
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background to-transparent text-center">
                   <h4 className="text-xl font-bold text-foreground">{showcase[selectedImage].title}</h4>
                   <p className="text-muted-foreground">{showcase[selectedImage].desc}</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-background relative">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
            <h2 className="text-4xl md:text-6xl font-black text-foreground mb-6 tracking-tight">เลือกแพ็กเกจที่เหมาะกับคุณ</h2>
            <p className="text-muted-foreground text-lg font-medium leading-relaxed">
              ทุกแพ็กเกจได้รับฟีเจอร์ระดับพรีเมียมครบทุกอย่าง พร้อมระบบอัปเดตเวอร์ชันล่าสุดให้อัตโนมัติ ฟรีตลอดการใช้งาน
            </p>
            <div className="mt-6 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-sm">
              <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-500 text-white px-2 py-0.5 rounded-full">ใหม่</span>
              <Icon name="wallet" />
              รองรับเติมเงินผ่าน TrueMoney อั่งเปา แล้ว ใช้ฟรี ไม่มีค่าธรรมเนียมเพิ่ม
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Promo / Trial */}
            {promos.find(p => p.kind === 'trial') && (
              <PackageCard pkg={promos.find(p => p.kind === 'trial')} isTrial onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}

            {/* Intro Promo (Best Value) */}
            {promos.find(p => p.kind === 'intro') && (
              <PackageCard pkg={promos.find(p => p.kind === 'intro')} isPromo onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}

            {/* Standard Package */}
            {packages.length > 0 && (
              <PackageCard pkg={packages[1] || packages[0]} onShowEasySlip={() => setShowEasySlipPlan(true)} />
            )}
          </div>
        </div>
      </section>

      {/* EasySlip Plan Modal */}
      <AnimatePresence>
        {showEasySlipPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
            onClick={() => setShowEasySlipPlan(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative max-w-2xl w-full flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-2xl">
                <div className="p-4 border-b border-border flex justify-between items-center bg-secondary/30">
                   <h4 className="font-black text-foreground text-sm">รายละเอียดค่าบริการ EasySlip</h4>
                   <Button variant="ghost" size="icon" onClick={() => setShowEasySlipPlan(false)} className="rounded-full w-8 h-8" aria-label="ปิด">
                     <Icon name="times" className="text-xs" />
                   </Button>
                </div>
                <div className="p-2 bg-white">
                  <img 
                    src="/images/easy_slip_plan.png" 
                    alt="EasySlip Pricing Plan"
                    className="w-full h-auto rounded-xl"
                  />
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Stats Section */}
      <section className="py-24 bg-secondary/30 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center group"
              >
                <div className="w-16 h-16 rounded-2xl bg-background shadow-sm flex items-center justify-center mx-auto mb-6 text-primary border border-border group-hover:scale-110 transition-transform">
                  <Icon name={stat.icon} className="text-2xl" />
                </div>
                <h4 className="text-3xl md:text-4xl font-black text-foreground mb-2">{stat.value}</h4>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      </section>

      {/* Footer */}
      <footer className="bg-background py-16 border-t border-border relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            <div className="md:col-span-5 space-y-6">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/images/logosiamsite-h256.png"
                  alt="SIAMSITE logo"
                  width={84}
                  height={56}
                  className="h-14 w-auto object-contain"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-xl tracking-tight leading-none">SIAMSITE</span>
                  <span className="text-[10px] font-bold text-primary tracking-[0.2em] mt-1">MANAGER</span>
                </div>
              </Link>
              <p className="text-muted-foreground text-base leading-relaxed max-w-sm font-medium">
                บริการแพลตฟอร์มจัดการร้านค้า Minecraft สำหรับเซิร์ฟเวอร์ไทย ที่เน้นความง่าย ความเสถียร และความเป็นมืออาชีพ
              </p>
              <div className="flex items-center gap-4 pt-2">
                <a href="https://www.facebook.com/siamsitestore" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
                  <Icon name="facebook-f" />
                </a>
                <a href="https://discord.gg/HysqVHra5n" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="w-10 h-10 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
                  <Icon name="discord" />
                </a>
              </div>
            </div>
            
            <div className="md:col-span-2 space-y-6">
              <h4 className="font-bold text-foreground text-lg">เมนูหลัก</h4>
              <ul className="space-y-4 text-muted-foreground font-semibold text-sm">
                <li><Link href="/" className="hover:text-primary transition-colors">หน้าแรก</Link></li>
                <li><Link href="/#features" className="hover:text-primary transition-colors">ฟีเจอร์เด่น</Link></li>
                <li><Link href="/#pricing" className="hover:text-primary transition-colors">ราคาแพ็กเกจ</Link></li>
                <li><Link href="/solutions" className="hover:text-primary transition-colors">บริการเช่าเว็บร้านค้า</Link></li>
                <li><Link href="/lp/เช่าเว็บร้านค้ามายคราฟ" className="hover:text-primary transition-colors">เช่าเว็บร้านค้ามายคราฟ</Link></li>
                <li><Link href="/lp/ทางเลือกแทน-tebex" className="hover:text-primary transition-colors">ทางเลือกแทน Tebex</Link></li>
              </ul>
            </div>

            <div className="md:col-span-2 space-y-6">
              <h4 className="font-bold text-foreground text-lg">นโยบายและกฎหมาย</h4>
              <ul className="space-y-4 text-muted-foreground font-semibold text-sm">
                <li><Link href="/terms" className="hover:text-primary transition-colors">ข้อกำหนดการใช้บริการ</Link></li>
                <li><Link href="/privacy" className="hover:text-primary transition-colors">นโยบายความเป็นส่วนตัว</Link></li>
                <li><Link href="/shop-owner-agreement" className="hover:text-primary transition-colors">ข้อตกลงเจ้าของร้าน</Link></li>
                <li><Link href="/payment-policy" className="hover:text-primary transition-colors">การชำระเงินและการจ่ายเงิน</Link></li>
                <li><Link href="/prohibited-content" className="hover:text-primary transition-colors">สินค้าและเนื้อหาต้องห้าม</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">ติดต่อเรา</Link></li>
              </ul>
            </div>

            <div className="md:col-span-3 space-y-6">
              <h4 className="font-bold text-foreground text-lg">ความปลอดภัย</h4>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Icon name="shield-check" className="text-emerald-500 text-xl" />
                  <div>
                    <p className="text-xs font-bold text-foreground">การเชื่อมต่อที่ปลอดภัย (SSL)</p>
                    <p className="text-[10px] text-muted-foreground">เข้ารหัสข้อมูลระดับสูง</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-amber-500/5 border border-amber-500/10">
                  <Icon name="qrcode" className="text-amber-500 text-xl" />
                  <div>
                    <p className="text-xs font-bold text-foreground">ยืนยันผ่าน PromptPay</p>
                    <p className="text-[10px] text-muted-foreground">ตรวจสอบสลิปอัตโนมัติ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-20 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
            <p className="text-sm text-muted-foreground font-semibold">
              &copy; {new Date().getFullYear()} SIAMSITE STORE. All rights reserved.
            </p>
            <div className="flex items-center gap-2.5 text-[11px] font-semibold text-muted-foreground/70">
              <Icon name="lock" className="text-emerald-500/80" />
              <span>ชำระเงินปลอดภัย</span>
              <span className="text-border">•</span>
              <Icon name="bolt" className="text-amber-500/80" />
              <span>ระบบเสถียร 99.9%</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      {/* Only the search-param reader sits behind Suspense, so the page itself
          still prerenders to static HTML for crawlers. */}
      <Suspense fallback={null}>
        <AuthCodeExchange />
      </Suspense>
      <LandingContent />
    </>
  );
}
