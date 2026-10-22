import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ChevronLeft, ChevronRight, Tag, Zap, BookOpen, Gift, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { SafeImage } from './SafeImage';

// ─── Slideshow toàn trang: "Khám phá thế giới" + 3 slide khuyến mãi ───────────

const PROMO_SLIDES = [
  {
    id: 'promo-1',
    badgeKey: 'slide1Badge',
    titleKey: 'slide1Title',
    subtitleKey: 'slide1Sub',
    descKey: 'slide1Desc',
    ctaKey: 'slide1Cta',
    ctaLink: '/search?sort=bestseller',
    tagKey: 'slide1Tag',
    gradient: 'bg-linear-to-br from-[#1a0533] via-[#2d0a5c] to-[#0f1a3d]',
    accent: '#a855f7',
    accentLight: '#e9d5ff',
    emojis: ['📚', '🎯', '⚡', '💜'],
  },
  {
    id: 'promo-2',
    badgeKey: 'slide2Badge',
    titleKey: 'slide2Title',
    subtitleKey: 'slide2Sub',
    descKey: 'slide2Desc',
    ctaKey: 'slide2Cta',
    ctaLink: '/new-books',
    tagKey: 'slide2Tag',
    gradient: 'bg-linear-to-br from-[#0c2340] via-[#0f3460] to-[#162040]',
    accent: '#38bdf8',
    accentLight: '#bae6fd',
    emojis: ['📖', '✨', '🌟', '💙'],
  },
  {
    id: 'promo-3',
    badgeKey: 'slide3Badge',
    titleKey: 'slide3Title',
    subtitleKey: 'slide3Sub',
    descKey: 'slide3Desc',
    ctaKey: 'slide3Cta',
    ctaLink: '/register',
    tagKey: 'slide3Tag',
    gradient: 'bg-linear-to-br from-[#1a2e05] via-[#1f3a0a] to-[#0d2013]',
    accent: '#4ade80',
    accentLight: '#bbf7d0',
    emojis: ['🎁', '🏆', '💚', '🌿'],
  },
];

function HomeSlideshow({ featuredBooks }: { featuredBooks: any[] }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(1);
  const total = PROMO_SLIDES.length + 1; // slide 0 = hero "Khám phá thế giới"

  const goTo = useCallback((index: number, dir: number) => {
    setDirection(dir);
    setCurrent(index);
  }, []);

  const prev = () => {
    const newIdx = (current - 1 + total) % total;
    goTo(newIdx, -1);
  };
  const next = useCallback(() => {
    const newIdx = (current + 1) % total;
    goTo(newIdx, 1);
  }, [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  };

  // Slide 0: hero "Khám phá thế giới qua từng trang sách"
  const renderHeroSlide = () => (
    <div className="grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-4xl md:text-6xl font-serif font-bold leading-tight mb-6 drop-shadow-md">
          {t('home.heroTitle')}<br /><span className="text-indigo-400">{t('home.heroTitleHighlight')}</span>
        </h1>
        <p className="text-lg text-indigo-100 mb-8 max-w-md hidden md:block">
          {t('home.heroDescription')}
        </p>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-950 font-bold rounded-full hover:bg-indigo-50 transition-colors"
        >
          {t('home.buyNow')} <ArrowRight className="w-5 h-5" />
        </Link>
      </div>
      <div className="hidden md:flex justify-end">
        <div className="grid grid-cols-2 gap-4">
          {featuredBooks[0] && (
            <Link to={`/book/${featuredBooks[0].book_id}`} className="block">
              <SafeImage src={featuredBooks[0].cover_url || 'https://placehold.co/300x450'} className="w-48 rounded-xl shadow-2xl -rotate-6 transform hover:rotate-0 transition-transform duration-500 object-cover aspect-2/3" alt={featuredBooks[0].title} />
            </Link>
          )}
          {featuredBooks[1] && (
            <Link to={`/book/${featuredBooks[1].book_id}`} className="block">
              <SafeImage src={featuredBooks[1].cover_url || 'https://placehold.co/300x450'} className="w-48 rounded-xl shadow-2xl rotate-6 translate-y-8 transform hover:rotate-0 transition-transform duration-500 object-cover aspect-2/3" alt={featuredBooks[1].title} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );

  const renderPromoSlide = (slide: typeof PROMO_SLIDES[number]) => (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
      {/* Text content */}
      <div className="flex-1 max-w-lg">
        <span
          className="inline-block text-sm font-semibold px-3 py-1 rounded-full mb-3"
          style={{ background: `${slide.accent}30`, color: slide.accentLight }}
        >
          {t(`promoBanner.${slide.badgeKey}`)}
        </span>

        <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-2">
          {t(`promoBanner.${slide.titleKey}`, { year: new Date().getFullYear() })}
        </h2>

        <p className="text-base md:text-lg font-medium mb-2" style={{ color: slide.accentLight }}>
          {t(`promoBanner.${slide.subtitleKey}`)}
        </p>

        <p className="text-sm text-white/60 mb-6 hidden md:block">
          {t(`promoBanner.${slide.descKey}`)}
        </p>

        <div className="flex items-center gap-3 flex-wrap">
          <Link
            to={slide.ctaLink}
            className="px-6 py-3 rounded-full font-bold text-sm text-white transition-all hover:scale-105 hover:shadow-lg shadow-md"
            style={{ background: slide.accent }}
          >
            {t(`promoBanner.${slide.ctaKey}`)}
          </Link>
          <span
            className="text-xs px-3 py-1.5 rounded-full font-medium"
            style={{ background: `${slide.accent}20`, color: slide.accentLight }}
          >
            🏷 {t(`promoBanner.${slide.tagKey}`)}
          </span>
        </div>
      </div>

      {/* Illustration */}
      <div className="hidden md:flex items-center justify-center w-48 h-48 relative">
        <div
          className="w-40 h-40 rounded-full flex items-center justify-center text-6xl"
          style={{ background: `${slide.accent}15`, border: `2px solid ${slide.accent}30` }}
        >
          {slide.emojis[0]}
        </div>
        {slide.emojis.slice(1).map((emoji, i) => (
          <motion.div
            key={i}
            animate={{ y: [0, -8, 0], rotate: [0, 10, 0] }}
            transition={{ duration: 2 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute text-3xl"
            style={{
              top: i === 0 ? '-10px' : i === 1 ? '60%' : '10px',
              right: i === 0 ? '10px' : i === 1 ? '-10px' : undefined,
              left: i === 2 ? '-10px' : undefined,
            }}
          >
            {emoji}
          </motion.div>
        ))}
      </div>
    </div>
  );

  const slide = current === 0 ? null : PROMO_SLIDES[current - 1];

  return (
    <section className="relative w-full overflow-hidden bg-indigo-950">
      <div className="relative min-h-[480px] md:min-h-[560px]">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={current}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className={`absolute inset-0 flex items-center text-white ${slide ? slide.gradient : 'bg-indigo-950'}`}
          >
            {slide === null && (
              <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/id/1073/1920/1080')] bg-cover bg-center mix-blend-overlay" />
            )}

            {slide && (
              <>
                {/* Decorative circles */}
                <div
                  className="absolute top-[-60px] right-[-60px] w-[300px] h-[300px] rounded-full opacity-10"
                  style={{ background: slide.accent }}
                />
                <div
                  className="absolute bottom-[-80px] left-[30%] w-[250px] h-[250px] rounded-full opacity-10"
                  style={{ background: slide.accent }}
                />
                <div
                  className="absolute top-[20%] right-[20%] w-[120px] h-[120px] rounded-full opacity-5"
                  style={{ background: slide.accentLight }}
                />
              </>
            )}

            <div className="relative z-10 w-full max-w-7xl mx-auto px-4 py-12 md:py-16">
              {slide === null ? renderHeroSlide() : renderPromoSlide(slide)}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Nav buttons */}
        <button
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
          aria-label="Trước"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all"
          aria-label="Tiếp"
        >
          <ChevronRight size={18} />
        </button>

        {/* Dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {Array.from({ length: total }).map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i, i > current ? 1 : -1)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === current ? '24px' : '8px',
                background: i === current ? 'white' : 'rgba(255,255,255,0.4)',
              }}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Countdown Timer ─────────────────────────────────────────────────────────

function useCountdown(targetDate: Date) {
  const calc = () => {
    const diff = targetDate.getTime() - Date.now();
    if (diff <= 0) return { hours: 0, minutes: 0, seconds: 0 };
    return {
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function CountdownBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-12 h-12 md:w-14 md:h-14 bg-red-600 rounded-lg flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-lg shadow-red-900/40 font-mono">
        {String(value).padStart(2, '0')}
      </div>
      <span className="text-xs text-red-300 mt-1 font-medium">{label}</span>
    </div>
  );
}

// ─── Flash Sale (toàn trang) ──────────────────────────────────────────────────

function FlashSaleSection() {
  const { t } = useTranslation();
  // Target: end of today
  const target = new Date();
  target.setHours(23, 59, 59, 0);
  const { hours, minutes, seconds } = useCountdown(target);

  return (
    <div className="w-full bg-linear-to-r from-red-900 via-red-800 to-rose-900 text-white overflow-hidden relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 0, transparent 50%)',
          backgroundSize: '20px 20px',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 md:py-7 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 animate-pulse">
            <Zap className="w-5 h-5 text-red-900" fill="currentColor" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold">{t('promoBanner.flashSaleTitle')}</h3>
              <span className="text-yellow-300 text-sm font-semibold bg-yellow-300/20 px-2 py-0.5 rounded">{t('promoBanner.flashSaleToday')}</span>
            </div>
            <p className="text-red-200 text-sm">{t('promoBanner.flashSaleEndsIn')}</p>
          </div>
        </div>

        <div className="flex items-end gap-2">
          <CountdownBox value={hours} label={t('promoBanner.flashSaleHours')} />
          <span className="text-red-300 font-bold text-2xl mb-3">:</span>
          <CountdownBox value={minutes} label={t('promoBanner.flashSaleMinutes')} />
          <span className="text-red-300 font-bold text-2xl mb-3">:</span>
          <CountdownBox value={seconds} label={t('promoBanner.flashSaleSeconds')} />
        </div>

        <Link
          to="/search?sort=bestseller"
          className="shrink-0 px-5 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-red-900 font-bold rounded-full text-sm transition-all hover:scale-105 shadow-lg"
        >
          {t('promoBanner.flashSaleBuyNow')}
        </Link>
      </div>
    </div>
  );
}

// ─── Promo Cards Grid (toàn trang) ────────────────────────────────────────────

const PROMO_CARDS = [
  {
    id: 'new',
    icon: BookOpen,
    emoji: '📚',
    titleKey: 'promoCard1Title',
    descKey: 'promoCard1Desc',
    discountKey: 'promoCard1Tag',
    bg: 'from-indigo-900 to-blue-900',
    accent: '#818cf8',
    link: '/new-books',
  },
  {
    id: 'deal',
    icon: Tag,
    emoji: '🏷',
    titleKey: 'promoCard2Title',
    descKey: 'promoCard2Desc',
    discountKey: 'promoCard2Tag',
    bg: 'from-orange-900 to-red-900',
    accent: '#fb923c',
    link: '/search?sort=bestseller',
  },
  {
    id: 'gift',
    icon: Gift,
    emoji: '🎁',
    titleKey: 'promoCard3Title',
    descKey: 'promoCard3Desc',
    discountKey: 'promoCard3Tag',
    bg: 'from-pink-900 to-rose-900',
    accent: '#f472b6',
    link: '/search',
  },
  {
    id: 'top',
    icon: Star,
    emoji: '⭐',
    titleKey: 'promoCard4Title',
    descKey: 'promoCard4Desc',
    discountKey: 'promoCard4Tag',
    bg: 'from-amber-900 to-yellow-900',
    accent: '#fbbf24',
    link: '/best-sellers',
  },
];

function PromoCards() {
  const { t } = useTranslation();
  return (
    <section className="w-full bg-white dark:bg-dark-surface border-y border-slate-200 dark:border-dark-border">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {PROMO_CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4 }}
              >
                <Link
                  to={card.link}
                  className={`block bg-linear-to-br ${card.bg} rounded-xl p-4 text-white relative overflow-hidden group transition-shadow hover:shadow-xl`}
                >
                  {/* Bg circle */}
                  <div
                    className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full opacity-20 group-hover:opacity-30 transition-opacity"
                    style={{ background: card.accent }}
                  />

                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                    style={{ background: `${card.accent}25` }}
                  >
                    <Icon className="w-5 h-5" style={{ color: card.accent }} />
                  </div>

                  <h4 className="font-bold text-sm md:text-base leading-tight mb-1">{t(`promoBanner.${card.titleKey}`)}</h4>
                  <p className="text-white/60 text-xs mb-3">{t(`promoBanner.${card.descKey}`)}</p>

                  <span
                    className="inline-block text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${card.accent}30`, color: card.accent }}
                  >
                    {t(`promoBanner.${card.discountKey}`)}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─── Coupon Banner (toàn trang) ───────────────────────────────────────────────

function CouponBanner() {
  const { t } = useTranslation();
  const [copied, setCopied] = useState<string | null>(null);

  const coupons = [
    { code: 'NEWUSER30', descKey: 'coupon1Desc', minKey: 'coupon1Min', color: '#6366f1' },
    { code: 'BOOK2026', descKey: 'coupon2Desc', minKey: 'coupon2Min', color: '#10b981' },
    { code: 'FLASH50', descKey: 'coupon3Desc', minKey: 'coupon3Min', color: '#f59e0b' },
  ];

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="w-full bg-linear-to-br from-slate-900 to-slate-800 border-y border-slate-700">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        <div className="flex items-center gap-2 mb-5">
          <Tag className="w-5 h-5 text-indigo-400" />
          <h3 className="text-white font-bold text-lg">{t('promoBanner.couponTitle')}</h3>
          <span className="ml-auto text-slate-400 text-xs">{t('promoBanner.couponCopyHint')}</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          {coupons.map((c) => (
            <button
              key={c.code}
              onClick={() => handleCopy(c.code)}
              className="text-left p-4 rounded-xl border-2 border-dashed transition-all hover:scale-[1.02] group relative overflow-hidden"
              style={{ borderColor: `${c.color}50`, background: `${c.color}10` }}
              title={`Nhấn để sao chép mã ${c.code}`}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

              <div className="flex items-center justify-between mb-2">
                <span
                  className="font-mono font-bold text-base tracking-wider"
                  style={{ color: c.color }}
                >
                  {c.code}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ background: `${c.color}20`, color: c.color }}
                >
                  {copied === c.code ? t('promoBanner.couponCopied') : t('promoBanner.couponCopy')}
                </span>
              </div>
              <p className="text-slate-300 text-sm font-medium">{t(`promoBanner.${c.descKey}`)}</p>
              <p className="text-slate-500 text-xs mt-1">{t(`promoBanner.${c.minKey}`)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function PromoBanner({ featuredBooks = [] }: { featuredBooks?: any[] }) {
  return (
    <div className="w-full">
      <HomeSlideshow featuredBooks={featuredBooks} />
      <FlashSaleSection />
      <PromoCards />
      <CouponBanner />
    </div>
  );
}
