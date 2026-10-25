import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { Star, Truck, ShieldCheck, ArrowLeft, ShoppingBag, Send, CheckCircle, ZoomIn, X, ChevronLeft, ChevronRight, Images, ChevronDown, ChevronUp, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SafeImage } from '../components/SafeImage';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

interface Book {
    book_id: string;
    title: string;
    price: string | number;
    cover_url: string | null;
    extra_images?: string[] | null;
    category?: string;
    categories?: { category_id: string; name: string; parent?: { name: string } }[];
    author?: string;
    avg_rating?: number;
    rating_count?: number;
    compare_price?: number;
    description?: string;
    isbn?: string;
    publisher?: string;
    page_count?: number;
    publish_year?: number;
    language?: string;
}

// ─── Product Gallery Component ────────────────────────────────────────────────

function ProductGallery({ cover_url, extra_images, title }: {
    cover_url: string | null;
    extra_images?: string[] | null;
    title: string;
}) {
    // Build full image list: cover + extras
    const allImages: string[] = [
        cover_url || 'https://placehold.co/400x600',
        ...((extra_images && Array.isArray(extra_images)) ? extra_images.filter(Boolean) : []),
    ];

    const [activeIdx, setActiveIdx] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState(0);
    const { t } = useTranslation();

    const openLightbox = (idx: number) => { setLightboxIdx(idx); setLightboxOpen(true); };
    const closeLightbox = useCallback(() => setLightboxOpen(false), []);
    const lbPrev = useCallback(() => setLightboxIdx(i => (i - 1 + allImages.length) % allImages.length), [allImages.length]);
    const lbNext = useCallback(() => setLightboxIdx(i => (i + 1) % allImages.length), [allImages.length]);

    // Keyboard nav for lightbox
    useEffect(() => {
        if (!lightboxOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') lbPrev();
            if (e.key === 'ArrowRight') lbNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [lightboxOpen, closeLightbox, lbPrev, lbNext]);

    return (
        <div className="w-full">
            {/* Main Image */}
            <div
                className="relative rounded-2xl overflow-hidden bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border shadow-sm cursor-zoom-in group"
                onClick={() => openLightbox(activeIdx)}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIdx}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-center justify-center p-6 aspect-3/4"
                    >
                        <SafeImage
                            src={allImages[activeIdx]}
                            alt={`${title} - ${t('bookDetail.ariaImagePrefix')} ${activeIdx + 1}`}
                            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal"
                        />
                    </motion.div>
                </AnimatePresence>

                {/* Zoom hint */}
                <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 dark:bg-dark-surface/80 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                    <ZoomIn className="w-4 h-4 text-slate-600 dark:text-dark-text-muted" />
                </div>

                {/* Image counter badge */}
                {allImages.length > 1 && (
                    <div className="absolute bottom-3 left-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm flex items-center gap-1">
                        <Images className="w-3 h-3" />
                        {activeIdx + 1} / {allImages.length}
                    </div>
                )}
            </div>

            {/* Thumbnail Strip */}
            {allImages.length > 1 && (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {allImages.map((img, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveIdx(i)}
                            className={`shrink-0 w-16 h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-white dark:bg-dark-surface ${i === activeIdx
                                    ? 'border-indigo-500 shadow-md shadow-indigo-100 dark:shadow-none scale-105'
                                    : 'border-slate-200 dark:border-dark-border opacity-60 hover:opacity-100 hover:border-slate-400 dark:hover:border-slate-600'
                                }`}
                            aria-label={`${t('bookDetail.ariaThumb')} ${i + 1}`}
                        >
                            <SafeImage
                                src={img}
                                alt={`Thumbnail ${i + 1}`}
                                className="w-full h-full object-contain p-1 mix-blend-multiply dark:mix-blend-normal"
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            <AnimatePresence>
                {lightboxOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-9999 bg-black/90 backdrop-blur-md flex items-center justify-center"
                        onClick={closeLightbox}
                    >
                        {/* Close button */}
                        <button
                            onClick={closeLightbox}
                            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                            aria-label={t('bookDetail.ariaClose')}
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Prev */}
                        {allImages.length > 1 && (
                            <button
                                onClick={e => { e.stopPropagation(); lbPrev(); }}
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                                aria-label={t('bookDetail.ariaPrev')}
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                        )}

                        {/* Image */}
                        <motion.div
                            key={lightboxIdx}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-2xl max-h-[80vh] w-full px-16"
                            onClick={e => e.stopPropagation()}
                        >
                            <SafeImage
                                src={allImages[lightboxIdx]}
                                alt={`${title} - ${t('bookDetail.ariaImagePrefix')} ${lightboxIdx + 1}`}
                                className="w-full h-full object-contain max-h-[80vh] rounded-xl"
                            />
                        </motion.div>

                        {/* Next */}
                        {allImages.length > 1 && (
                            <button
                                onClick={e => { e.stopPropagation(); lbNext(); }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors z-10"
                                aria-label={t('bookDetail.ariaNext')}
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        )}

                        {/* Dots */}
                        {allImages.length > 1 && (
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                                {allImages.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={e => { e.stopPropagation(); setLightboxIdx(i); }}
                                        className="h-2 rounded-full transition-all duration-300"
                                        style={{
                                            width: i === lightboxIdx ? '24px' : '8px',
                                            background: i === lightboxIdx ? 'white' : 'rgba(255,255,255,0.3)',
                                        }}
                                        aria-label={`${t('bookDetail.ariaImagePrefix')} ${i + 1}`}
                                    />
                                ))}
                            </div>
                        )}

                        {/* Thumbnail strip in lightbox */}
                        {allImages.length > 1 && (
                            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 flex gap-2 px-4 max-w-full overflow-x-auto no-scrollbar">
                                {allImages.map((img, i) => (
                                    <button
                                        key={i}
                                        onClick={e => { e.stopPropagation(); setLightboxIdx(i); }}
                                        className={`shrink-0 w-12 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === lightboxIdx ? 'border-white scale-110' : 'border-white/30 opacity-50 hover:opacity-80'
                                            }`}
                                    >
                                        <SafeImage src={img} alt={`Thumb ${i + 1}`} className="w-full h-full object-contain bg-white/10 p-0.5" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

interface Review {
    review_id: string;
    rating: number;
    title?: string;
    body?: string;
    helpful_count: number;
    created_at: string;
    user: { full_name: string; email: string };
}

const API = `${API_BASE_URL}`;

const StarRating = ({ value, onChange }: { value: number; onChange?: (v: number) => void }) => (
    <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
            <Star
                key={i}
                onClick={() => onChange?.(i)}
                className={`w-5 h-5 transition-colors ${onChange ? 'cursor-pointer' : ''} ${i <= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200 dark:fill-slate-700 dark:text-slate-700'
                    }`}
            />
        ))}
    </div>
);

interface SimilarBook {
    book_id: string;
    title: string;
    price: number;
    cover_url: string | null;
    avg_rating: number;
    author: string;
}

export function BookDetail() {
    const { bookId } = useParams<{ bookId: string }>();
    const [book, setBook] = useState<Book | null>(null);
    const [loading, setLoading] = useState(true);
    const [quantity, setQuantity] = useState(1);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(false);
    const [reviewPage, setReviewPage] = useState(1);
    const [reviewTotal, setReviewTotal] = useState(0);
    const [similarBooks, setSimilarBooks] = useState<SimilarBook[]>([]);
    const similarScrollRef = useRef<HTMLDivElement>(null);

    const [isDescExpanded, setIsDescExpanded] = useState(true);

    const [showReviewForm, setShowReviewForm] = useState(false);
    const [newRating, setNewRating] = useState(5);
    const [newTitle, setNewTitle] = useState('');
    const [newBody, setNewBody] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    const { token, guestId, fetchCart, handleAddToCart: handleAddToCartGlobal } = useCart();
    const { toast } = useToast();
    const { t, i18n } = useTranslation();

    const formatPrice = (price: string | number) => {
        const numPrice = Number(price);
        if (i18n.language === 'en') {
            const usdPrice = numPrice / 25000;
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
    };


    useEffect(() => {
        if (!bookId) return;
        setLoading(true);
        fetch(`${API}/books/${bookId}`)
            .then(res => res.ok ? res.json() : null)
            .then(data => { setBook(data); setLoading(false); })
            .catch(() => setLoading(false));
    }, [bookId]);

    // ── Behavior Tracking: ghi nhận view sau 3 giây ──
    useEffect(() => {
        if (!bookId) return;
        const timer = setTimeout(() => {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;
            fetch(`${API}/behavior/track`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ event_type: 'view', book_id: bookId, duration_sec: 3 }),
            }).catch(() => {/* non-critical */});
        }, 3000);
        return () => clearTimeout(timer);
    }, [bookId, token]);

    // ── Load similar books ──
    useEffect(() => {
        if (!bookId) return;
        fetch(`${API}/recommendations/similar/${bookId}?limit=8`)
            .then(r => r.json())
            .then(data => setSimilarBooks(data.data || []))
            .catch(() => {});
    }, [bookId]);

    const loadReviews = (page = 1) => {
        if (!bookId) return;
        setReviewsLoading(true);
        fetch(`${API}/reviews/book/${bookId}?page=${page}&limit=5`)
            .then(res => res.json())
            .then(data => {
                setReviews(data.data || []);
                setReviewTotal(data.meta?.total || 0);
                setReviewPage(page);
                setReviewsLoading(false);
            })
            .catch(() => setReviewsLoading(false));
    };

    useEffect(() => { loadReviews(1); }, [bookId]);

    const handleAddToCart = async () => {
        if (!book) return;
        // Khách chưa đăng nhập vẫn thêm được giỏ (gắn theo guest_id), giống thẻ sách ở trang chủ
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
            headers.Authorization = `Bearer ${token}`;
        } else {
            headers['x-guest-id'] = guestId;
        }
        const res = await fetch(`${API}/cart/add`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ bookId: book.book_id, quantity }),
        });
        if (res.ok) { fetchCart(); toast(t('bookDetail.addedToCart', { qty: quantity, title: book.title }), 'success'); }
        else toast(t('bookDetail.errorAddToCart'), 'error');
    };

    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) { toast(t('bookDetail.loginToReview'), 'info'); return; }
        if (!book) return;
        setSubmitting(true);
        try {
            const res = await fetch(`${API}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ book_id: book.book_id, rating: newRating, title: newTitle, body: newBody }),
            });
            if (res.ok) {
                setSubmitSuccess(true);
                setShowReviewForm(false);
                setNewTitle(''); setNewBody(''); setNewRating(5);
                setTimeout(() => setSubmitSuccess(false), 4000);
            } else {
                const err = await res.json();
                toast(err.message || t('bookDetail.errorReview'), 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return (
        <div className="bg-slate-50 dark:bg-dark-bg min-h-screen py-20 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-dark-accent" />
        </div>
    );

    if (!book) return (
        <div className="bg-slate-50 dark:bg-dark-bg min-h-screen py-20 text-center flex flex-col items-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-dark-text mb-4">{t('bookDetail.notFound')}</h2>
            <Link to="/search" className="flex items-center gap-2 text-indigo-600 dark:text-dark-accent hover:text-indigo-800 dark:hover:text-dark-accent-hover font-medium">
                <ArrowLeft className="w-4 h-4" /> {t('bookDetail.backToStore')}
            </Link>
        </div>
    );

    const totalReviewPages = Math.ceil(reviewTotal / 5);

    return (
        <div className="bg-slate-50 dark:bg-dark-bg min-h-screen py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                <Link to="/search" className="inline-flex items-center gap-2 text-slate-500 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent mb-4 transition-colors font-medium">
                    <ArrowLeft className="w-5 h-5" /> {t('bookDetail.backToSearch')}
                </Link>

                <div className="grid md:grid-cols-12 gap-8 mb-8">


                    <motion.div
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        className="md:col-span-5 lg:col-span-4 bg-white dark:bg-dark-surface rounded-3xl p-4 md:p-6 shadow-sm border border-slate-100 dark:border-dark-border self-start sticky top-28"
                    >
                        <ProductGallery
                            cover_url={book.cover_url}
                            extra_images={book.extra_images}
                            title={book.title}
                        />
                    </motion.div>


                    <motion.div
                        initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                        className="md:col-span-7 lg:col-span-8 bg-white dark:bg-dark-surface rounded-3xl p-6 md:px-12 md:py-8 shadow-sm border border-slate-100 dark:border-dark-border flex flex-col"
                    >
                        <div className="text-sm font-semibold text-indigo-600 dark:text-dark-accent mb-2 uppercase tracking-wider flex flex-wrap gap-2">
                            {book.categories && book.categories.length > 0
                                ? Array.from(new Set(book.categories.flatMap(cat => cat.parent ? [cat.parent.name, cat.name] : [cat.name]))).join(' • ')
                                : (book.category || t('bookDetail.category'))}
                        </div>
                        <h1 className="text-3xl md:text-5xl font-serif font-bold text-slate-900 dark:text-dark-text mb-2 leading-tight">
                            {book.title}
                        </h1>
                        <p className="text-lg text-slate-600 dark:text-dark-text-muted mb-2 font-medium">
                            {t('bookDetail.author')} <span className="text-indigo-600 dark:text-dark-accent">{book.author || t('bookDetail.updating')}</span>
                        </p>

                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-100 dark:border-dark-border">
                            <StarRating value={Math.round(Number(book.avg_rating) || 0)} />
                            <span className="text-slate-700 dark:text-dark-text font-bold">{Number(book.avg_rating || 0).toFixed(1)}</span>
                            <span className="text-slate-400 dark:text-dark-text-muted">({book.rating_count || 0} {t('bookDetail.reviewsCount')})</span>
                        </div>

                        <div className="flex items-end gap-4 mb-3">
                            <span className="text-4xl font-bold text-slate-900 dark:text-dark-text">{formatPrice(book.price)}</span>
                            {book.compare_price && (
                                <span className="text-xl text-slate-400 dark:text-dark-text-muted line-through mb-1">{formatPrice(book.compare_price)}</span>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                            <div className="flex items-center border border-slate-200 dark:border-dark-border rounded-full bg-slate-50 dark:bg-dark-bg w-full sm:w-32 h-12">
                                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-12 h-full flex items-center justify-center text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent font-bold text-xl">-</button>
                                <span className="flex-1 text-center font-bold text-slate-900 dark:text-dark-text">{quantity}</span>
                                <button onClick={() => setQuantity(quantity + 1)} className="w-12 h-full flex items-center justify-center text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent font-bold text-xl">+</button>
                            </div>
                            <button
                                onClick={handleAddToCart}
                                className="w-full sm:flex-1 flex items-center justify-center gap-2 bg-indigo-600 dark:bg-dark-accent text-white h-12 rounded-full font-bold hover:bg-indigo-700 dark:hover:bg-dark-accent-hover transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                                <ShoppingBag className="w-5 h-5" /> {t('bookDetail.addToCart')}
                            </button>
                        </div>

                        <div className="mb-4 border-b border-slate-100 dark:border-dark-border pb-2">
                            <button 
                                onClick={() => setIsDescExpanded(!isDescExpanded)}
                                className="w-full flex items-center justify-between text-2xl font-serif font-bold text-slate-900 dark:text-dark-text mb-2"
                            >
                                {t('bookDetail.description')}
                                {isDescExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </button>
                            
                            <AnimatePresence>
                                {isDescExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="text-slate-600 dark:text-dark-text-muted leading-relaxed pb-4 whitespace-pre-wrap">
                                            {book.description || t('bookDetail.descriptionPlaceholder')}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="bg-slate-50 dark:bg-dark-bg p-6 rounded-2xl mb-8 border border-slate-100 dark:border-dark-border">
                            <h3 className="font-bold text-slate-900 dark:text-dark-text text-lg mb-4">{t('bookDetail.details')}</h3>
                            <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                                {[
                                    [t('bookDetail.isbn'), book.isbn],
                                    [t('bookDetail.publisher'), book.publisher],
                                    [t('bookDetail.publishYear'), book.publish_year],
                                    [t('bookDetail.pages'), book.page_count ? t('bookDetail.pagesCount', { count: book.page_count }) : null],
                                    [t('bookDetail.language'), book.language === 'vi' ? t('bookDetail.vietnamese') : book.language === 'en' ? t('bookDetail.english') : book.language],
                                ].map(([label, val]) => (
                                    <div key={label}>
                                        <span className="text-slate-500 dark:text-dark-text-muted block mb-1">{label}</span>
                                        <span className="font-medium text-slate-900 dark:text-dark-text">{val || t('bookDetail.updating')}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 p-6 bg-slate-50 dark:bg-dark-bg rounded-2xl border border-slate-100 dark:border-dark-border mt-auto">
                            <div className="flex items-center gap-3 text-slate-700 dark:text-dark-text">
                                <Truck className="w-5 h-5 text-indigo-600 dark:text-dark-accent" />
                                <span className="font-medium">{t('bookDetail.freeShipping')}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-700 dark:text-dark-text">
                                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                <span className="font-medium">{t('bookDetail.genuineReturn')}</span>
                            </div>
                        </div>
                    </motion.div>
                </div>


                <div className="bg-white dark:bg-dark-surface rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-text">
                            {t('bookDetail.readerReviews')}
                            <span className="ml-2 text-base font-normal text-slate-400 dark:text-dark-text-muted">({reviewTotal} {t('bookDetail.reviewsCount')})</span>
                        </h2>
                        {token && !showReviewForm && (
                            <button
                                onClick={() => setShowReviewForm(true)}
                                className="flex items-center gap-2 bg-indigo-600 dark:bg-dark-accent text-white px-5 py-2.5 rounded-full font-semibold hover:bg-indigo-700 dark:hover:bg-dark-accent-hover transition-colors text-sm"
                            >
                                <Send className="w-4 h-4" /> {t('bookDetail.writeReview')}
                            </button>
                        )}
                    </div>


                    <AnimatePresence>
                        {submitSuccess && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                                className="mb-6 flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-2xl p-4"
                            >
                                <CheckCircle className="w-5 h-5 shrink-0" />
                                <span>{t('bookDetail.reviewThanks')}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>


                    <AnimatePresence>
                        {showReviewForm && (
                            <motion.form
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                onSubmit={handleSubmitReview}
                                className="mb-8 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl p-6 border border-indigo-100 dark:border-indigo-900"
                            >
                                <h3 className="font-bold text-slate-900 dark:text-dark-text mb-4">{t('bookDetail.yourReview')}</h3>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 dark:text-dark-text-muted mb-2">{t('bookDetail.stars')}</label>
                                    <StarRating value={newRating} onChange={setNewRating} />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 dark:text-dark-text-muted mb-2">{t('bookDetail.titleOptional')}</label>
                                    <input
                                        type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                                        placeholder={t('bookDetail.titlePlaceholder')}
                                        className="w-full border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="block text-sm text-slate-600 dark:text-dark-text-muted mb-2">{t('bookDetail.reviewContent')}</label>
                                    <textarea
                                        value={newBody} onChange={e => setNewBody(e.target.value)}
                                        placeholder={t('bookDetail.reviewPlaceholder')}
                                        rows={4}
                                        className="w-full border border-slate-200 dark:border-dark-border rounded-xl px-4 py-2.5 text-sm dark:bg-dark-surface dark:text-dark-text dark:placeholder:text-dark-text-muted focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button type="submit" disabled={submitting}
                                        className="bg-indigo-600 dark:bg-dark-accent text-white px-6 py-2.5 rounded-full font-semibold hover:bg-indigo-700 dark:hover:bg-dark-accent-hover disabled:opacity-50 transition-colors text-sm"
                                    >
                                        {submitting ? t('bookDetail.sending') : t('bookDetail.submitReview')}
                                    </button>
                                    <button type="button" onClick={() => setShowReviewForm(false)}
                                        className="text-slate-500 dark:text-dark-text-muted hover:text-slate-700 dark:hover:text-dark-text px-4 py-2.5 rounded-full text-sm transition-colors"
                                    >
                                        {t('bookDetail.cancel')}
                                    </button>
                                </div>
                            </motion.form>
                        )}
                    </AnimatePresence>


                    {reviewsLoading ? (
                        <div className="flex justify-center py-10">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-dark-accent" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-12 text-slate-400 dark:text-dark-text-muted">
                            <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>{t('bookDetail.noReviews')}</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {reviews.map(review => (
                                <motion.div
                                    key={review.review_id}
                                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                                    className="border-b border-slate-100 dark:border-dark-border pb-6 last:border-0"
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <span className="font-semibold text-slate-900 dark:text-dark-text">{review.user?.full_name || t('bookDetail.anonymous')}</span>
                                            <span className="text-slate-400 dark:text-dark-text-muted text-sm ml-2">{new Date(review.created_at).toLocaleDateString('vi-VN')}</span>
                                        </div>
                                        <StarRating value={review.rating} />
                                    </div>
                                    {review.title && <p className="font-semibold text-slate-800 dark:text-dark-text mb-1">{review.title}</p>}
                                    {review.body && <p className="text-slate-600 dark:text-dark-text-muted text-sm leading-relaxed">{review.body}</p>}
                                    {review.helpful_count > 0 && (
                                        <p className="text-xs text-slate-400 dark:text-dark-text-muted mt-2">{t('bookDetail.helpfulCount', { count: review.helpful_count })}</p>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    )}


                    {totalReviewPages > 1 && (
                        <div className="flex justify-center gap-2 mt-8">
                            {Array.from({ length: totalReviewPages }, (_, i) => i + 1).map(p => (
                                <button
                                    key={p} onClick={() => loadReviews(p)}
                                    className={`w-9 h-9 rounded-full text-sm font-semibold transition-colors ${p === reviewPage ? 'bg-indigo-600 dark:bg-dark-accent text-white' : 'bg-slate-100 dark:bg-dark-surface-hover text-slate-600 dark:text-dark-text-muted hover:bg-slate-200 dark:hover:bg-slate-700'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Sách tương tự ── */}
                {similarBooks.length > 0 && (
                    <div className="mt-8 bg-white dark:bg-dark-surface rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-dark-border">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-dark-text">{t('bookDetail.similarBooks')}</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => similarScrollRef.current?.scrollBy({ left: -300, behavior: 'smooth' })}
                                    className="w-8 h-8 rounded-full border border-gray-300 dark:border-dark-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-dark-surface-hover text-slate-600 dark:text-dark-text-muted"
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={() => similarScrollRef.current?.scrollBy({ left: 300, behavior: 'smooth' })}
                                    className="w-8 h-8 rounded-full border border-gray-300 dark:border-dark-border flex items-center justify-center hover:bg-gray-50 dark:hover:bg-dark-surface-hover text-slate-600 dark:text-dark-text-muted"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                        <div ref={similarScrollRef} className="flex overflow-x-auto gap-4 pb-4 snap-x no-scrollbar scroll-smooth">
                            {similarBooks.map((sb, idx) => (
                                <div key={`sim-${sb.book_id}-${idx}`} className="w-[150px] md:w-[170px] shrink-0 snap-start bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-xl overflow-hidden hover:shadow-md dark:hover:shadow-none transition-shadow flex flex-col group">
                                    <Link to={`/book/${sb.book_id}`} className="block relative overflow-hidden bg-slate-50 dark:bg-dark-bg p-3 aspect-2/3">
                                        <SafeImage
                                            src={sb.cover_url || 'https://placehold.co/200x300'}
                                            alt={sb.title}
                                            className="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal group-hover:scale-105 transition-transform duration-300"
                                        />
                                    </Link>
                                    <div className="p-3 flex flex-col flex-1">
                                        <Link to={`/book/${sb.book_id}`}>
                                            <h3 className="text-xs font-semibold text-slate-900 dark:text-dark-text line-clamp-2 hover:text-indigo-600 dark:hover:text-dark-accent transition-colors mb-1">{sb.title}</h3>
                                        </Link>
                                        <p className="text-xs text-slate-500 dark:text-dark-text-muted mb-1 truncate">{sb.author}</p>
                                        {sb.avg_rating > 0 && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                <span className="text-xs text-slate-600 dark:text-dark-text-muted">{Number(sb.avg_rating).toFixed(1)}</span>
                                            </div>
                                        )}
                                        <p className="text-indigo-600 dark:text-dark-accent font-bold text-sm mt-auto">
                                            {formatPrice(sb.price)}
                                        </p>
                                        <button
                                            onClick={() => handleAddToCartGlobal(sb.book_id)}
                                            className="mt-2 w-full bg-slate-900 dark:bg-dark-surface-hover text-white py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-600 dark:hover:bg-dark-accent transition-colors flex items-center justify-center gap-1"
                                        >
                                            <ShoppingCart className="w-3 h-3" /> {t('bookDetail.addToCartShort')}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}