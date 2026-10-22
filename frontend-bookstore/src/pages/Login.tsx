import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

export function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { setToken, guestId } = useCart();
    const { t } = useTranslation();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password_raw: password, guest_id: guestId })
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('token', data.access_token);
                if (data.refresh_token) {
                    localStorage.setItem('refresh_token', data.refresh_token);
                }
                setToken(data.access_token);
                navigate('/');
            } else {
                const errData = await res.json().catch(() => null);
                setError(errData?.message || t('login.errorInvalid'));
            }
        } catch (err) {
            setError(t('login.errorNetwork'));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <h1 className="text-2xl md:text-3xl font-serif text-slate-800 mb-4 text-left">
                    {t('login.title')}
                </h1>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {error && (
                            <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-1">
                            <label className="block text-sm text-slate-700">{t('login.emailLabel')}</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm text-slate-700">{t('login.passwordLabel')}</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                            <input
                                type="checkbox"
                                id="remember"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer accent-indigo-600"
                                disabled={isLoading}
                            />
                            <label htmlFor="remember" className="text-sm text-slate-700 cursor-pointer select-none">
                                {t('login.rememberMe')}
                            </label>
                        </div>

                        <div className="text-sm text-slate-500 leading-relaxed pt-2">
                            {t('login.termsPrefix')}
                            <a href="#" className="text-indigo-600 hover:underline">{t('login.policyLink')}</a>
                            {t('login.termsAnd')}
                            <a href="#" className="text-indigo-600 hover:underline">{t('login.termsLink')}</a>.
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-full transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]"
                            >
                                {isLoading ? (
                                    <span className="animate-pulse">{t('login.processing')}</span>
                                ) : (
                                    t('login.submitBtn')
                                )}
                            </button>
                        </div>

                        {/* Đã cập nhật phần text dưới cùng theo yêu cầu */}
                        <div className="text-sm text-slate-600 text-center pt-2">
                            {t('login.or')}<Link to="/register" className="text-indigo-600 font-medium hover:underline">{t('login.createAccount')}</Link>{t('login.separator')}<a href="#" className="text-indigo-600 font-medium hover:underline">{t('login.forgotPassword')}</a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}