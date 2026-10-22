import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, ArrowRight, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export function PaymentResult() {
    const [searchParams] = useSearchParams();
    const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
    const [message, setMessage] = useState('');
    const [orderId, setOrderId] = useState('');
    const { t } = useTranslation();

    useEffect(() => {
        // Check for VNPay response
        const vnpResponseCode = searchParams.get('vnp_ResponseCode');
        const vnpTxnRef = searchParams.get('vnp_TxnRef');
        const vnpMessage = searchParams.get('vnp_Message');

        // Check for MoMo response
        const momoResultCode = searchParams.get('resultCode');
        const momoOrderId = searchParams.get('orderId');
        const momoMessage = searchParams.get('message');

        // Check for PayOS response
        const payosOrderCode = searchParams.get('orderCode');
        const payosStatus = searchParams.get('status');

        if (payosOrderCode !== null && payosStatus !== null) {
            const success = payosStatus === 'PAID';
            setIsSuccess(success);
            setOrderId(payosOrderCode);
            setMessage(success
                ? t('paymentResult.payosSuccess')
                : t('paymentResult.payosFailed', { status: payosStatus })
            );
        } else if (vnpResponseCode !== null) {
            // VNPay response
            const success = vnpResponseCode === '00';
            setIsSuccess(success);
            setOrderId(vnpTxnRef || '');
            setMessage(success 
                ? t('paymentResult.vnpaySuccess') 
                : t('paymentResult.failedWithMessage', { code: vnpResponseCode, message: vnpMessage || t('paymentResult.tryAgain') })
            );
        } else if (momoResultCode !== null) {
            // MoMo response
            const success = momoResultCode === '0';
            setIsSuccess(success);
            setOrderId(momoOrderId || '');
            setMessage(success 
                ? t('paymentResult.momoSuccess') 
                : t('paymentResult.failedWithMessage', { code: momoResultCode, message: momoMessage || t('paymentResult.tryAgain') })
            );
        } else {
            // Check for direct result from our API
            const directSuccess = searchParams.get('isSuccess');
            const directOrderId = searchParams.get('orderId');
            const directMessage = searchParams.get('message');

            if (directSuccess !== null) {
                setIsSuccess(directSuccess === 'true');
                setOrderId(directOrderId || '');
                setMessage(directMessage || (directSuccess === 'true' ? t('paymentResult.success') : t('paymentResult.failed')));
            } else {
                setIsSuccess(false);
                setMessage(t('paymentResult.notFound'));
            }
        }
    }, [searchParams]);

    if (isSuccess === null) {
        return (
            <div className="min-h-screen bg-slate-50 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-20">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="max-w-md w-full"
            >
                <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-8 md:p-12 text-center">
                    {isSuccess ? (
                        <>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                            >
                                <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                                </div>
                            </motion.div>
                            <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">
                                {t('paymentResult.successTitle')}
                            </h1>
                            <p className="text-slate-600 mb-2">
                                {message}
                            </p>
                            {orderId && (
                                <p className="text-sm text-slate-500 mb-6">
                                    {t('paymentResult.orderCode')} <strong>{orderId}</strong>
                                </p>
                            )}
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 mb-8">
                                <p className="text-emerald-700 text-sm">
                                    {t('paymentResult.successDesc')}
                                </p>
                            </div>
                        </>
                    ) : (
                        <>
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: 0.2, type: "spring", bounce: 0.5 }}
                            >
                                <div className="w-20 h-20 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                    <XCircle className="w-10 h-10 text-rose-600" />
                                </div>
                            </motion.div>
                            <h1 className="text-2xl md:text-3xl font-serif font-bold text-slate-900 mb-4">
                                {t('paymentResult.failedTitle')}
                            </h1>
                            <p className="text-slate-600 mb-6">
                                {message}
                            </p>
                            {orderId && (
                                <p className="text-sm text-slate-500 mb-6">
                                    {t('paymentResult.orderCode')} <strong>{orderId}</strong>
                                </p>
                            )}
                            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-8">
                                <p className="text-amber-700 text-sm">
                                    {t('paymentResult.failedDesc')}
                                </p>
                            </div>
                        </>
                    )}

                    <div className="space-y-3">
                        {isSuccess ? (
                            <Link
                                to="/account"
                                className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                            >
                                <Package className="w-5 h-5" />
                                {t('paymentResult.viewOrders')}
                            </Link>
                        ) : (
                            <>
                                <Link
                                    to={`/account?orderId=${orderId}`}
                                    className="flex items-center justify-center gap-2 w-full bg-indigo-600 text-white px-6 py-3 rounded-full font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    {t('paymentResult.retryPayment')}
                                </Link>
                                <Link
                                    to="/contact-support"
                                    className="flex items-center justify-center gap-2 w-full bg-slate-100 text-slate-700 px-6 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors"
                                >
                                    {t('paymentResult.contactSupport')}
                                </Link>
                            </>
                        )}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100">
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors"
                        >
                            <ArrowRight className="w-4 h-4 rotate-180" />
                            {t('paymentResult.backToHome')}
                        </Link>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}