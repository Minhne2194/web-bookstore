import { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ArrowRight, Tag, X, CheckCircle2, Star, ShoppingCart } from 'lucide-react';
import { motion } from 'framer-motion';
import { SafeImage } from '../components/SafeImage';
import { useToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

interface Book {
    book_id: string;
    title: string;
    price: string | number;
    cover_url: string | null;
    author?: string;
}

interface SimilarBook {
    book_id: string;
    title: string;
    price: number;
    cover_url: string | null;
    avg_rating: number;
    author: string;
}

const API = `${API_BASE_URL}`;

export function Cart() {
    const { token, guestId, cartItems, fetchCart, handleAddToCart } = useCart();
    const { toast } = useToast();
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [suggestions, setSuggestions] = useState<SimilarBook[]>([]);
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();

    const [promoCode, setPromoCode] = useState('');
    const [appliedPromo, setAppliedPromo] = useState<any>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

    useEffect(() => {
        if (!confirmRemoveId) return;
        const timer = setTimeout(() => setConfirmRemoveId(null), 3000);
        return () => clearTimeout(timer);
    }, [confirmRemoveId]);

    useEffect(() => {
        if (cartItems.length === 0) {
            setBooks([]);
            setLoading(false);
            return;
        }

        const ids = cartItems.map(item => item.bookId).join(',');
        
        setLoading(true);
        fetch(`${API}/books?ids=${ids}`)
            .then((res) => res.json())
            .then((resData) => {
                const data = resData.data ? resData.data : resData;
                setBooks(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error('Lỗi tải sách:', err);
                setLoading(false);
            });
    }, [cartItems]);

    // Load similar books for suggestions
    useEffect(() => {
        if (cartItems.length === 0) { setSuggestions([]); return; }
        const bookIds = cartItems.map(i => i.bookId).slice(0, 3); // limit to 3 to avoid too many requests
        Promise.all(
            bookIds.map(id =>
                fetch(`${API}/recommendations/similar/${id}?limit=6`)
                    .then(r => r.json())
                    .then(d => d.data || [])
                    .catch(() => [])
            )
        ).then(results => {
            const cartBookIds = new Set(cartItems.map(i => i.bookId));
            const merged = new Map<string, SimilarBook>();
            results.flat().forEach((book: SimilarBook) => {
                if (!cartBookIds.has(book.book_id) && !merged.has(book.book_id)) {
                    merged.set(book.book_id, book);
                }
            });
            setSuggestions(Array.from(merged.values()).slice(0, 10));
        });
    }, [cartItems]);

    const cartDetails = useMemo(() => {
        return cartItems.map(cartItem => {
            const bookDetail = books.find(b => b.book_id === cartItem.bookId);
            return { ...cartItem, ...bookDetail };
        }).filter(item => item.title);
    }, [cartItems, books]);

    const shippingFee = 30000;
    const subtotal = cartDetails.reduce((sum, item) => {
        return sum + (Number(item.price || 0) * item.quantity);
    }, 0);


    const handleUpdateQuantity = async (bookId: string, newQuantity: number) => {
        if (newQuantity <= 0) {
            setConfirmRemoveId(bookId);
            return;
        }

        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            else headers['x-guest-id'] = guestId;

            const res = await fetch(`${API_BASE_URL}/cart/update`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ bookId, quantity: newQuantity })
            });
            if (res.ok) fetchCart();
        } catch (err) {
            console.error("Lỗi cập nhật số lượng", err);
        }
    };

    const handleRemove = async (bookId: string) => {
        if (confirmRemoveId !== bookId) {
            setConfirmRemoveId(bookId);
            return;
        }

        setConfirmRemoveId(null);
        try {
            const headers: Record<string, string> = {};
            if (token) headers.Authorization = `Bearer ${token}`;
            else headers['x-guest-id'] = guestId;

            const res = await fetch(`${API_BASE_URL}/cart/remove/${bookId}`, {
                method: 'DELETE',
                headers
            });
            if (res.ok) {
                const item = cartDetails.find(d => d.bookId === bookId);
                toast(t('cart.removedFromCart', { title: item?.title || 'sản phẩm' }), 'info');
                fetchCart();
            }
        } catch (err) {
            console.error("Lỗi xóa sản phẩm", err);
        }
    };

    const handleApplyPromo = async () => {
        if (!promoCode.trim()) return;
        setIsValidatingPromo(true);
        try {
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (token) headers.Authorization = `Bearer ${token}`;
            else headers['x-guest-id'] = guestId;

            const res = await fetch(`${API_BASE_URL}/cart/validate-promo`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ code: promoCode }),
            });
            const data = await res.json();
            if (data.valid) {
                setAppliedPromo({ code: promoCode.trim().toUpperCase(), discount: data.discount, type: data.type, description: data.description });
                toast(t('cart.appliedPromoToast', { desc: data.description, code: promoCode.trim().toUpperCase() }), 'success');
            } else {
                toast(data.message || t('cart.invalidPromo'), 'error');
            }
        } catch {
            toast(t('cart.checkPromoError'), 'error');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoCode('');
    };

    let effectiveShippingFee = shippingFee;
    let calculatedDiscount = 0;

    if (appliedPromo) {
        if (appliedPromo.type === 'free_shipping') {
            effectiveShippingFee = 0;
            calculatedDiscount = shippingFee;
        } else if (appliedPromo.type === 'percentage') {
            calculatedDiscount = (subtotal * appliedPromo.discount) / 100;
        } else if (appliedPromo.type === 'fixed_amount') {
            calculatedDiscount = appliedPromo.discount;
        }
    }

    const effectiveTotal = Math.max(0, subtotal + effectiveShippingFee - calculatedDiscount);

    const formatPrice = (price: string | number) => {
        const numPrice = Number(price);
        if (i18n.language === 'en') {
            const usdPrice = numPrice / 25000;
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
    };




    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-dark-accent"></div>
            </div>
        );
    }

    if (cartDetails.length === 0) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex flex-col items-center justify-center p-4">
                <img src="https://cdni.iconscout.com/illustration/premium/thumb/empty-cart-2130356-1800917.png" alt="Empty Cart" className="w-64 h-64 object-contain mb-8 opacity-50" />
                <h2 className="text-2xl font-serif font-bold text-slate-800 dark:text-dark-text mb-4">{t('cart.emptyCartTitle')}</h2>
                <p className="text-slate-500 dark:text-dark-text-muted mb-8 text-center">{t('cart.emptyCartDesc')}</p>
                <Link to="/search" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 dark:bg-dark-accent dark:hover:bg-dark-accent-hover transition-colors">
                    {t('cart.continueShopping')}
                </Link>
            </div>
        );
    }

    return (
        <>
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-12">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-dark-text mb-8">{t('cart.cartTitle')}</h1>

                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {cartDetails.map(item => (
                            <motion.div
                                layout
                                key={item.bookId}
                                className="bg-white dark:bg-dark-surface p-4 flex gap-4 rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border items-center"
                            >
                                <SafeImage src={item.cover_url || "https://placehold.co/100x150"} alt={item.title} className="w-20 h-28 object-cover rounded-lg shadow-sm" />
                                <div className="flex-1">
                                    <Link to={`/book/${item.bookId}`} className="font-bold text-slate-900 dark:text-dark-text hover:text-indigo-600 dark:hover:text-dark-accent transition-colors line-clamp-1">
                                        {item.title}
                                    </Link>
                                    <p className="text-sm text-slate-500 dark:text-dark-text-muted mb-2">{item.author || t('cart.updating')}</p>
                                    <p className="font-bold text-indigo-600 dark:text-dark-accent">{formatPrice(item.price!)}</p>
                                </div>

                                <div className="flex flex-col items-end gap-4">
                                    {confirmRemoveId === item.bookId ? (
                                        <button
                                            onClick={() => handleRemove(item.bookId)}
                                            className="px-3 py-1.5 bg-rose-500 text-white text-xs font-bold rounded-full hover:bg-rose-600 transition-colors animate-pulse"
                                        >
                                            {t('cart.deleteConfirm')}
                                        </button>
                                    ) : (
                                        <button onClick={() => handleRemove(item.bookId)} className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-colors">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    )}
                                    <div className="flex items-center border border-slate-200 dark:border-dark-border rounded-full bg-slate-50 dark:bg-dark-bg">
                                        <button onClick={() => handleUpdateQuantity(item.bookId, item.quantity - 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent font-bold">-</button>
                                        <span className="w-8 text-center font-bold text-slate-900 dark:text-dark-text text-sm">{item.quantity}</span>
                                        <button onClick={() => handleUpdateQuantity(item.bookId, item.quantity + 1)} className="w-8 h-8 flex items-center justify-center text-slate-600 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent font-bold">+</button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="lg:col-span-1">
                        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border sticky top-24">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-dark-text mb-6 pb-4 border-b border-slate-100 dark:border-dark-border">{t('cart.totalTitle')}</h3>

                            <div className="space-y-3 mb-6">
                                <div className="flex justify-between text-slate-600 dark:text-dark-text-muted">
                                    <span>{t('cart.subtotal')}</span>
                                    <span>{formatPrice(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 dark:text-dark-text-muted">
                                    <span>{t('cart.shippingFee')}</span>
                                    {appliedPromo && appliedPromo.type === 'free_shipping' ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 dark:text-dark-text-muted line-through text-sm">{formatPrice(shippingFee)}</span>
                                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatPrice(0)}</span>
                                        </div>
                                    ) : (
                                        <span>{formatPrice(shippingFee)}</span>
                                    )}
                                </div>
                                {appliedPromo && appliedPromo.type !== 'free_shipping' && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                                        <span>{t('cart.discount')}</span>
                                        <span className="font-medium">-{formatPrice(calculatedDiscount)}</span>
                                    </div>
                                )}
                            </div>

                            {appliedPromo && (
                                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{t('cart.appliedPromoText')}<strong>{appliedPromo.code}</strong> — {appliedPromo.description}</span>
                                    <button onClick={handleRemovePromo} className="ml-auto p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 rounded transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-end mb-4 pt-4 border-t border-slate-100 dark:border-dark-border">
                                <span className="font-bold text-slate-900 dark:text-dark-text">{t('cart.totalPayment')}</span>
                                <span className="text-2xl font-bold text-indigo-600 dark:text-dark-accent">{formatPrice(effectiveTotal)}</span>
                            </div>

                            <div className="mb-6">
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-dark-text-muted" />
                                        <input
                                            type="text"
                                            value={promoCode}
                                            onChange={(e) => setPromoCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                                            placeholder={t('cart.promoCodePlaceholder')}
                                            disabled={!!appliedPromo}
                                            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-dark-border rounded-xl dark:bg-dark-surface-hover dark:text-dark-text dark:placeholder:text-dark-text-muted focus:ring-2 focus:ring-indigo-500 dark:focus:ring-dark-accent focus:outline-none disabled:bg-slate-50 dark:disabled:bg-dark-bg disabled:text-slate-400 dark:disabled:text-dark-text-muted"
                                        />
                                    </div>
                                    {!appliedPromo ? (
                                        <button
                                            onClick={handleApplyPromo}
                                            disabled={isValidatingPromo || !promoCode.trim()}
                                            className="px-4 py-2 bg-slate-800 dark:bg-dark-surface-hover text-white text-sm font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isValidatingPromo ? '...' : t('cart.apply')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <button
                                onClick={() => {
                                    if (!token) {
                                        toast(t('cart.loginToCheckout'), "info");
                                        navigate('/login');
                                    } else {
                                        navigate(appliedPromo ? `/checkout?promo=${appliedPromo.code}` : '/checkout');
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 dark:bg-dark-accent text-white h-12 rounded-full font-bold hover:bg-indigo-700 dark:hover:bg-dark-accent-hover transition-colors shadow-lg shadow-indigo-200 dark:shadow-none"
                            >
                                {t('cart.checkoutProcess')} <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

            {/* ── Có thể bạn cũng thích ── */}
            {suggestions.length > 0 && (
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 mb-16">
                    <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-dark-text mb-6">{t('cart.youMightAlsoLike')}</h2>
                    <div className="flex overflow-x-auto gap-4 pb-4 no-scrollbar scroll-smooth">
                        {suggestions.map((sb, idx) => (
                            <div
                                key={`sug-${sb.book_id}-${idx}`}
                                className="w-[150px] md:w-[170px] shrink-0 bg-white dark:bg-dark-surface border border-slate-100 dark:border-dark-border rounded-xl overflow-hidden hover:shadow-md transition-shadow flex flex-col group"
                            >
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
                                        onClick={() => handleAddToCart(sb.book_id)}
                                        className="mt-2 w-full bg-slate-900 dark:bg-dark-accent text-white py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-600 dark:hover:bg-dark-accent-hover transition-colors flex items-center justify-center gap-1"
                                    >
                                        <ShoppingCart className="w-3 h-3" /> {t('cart.addToCart')}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}