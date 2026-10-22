import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

export function Register() {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [subscribe, setSubscribe] = useState(false);

    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { t } = useTranslation();
    const [loadingText, setLoadingText] = useState(t('register.processingText'));

    const navigate = useNavigate();
    const { setToken, guestId } = useCart();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError(t('register.errorPasswordMismatch'));
            return;
        }
        setIsLoading(true);
        setLoadingText(t('register.creatingAccountText'));

        try {

            const registerRes = await fetch(`${API_BASE_URL}/users/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email,
                    password_raw: password,
                    full_name: `${lastName} ${firstName}`.trim(),
                })
            });

            if (!registerRes.ok) {
                const errData = await registerRes.json().catch(() => null);
                throw new Error(errData?.message || t('register.errorRegisterFailed'));
            }


            setLoadingText(t('register.settingUpText'));
            const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password_raw: password, guest_id: guestId })
            });

            if (loginRes.ok) {
                const loginData = await loginRes.json();
                localStorage.setItem('token', loginData.access_token);
                if (loginData.refresh_token) {
                    localStorage.setItem('refresh_token', loginData.refresh_token);
                }
                setToken(loginData.access_token);



                setTimeout(() => {
                    navigate('/account');
                }, 500);
            } else {

                navigate('/login');
            }

        } catch (err: any) {
            setError(err.message || t('register.errorNetwork'));
            setIsLoading(false);
        }
    }

    return (
        <div className="bg-slate-50 min-h-[calc(100vh-80px)] flex items-center justify-center p-4 relative">
            

            {isLoading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-50/80 backdrop-blur-sm transition-all">
                    <div className="relative flex justify-center items-center">
                        <div className="absolute animate-ping w-16 h-16 rounded-full bg-indigo-400 opacity-20"></div>
                        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin z-10"></div>
                    </div>
                    <h2 className="mt-6 text-xl font-bold text-slate-800 animate-pulse">{loadingText}</h2>
                    <p className="text-slate-500 mt-2 text-sm">{t('register.doNotClose')}</p>
                </div>
            )}

            <div className="w-full max-w-md relative z-10">
                <h1 className="text-2xl md:text-3xl font-serif text-slate-800 mb-4 text-left">
                    {t('register.title')}
                </h1>

                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <form onSubmit={handleSubmit} className="space-y-4">

                        {error && (
                            <div className="p-3 bg-rose-50 text-rose-600 border border-rose-100 rounded text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-sm text-slate-700">{t('register.lastName')}</label>
                                <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required disabled={isLoading} />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-sm text-slate-700">{t('register.firstName')}</label>
                                <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)}
                                    className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required disabled={isLoading} />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm text-slate-700">{t('register.email')}</label>
                            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required disabled={isLoading} />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm text-slate-700">{t('register.password')}</label>
                            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required disabled={isLoading} minLength={6} />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-sm text-slate-700">{t('register.confirmPassword')}</label>
                            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500" required disabled={isLoading} minLength={6} />
                        </div>

                        <div className="flex items-start gap-2 pt-1">
                            <input type="checkbox" id="subscribe" checked={subscribe} onChange={(e) => setSubscribe(e.target.checked)}
                                className="w-4 h-4 mt-0.5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-600 cursor-pointer" disabled={isLoading} />
                            <label htmlFor="subscribe" className="text-sm text-slate-700 cursor-pointer select-none">
                                {t('register.subscribe')}
                            </label>
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-8 rounded-full transition-colors disabled:opacity-50 flex justify-center uppercase">
                                {t('register.submitBtn')}
                            </button>
                        </div>

                        <div className="text-sm text-slate-600 text-center pt-2">
                            {t('register.alreadyHaveAccount')}<Link to="/login" className="text-indigo-600 font-medium hover:underline">{t('register.loginNow')}</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}