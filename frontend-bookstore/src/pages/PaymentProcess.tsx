import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Building2,
    CheckCircle2,
    CreditCard,
    ExternalLink,
    Loader2,
    Wallet,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config/api';

type PaymentMethod = 'cod' | 'bank_transfer' | 'momo' | 'vnpay';

interface OrderPaymentInfo {
    order_id: string;
    order_code?: string;
    total_amount: string | number;
    payment_method: PaymentMethod;
    payment_status: string;
    status: string;
}

interface GatewayData {
    payUrl?: string;
    qrCode?: string;
    orderCode?: number | string;
}

const ONLINE_METHODS: PaymentMethod[] = ['bank_transfer', 'momo', 'vnpay'];

export function PaymentProcess() {
    const { orderId } = useParams<{ orderId: string }>();
    const { token } = useCart();
    const { toast } = useToast();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const [order, setOrder] = useState<OrderPaymentInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isPaid, setIsPaid] = useState(false);
    const [isCodConfirmed, setIsCodConfirmed] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
    const [changingMethod, setChangingMethod] = useState<PaymentMethod | null>(null);
    const [gateway, setGateway] = useState<GatewayData | null>(null);
    const [isCancelling, setIsCancelling] = useState(false);

    const authHeaders = useCallback(
        (json = false): Record<string, string> => {
            const headers: Record<string, string> = {};
            if (json) headers['Content-Type'] = 'application/json';
            if (token) headers.Authorization = `Bearer ${token}`;
            return headers;
        },
        [token],
    );

    const methodOptions = [
        { value: 'cod' as PaymentMethod, icon: Wallet, label: t('checkout.methodCod') },
        { value: 'bank_transfer' as PaymentMethod, icon: Building2, label: t('checkout.methodBank') },
        { value: 'momo' as PaymentMethod, icon: CreditCard, label: t('checkout.methodMomo') },
        { value: 'vnpay' as PaymentMethod, icon: CreditCard, label: t('checkout.methodVnpay') },
    ];

    const formatAmount = (value: string | number) =>
        `${new Intl.NumberFormat('vi-VN').format(Number(value))}đ`;

    // payment-info refuses to answer once the order is paid, so fall back to
    // my-orders to distinguish "already paid" from "cannot load".
    const fetchOrderState = useCallback(async (): Promise<OrderPaymentInfo | null> => {
        if (!orderId) return null;

        const res = await fetch(`${API_BASE_URL}/orders/${orderId}/payment-info`, {
            headers: authHeaders(),
        });
        if (res.ok) return await res.json();

        if (res.status === 400) {
            const fallback = await fetch(`${API_BASE_URL}/orders/my-orders`, {
                headers: authHeaders(),
            });
            if (fallback.ok) {
                const list = await fallback.json();
                const orders: OrderPaymentInfo[] = Array.isArray(list) ? list : list?.data || [];
                const found = orders.find(o => o.order_id === orderId);
                if (found) return found;
            }
        }
        return null;
    }, [orderId, authHeaders]);

    useEffect(() => {
        if (!token) {
            navigate('/login', { replace: true });
            return;
        }

        let active = true;
        fetchOrderState()
            .then((data) => {
                if (!active) return;
                if (!data) {
                    setLoadError(t('paymentProcess.loadFailed'));
                    return;
                }
                setOrder(data);
                if (data.payment_status === 'paid') setIsPaid(true);
                else setSelectedMethod(data.payment_method);
            })
            .catch((err) => {
                console.error(err);
                if (active) setLoadError(t('paymentProcess.loadFailed'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [token, fetchOrderState, navigate, t]);

    useEffect(() => {
        if (!token || !orderId || loading || isPaid || isCodConfirmed) return;

        const intervalId = setInterval(async () => {
            try {
                const data = await fetchOrderState();
                if (!data) return;
                setOrder(data);
                if (data.payment_status === 'paid') {
                    setIsPaid(true);
                }
            } catch (err) {
                console.error(err);
            }
        }, 4000);

        return () => clearInterval(intervalId);
    }, [token, orderId, loading, isPaid, isCodConfirmed, fetchOrderState]);

    const handleSelectMethod = async (method: PaymentMethod) => {
        if (!orderId || !order || changingMethod) return;

        setChangingMethod(method);
        setSelectedMethod(method);
        setGateway(null);

        try {
            const changeRes = await fetch(`${API_BASE_URL}/orders/${orderId}/change-payment`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ payment_method: method }),
            });

            if (!changeRes.ok) {
                const err = await changeRes.json().catch(() => ({}));
                toast(err.message || t('paymentProcess.changeMethodFailed'), 'error');
                setSelectedMethod(order.payment_method);
                return;
            }

            const changed = await changeRes.json();
            const amount = Number(changed.total_amount ?? order.total_amount);
            setOrder(prev => prev ? {
                ...prev,
                payment_method: changed.payment_method ?? method,
                payment_status: changed.payment_status ?? prev.payment_status,
                status: changed.status ?? prev.status,
                total_amount: changed.total_amount ?? prev.total_amount,
            } : prev);

            if (!ONLINE_METHODS.includes(method)) {
                setGateway(null);
                setIsCodConfirmed(true);
                return;
            }

            const provider = 'payos';
            const payRes = await fetch(`${API_BASE_URL}/payment/${provider}/create`, {
                method: 'POST',
                headers: authHeaders(true),
                body: JSON.stringify({ orderId, amount }),
            });

            if (!payRes.ok) {
                const err = await payRes.json().catch(() => ({}));
                toast(err.message || t('paymentProcess.createPaymentFailed'), 'error');
                return;
            }

            const payData = await payRes.json();
            setGateway({
                payUrl: payData.payUrl,
                qrCode: payData.qrCode,
                orderCode: payData.orderCode,
            });
        } catch (err) {
            console.error(err);
            toast(t('paymentProcess.genericError'), 'error');
        } finally {
            setChangingMethod(null);
        }
    };

    const handleCancelOrder = async () => {
        if (!orderId || isCancelling) return;
        if (!window.confirm(t('paymentProcess.cancelConfirm'))) return;

        setIsCancelling(true);
        try {
            const res = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: authHeaders(true),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast(err.message || t('paymentProcess.cancelFailed'), 'error');
                return;
            }

            toast(t('paymentProcess.cancelSuccess'), 'success');
            navigate('/cart');
        } catch (err) {
            console.error(err);
            toast(t('paymentProcess.cancelFailed'), 'error');
        } finally {
            setIsCancelling(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (loadError || !order) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
                <p className="text-slate-700 font-medium mb-6 text-center">
                    {loadError || t('paymentProcess.loadFailed')}
                </p>
                <Link
                    to="/account"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                >
                    <ArrowLeft className="w-4 h-4" />
                    {t('paymentProcess.back')}
                </Link>
            </div>
        );
    }

    const qrSrc = gateway?.qrCode
        ? (gateway.qrCode.startsWith('data:') ? gateway.qrCode : `data:image/png;base64,${gateway.qrCode}`)
        : null;

    if (isPaid || isCodConfirmed) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center pt-20 px-4">
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                >
                    <CheckCircle2 className="w-24 h-24 text-emerald-500 mb-6" />
                </motion.div>
                <h1 className="text-3xl font-serif font-bold text-slate-900 mb-4 text-center max-w-xl">
                    {isPaid ? t('paymentProcess.paid') : t('paymentProcess.codSuccess')}
                </h1>
                <p className="text-slate-600 mb-2 text-center max-w-md leading-relaxed">
                    {isPaid ? t('paymentProcess.paidDesc') : t('paymentProcess.codSuccessDesc')}
                </p>
                <p className="text-sm text-slate-500 mb-8 text-center">
                    {t('paymentProcess.orderCode')} <strong>{order.order_code || order.order_id}</strong>
                    {' — '}
                    {formatAmount(order.total_amount)}
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                        to="/account"
                        className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 text-center"
                    >
                        {t('paymentProcess.viewOrders')}
                    </Link>
                    <Link
                        to="/"
                        className="px-8 py-3 bg-white text-slate-700 font-bold rounded-full border border-slate-200 hover:bg-slate-100 transition-colors text-center"
                    >
                        {t('checkout.continueShopping')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 mb-8 transition-colors font-medium"
                >
                    <ArrowLeft className="w-4 h-4" /> {t('paymentProcess.back')}
                </button>

                <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
                    <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-2">
                        {t('paymentProcess.title')}
                    </h1>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                        {t('paymentProcess.subtitle')}
                    </p>

                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-8 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">{t('paymentProcess.orderCode')}</span>
                            <span className="font-semibold text-slate-900">{order.order_code || order.order_id}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">{t('paymentProcess.amount')}</span>
                            <span className="font-bold text-indigo-600">{formatAmount(order.total_amount)}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                            <span className="text-slate-500">{t('paymentProcess.currentMethod')}</span>
                            <span className="font-medium text-slate-900">
                                {methodOptions.find(o => o.value === order.payment_method)?.label || order.payment_method}
                            </span>
                        </div>
                    </div>

                    <h2 className="text-lg font-bold text-slate-900 mb-3">{t('paymentProcess.chooseMethod')}</h2>
                    <div className="space-y-2 mb-6">
                        {methodOptions.map(({ value, icon: Icon, label }) => (
                            <button
                                key={value}
                                type="button"
                                disabled={!!changingMethod}
                                onClick={() => handleSelectMethod(value)}
                                className={`w-full flex items-center gap-3 p-3 border rounded-xl text-left transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${selectedMethod === value
                                    ? 'border-indigo-500 bg-indigo-50/60'
                                    : 'border-slate-200 hover:bg-slate-50'
                                    }`}
                            >
                                <Icon className="w-5 h-5 text-slate-600 shrink-0" />
                                <span className="font-medium text-slate-700 text-sm flex-1">{label}</span>
                                {changingMethod === value && (
                                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                                )}
                            </button>
                        ))}
                    </div>

                    {changingMethod && (
                        <p className="text-sm text-slate-500 mb-4 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {t('paymentProcess.changingMethod')}
                        </p>
                    )}

                    {gateway && (
                        <div className="border border-indigo-100 bg-indigo-50/40 rounded-2xl p-5 mb-6 text-center">
                            {qrSrc && (
                                <div className="mb-4">
                                    <p className="text-sm font-medium text-slate-700 mb-2">{t('paymentProcess.scanQr')}</p>
                                    <img
                                        src={qrSrc}
                                        alt={t('paymentProcess.scanQr')}
                                        className="w-56 h-56 mx-auto bg-white rounded-xl border border-slate-200 object-contain p-2"
                                    />
                                </div>
                            )}
                            {gateway.payUrl && (
                                <a
                                    href={gateway.payUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    {t('paymentProcess.openGateway')}
                                </a>
                            )}
                            <p className="mt-4 text-xs text-slate-500 leading-relaxed flex items-center justify-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {t('paymentProcess.pendingNote')}
                            </p>
                        </div>
                    )}

                    {!gateway && !changingMethod && (
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                            {t('paymentProcess.pendingNote')}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleCancelOrder}
                        disabled={isCancelling}
                        className="w-full flex items-center justify-center gap-2 bg-white text-rose-600 border border-rose-200 h-12 rounded-full font-bold hover:bg-rose-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        {t('paymentProcess.cancelOrder')}
                    </button>
                </div>
            </div>
        </div>
    );
}
