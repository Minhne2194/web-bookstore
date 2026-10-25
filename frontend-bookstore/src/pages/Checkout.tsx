import React, { useState, useEffect, useMemo } from 'react';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { CheckCircle2, ArrowLeft, Wallet, Tag, X, Building2, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { SafeImage } from '../components/SafeImage';
import { useTranslation, Trans } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

interface Book {
    book_id: string;
    title: string;
    price: string | number;
    cover_url: string | null;
}

const API_URL = `${API_BASE_URL}`;

export function Checkout() {
    const { token, cartItems, fetchCart } = useCart();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { t, i18n } = useTranslation();

    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [promoCode, setPromoCode] = useState(searchParams.get('promo') || '');
    const [appliedPromo, setAppliedPromo] = useState<any>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        address: '',
        paymentMethod: 'cod'
    });

    useEffect(() => {
        if (searchParams.get('promo') && token) {
            handleApplyPromoInit(searchParams.get('promo')!);
        }
    }, [token]);

    const handleApplyPromoInit = async (code: string) => {
        try {
            const res = await fetch(`${API_URL}/cart/validate-promo`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ code }),
            });
            const data = await res.json();
            if (data.valid) {
                setAppliedPromo({ code: code.trim().toUpperCase(), discount: data.discount, type: data.type, description: data.description });
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (cartItems.length === 0) {
            setBooks([]);
            setLoading(false);
            return;
        }

        const ids = cartItems.map(item => item.bookId).join(',');

        setLoading(true);
        fetch(`${API_URL}/books?ids=${ids}`)
            .then((res) => res.json())
            .then((resData) => {
                const data = resData.data ? resData.data : resData;
                setBooks(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error("Lỗi tải sách:", err);
                setLoading(false);
            });
    }, [cartItems]);

    const cartDetails = useMemo(() => {
        return cartItems.map(cartItem => {
            const bookDetail = books.find(b => b.book_id === cartItem.bookId);
            return { ...cartItem, ...bookDetail };
        }).filter(item => item.title);
    }, [cartItems, books]);

    const subtotal = cartDetails.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);
    const baseShippingFee = 30000;
    
    let effectiveShippingFee = baseShippingFee;
    let calculatedDiscount = 0;

    if (appliedPromo) {
        if (appliedPromo.type === 'free_shipping') {
            effectiveShippingFee = 0;
            calculatedDiscount = baseShippingFee;
        } else if (appliedPromo.type === 'percentage') {
            calculatedDiscount = (subtotal * appliedPromo.discount) / 100;
            // Optionally cap it if we had max_discount
        } else if (appliedPromo.type === 'fixed_amount') {
            calculatedDiscount = appliedPromo.discount;
        }
    }

    const totalAmount = Math.max(0, subtotal + effectiveShippingFee - calculatedDiscount);

    useEffect(() => {
        if (!loading && cartItems.length === 0 && !isSuccess) {
            navigate('/cart');
        }
    }, [loading, cartItems.length, isSuccess, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!token) {
            toast(t('checkout.loginRequired'), 'info');
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_URL}/orders/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    payment_method: formData.paymentMethod,
                    shipping_address: {
                        name: formData.name,
                        phone: formData.phone,
                        address: formData.address
                    },
                    ...(appliedPromo ? { promo_code: appliedPromo.code } : {}),
                })
            });

            if (res.ok) {
                const data = await res.json();
                fetchCart();
                if (data.requiresPayment) {
                    navigate(`/payment/process/${data.order.order_id}`);
                } else {
                    setIsSuccess(true);
                    triggerConfetti();
                }
            } else {
                const err = await res.json();
                toast(t('checkout.errorOrder', { message: err.message || 'Không thể đặt hàng' }), 'error');
            }
        } catch (error) {
            console.error(error);
            toast(t('checkout.errorGeneral'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const triggerConfetti = () => {
        const duration = 3 * 1000;
        const animationEnd = Date.now() + duration;
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
        const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

        const interval: any = setInterval(function () {
            const timeLeft = animationEnd - Date.now();
            if (timeLeft <= 0) {
                return clearInterval(interval);
            }
            const particleCount = 50 * (timeLeft / duration);
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
            confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
        }, 250);
    };

    const formatPrice = (price: string | number) => {
        const numPrice = Number(price);
        if (i18n.language === 'en') {
            const usdPrice = numPrice / 25000;
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
        }
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
    };

    const paymentOptions = [
        { value: 'cod', icon: Wallet, label: t('checkout.methodCod') },
        { value: 'bank_transfer', icon: Building2, label: t('checkout.methodBank') },
        { value: 'momo', icon: CreditCard, label: t('checkout.methodMomo') },
        { value: 'vnpay', icon: CreditCard, label: t('checkout.methodVnpay') },
    ];

    const handleApplyPromo = async () => {
        if (!promoCode.trim() || !token) return;
        setIsValidatingPromo(true);
        try {
            const res = await fetch(`${API_BASE_URL}/cart/validate-promo`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ code: promoCode }),
            });
            const data = await res.json();
            if (data.valid) {
                setAppliedPromo({ code: promoCode.trim().toUpperCase(), discount: data.discount, type: data.type, description: data.description });
                toast(t('checkout.appliedPromoToast', { desc: data.description, code: promoCode.trim().toUpperCase() }), 'success');
            } else {
                toast(data.message || t('checkout.invalidPromo'), 'error');
            }
        } catch {
            toast(t('checkout.checkPromoError'), 'error');
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoCode('');
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex flex-col items-center pt-20 px-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                >
                    <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" />
                </motion.div>
                <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-dark-text mb-4 text-center">{t('checkout.successTitle')}</h1>
                <p className="text-slate-600 dark:text-dark-text-muted mb-8 max-w-md text-center leading-relaxed">
                    <Trans
                        i18nKey="checkout.successMessage"
                        values={{ name: formData.name, address: formData.address }}
                        components={{ strong: <strong /> }}
                    />
                </p>
                <Link to="/" className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 dark:bg-dark-accent dark:hover:bg-dark-accent-hover transition-colors shadow-lg shadow-indigo-200">
                    {t('checkout.continueShopping')}
                </Link>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-dark-bg flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 dark:border-dark-accent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-dark-bg py-12">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <Link to="/cart" className="inline-flex items-center gap-2 text-slate-500 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent mb-8 transition-colors font-medium">
                    <ArrowLeft className="w-4 h-4" /> {t('checkout.backToCart')}
                </Link>
                <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-dark-text mb-8">{t('checkout.checkoutTitle')}</h1>
                
                <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border h-max">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6">{t('checkout.shippingInfo')}</h2>
                        <form onSubmit={handleSubmit} id="checkout-form" className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-dark-text mb-1">{t('checkout.fullName')}</label>
                                <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border rounded-lg placeholder:text-slate-400 dark:placeholder:text-dark-text-muted focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder={t('checkout.fullNamePlaceholder')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-dark-text mb-1">{t('checkout.phone')}</label>
                                <input required type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border rounded-lg placeholder:text-slate-400 dark:placeholder:text-dark-text-muted focus:ring-2 focus:ring-indigo-500 focus:outline-none" placeholder={t('checkout.phonePlaceholder')} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-dark-text mb-1">{t('checkout.address')}</label>
                                <textarea required value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="w-full px-4 py-2 bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border rounded-lg placeholder:text-slate-400 dark:placeholder:text-dark-text-muted focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-24" placeholder={t('checkout.addressPlaceholder')} />
                            </div>
                            
                            <div className="pt-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-dark-text mb-3">{t('checkout.paymentMethod')}</label>
                                <div className="space-y-2">
                                    {paymentOptions.map(({ value, icon: Icon, label }) => (
                                        <label
                                            key={value}
                                            className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${formData.paymentMethod === value
                                                ? 'border-indigo-500 bg-indigo-50/60 dark:border-dark-accent dark:bg-dark-accent/15'
                                                : 'border-slate-200 hover:bg-slate-50 dark:border-dark-border dark:hover:bg-dark-surface-hover'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="payment"
                                                value={value}
                                                checked={formData.paymentMethod === value}
                                                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                                                className="text-indigo-600 dark:text-dark-accent focus:ring-indigo-500 w-4 h-4"
                                            />
                                            <Icon className="w-5 h-5 text-slate-600 dark:text-dark-text-muted" />
                                            <span className="font-medium text-slate-700 dark:text-dark-text text-sm">{label}</span>
                                        </label>
                                    ))}
                                </div>
                                {formData.paymentMethod !== 'cod' && (
                                    <p className="mt-3 text-xs text-slate-500 dark:text-dark-text-muted leading-relaxed">
                                        {t('checkout.redirectNote', {
                                            method: paymentOptions.find(o => o.value === formData.paymentMethod)?.label,
                                        })}
                                    </p>
                                )}
                            </div>
                        </form>
                    </div>

                    <div>
                        <div className="bg-white dark:bg-dark-surface p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-dark-border sticky top-24">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6">{t('checkout.orderSummary', { count: cartDetails.length })}</h2>
                            
                            <div className="mb-6 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                                <div className="space-y-6 pt-2">
                                    {cartDetails.map(item => (
                                        <div key={item.bookId} className="flex gap-4">
                                            <div className="relative shrink-0 w-16 h-24">
                                                <SafeImage src={item.cover_url || "https://placehold.co/100x150"} alt={item.title} className="w-full h-full object-cover rounded-md shadow-sm" />
                                                <span className="absolute -top-2 -right-2 w-5 h-5 bg-indigo-600 dark:bg-dark-accent text-white rounded-full text-[11px] flex items-center justify-center font-bold z-10 shadow-sm border border-white dark:border-dark-surface">
                                                    {item.quantity}
                                                </span>
                                            </div>
                                            <div className="flex-1 flex flex-col justify-center">
                                                <p className="font-bold text-slate-900 dark:text-dark-text text-sm line-clamp-2">{item.title}</p>
                                                <p className="text-indigo-600 dark:text-dark-accent font-bold mt-1.5">{formatPrice(Number(item.price) * item.quantity)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-slate-100 dark:border-dark-border pt-4 mb-6 space-y-2">
                                <div className="flex justify-between text-slate-600 dark:text-dark-text-muted text-sm">
                                    <span>{t('checkout.subtotal')}</span>
                                    <span className="font-medium">{formatPrice(subtotal)}</span>
                                </div>
                                <div className="flex justify-between text-slate-600 dark:text-dark-text-muted text-sm">
                                    <span>{t('checkout.shippingFee')}</span>
                                    {appliedPromo && appliedPromo.type === 'free_shipping' ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-slate-400 dark:text-dark-text-muted line-through">{formatPrice(baseShippingFee)}</span>
                                            <span className="text-emerald-600 dark:text-emerald-300 font-medium">{formatPrice(0)}</span>
                                        </div>
                                    ) : (
                                        <span className="font-medium">{formatPrice(baseShippingFee)}</span>
                                    )}
                                </div>
                                {appliedPromo && appliedPromo.type !== 'free_shipping' && (
                                    <div className="flex justify-between text-emerald-600 dark:text-emerald-300 text-sm">
                                        <span>{t('checkout.discount')}</span>
                                        <span className="font-medium">-{formatPrice(calculatedDiscount)}</span>
                                    </div>
                                )}
                            </div>

                            {appliedPromo && (
                                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl text-sm text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>{t('checkout.appliedPromoText')}<strong>{appliedPromo.code}</strong> — {appliedPromo.description}</span>
                                    <button type="button" onClick={handleRemovePromo} className="ml-auto p-0.5 hover:bg-emerald-200 dark:hover:bg-emerald-900 rounded transition-colors">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            <div className="flex justify-between items-end mb-4">
                                <span className="font-bold text-slate-900 dark:text-dark-text">{t('checkout.total')}</span>
                                <span className="text-2xl font-bold text-indigo-600 dark:text-dark-accent">{formatPrice(totalAmount)}</span>
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
                                            placeholder={t('checkout.promoCodePlaceholder')}
                                            disabled={!!appliedPromo}
                                            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-dark-bg text-slate-900 dark:text-dark-text border border-slate-200 dark:border-dark-border rounded-xl placeholder:text-slate-400 dark:placeholder:text-dark-text-muted focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:bg-slate-50 dark:disabled:bg-dark-surface-hover disabled:text-slate-400 dark:disabled:text-dark-text-muted"
                                        />
                                    </div>
                                    {!appliedPromo ? (
                                        <button
                                            type="button"
                                            onClick={handleApplyPromo}
                                            disabled={isValidatingPromo || !promoCode.trim()}
                                            className="px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {isValidatingPromo ? '...' : t('checkout.apply')}
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            <button
                                type="submit"
                                form="checkout-form"
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white h-12 rounded-full font-bold hover:bg-indigo-700 dark:bg-dark-accent dark:hover:bg-dark-accent-hover transition-colors shadow-lg shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <span className="animate-pulse">{t('checkout.processing')}</span>
                                ) : (
                                    <>{t('checkout.placeOrder')} <CheckCircle2 className="w-5 h-5" /></>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}