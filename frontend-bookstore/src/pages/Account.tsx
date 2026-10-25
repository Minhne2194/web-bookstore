import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { User, ShoppingBag, MapPin, LogOut, CheckCircle2, AlertCircle, Plus, Home, Building2, Trash2, Pencil } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useToast } from '../components/Toast';
import { getOrderStatusMeta } from '../utils/orderStatus';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config/api';

interface OrderItem {
  quantity: number;
  unit_price: number | string;
  book: {
    title: string;
    cover_url: string;
  };
}

interface Order {
  order_code: string;
  created_at: string;
  total_amount: number | string;
  status: string;
  items?: OrderItem[];
}

interface UserProfile {
  email: string;
  full_name?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthday?: string | null;
}

interface UserAddress {
  address_id: string;
  receiver_name: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  street: string;
  is_default: boolean;
  address_type: string;
  created_at: string;
}

type MessageState = {
  type: '' | 'success' | 'error';
  text: string;
};

interface LocationOption {
  name: string;
  code: number;
}

const PROVINCE_API = 'https://provinces.open-api.vn/api';

const emptyAddressForm = {
  receiver_name: '',
  phone: '',
  province: '',
  district: '',
  ward: '',
  street: '',
  is_default: false,
  address_type: 'home' as 'home' | 'office',
};

export function Account() {
  const { token, setToken } = useCart();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [activeTab, setActiveTab] = useState('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editBirthday, setEditBirthday] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<MessageState>({ type: '', text: '' });

  // Address state
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [addressMessage, setAddressMessage] = useState<MessageState>({ type: '', text: '' });
  const [isSavingAddr, setIsSavingAddr] = useState(false);

  // --- Location dropdown state ---
  const [provinces, setProvinces] = useState<LocationOption[]>([]);
  const [districts, setDistricts] = useState<LocationOption[]>([]);
  const [wards, setWards] = useState<LocationOption[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);

  // Fetch provinces once
  useEffect(() => {
    fetch(`${PROVINCE_API}/p/`)
      .then((r) => r.json())
      .then((data) => setProvinces(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Fetch districts when province changes
  const fetchDistricts = async (province: string) => {
    setDistricts([]);
    setWards([]);
    if (!province) return;
    setLoadingDistricts(true);
    try {
      const provinceObj = provinces.find((p) => p.name === province);
      if (!provinceObj) return;
      const res = await fetch(`${PROVINCE_API}/p/${provinceObj.code}?depth=2`);
      const data = await res.json();
      setDistricts(data.districts || []);
    } catch {
      // ignore
    } finally {
      setLoadingDistricts(false);
    }
  };

  // Fetch wards when district changes
  const fetchWards = async (district: string) => {
    setWards([]);
    if (!district) return;
    setLoadingWards(true);
    try {
      const districtObj = districts.find((d) => d.name === district);
      if (!districtObj) return;
      const res = await fetch(`${PROVINCE_API}/d/${districtObj.code}?depth=2`);
      const data = await res.json();
      setWards(data.wards || []);
    } catch {
      // ignore
    } finally {
      setLoadingWards(false);
    }
  };

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  useEffect(() => {
    const fetchAccountData = async () => {
      setLoading(true);

      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, ordersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/users/profile`, { headers }),
          fetch(`${API_BASE_URL}/orders/my-orders`, { headers }),
        ]);

        if (profileRes.ok) {
          const profileData: UserProfile = await profileRes.json();
          setProfile(profileData);
          setEditFullName(profileData.full_name || '');
          setEditPhone(profileData.phone || '');
          setEditGender(profileData.gender || '');
          if (profileData.birthday) {
            setEditBirthday(profileData.birthday.split('T')[0]);
          } else {
            setEditBirthday('');
          }
        }

        if (ordersRes.ok) {
          const ordersData: Order[] = await ordersRes.json();
          setOrders(ordersData);
        } else {
          setOrders([]);
        }
      } catch (fetchError) {
        console.error(t('account.errorLoadAccount'), fetchError);
      } finally {
        setLoading(false);
      }
    };

    fetchAccountData();
  }, [token]);

  // Fetch addresses when tab switches
  useEffect(() => {
    if (activeTab === 'addresses') {
      fetchAddresses();
    }
  }, [activeTab]);

  const fetchAddresses = async () => {
    setAddressLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: UserAddress[] = await res.json();
        setAddresses(data);
      }
    } catch (err) {
      console.error(t('account.errorLoadAddress'), err);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: editFullName,
          phone: editPhone,
          gender: editGender || undefined,
          birthday: editBirthday || undefined,
        }),
      });

      if (!res.ok) {
        setMessage({ type: 'error', text: t('account.errorUpdateProfile') });
        return;
      }

      const updatedProfile: UserProfile = await res.json();
      setProfile(updatedProfile);
      setMessage({ type: 'success', text: t('account.updateProfileSuccess') });
    } catch (updateError) {
      console.error(updateError);
      setMessage({ type: 'error', text: t('account.networkError') });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm(t('account.confirmDeleteAccount'))) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/users/profile`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        toast(`${t('account.errorPrefix')}${errorData?.message || t('account.errorDeleteAccount')}`, 'error');
        return;
      }

      localStorage.removeItem('token');
      setToken(null);
      navigate('/');
    } catch (deleteError) {
      console.error(deleteError);
      toast(t('account.errorDeleteAccountGeneral'), 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    navigate('/');
  };

  // --- Address handlers ---

  const openAddForm = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm);
    setAddressMessage({ type: '', text: '' });
    setShowAddressForm(true);
  };

  const openEditForm = (addr: UserAddress) => {
    setEditingAddressId(addr.address_id);
    setAddressForm({
      receiver_name: addr.receiver_name,
      phone: addr.phone,
      province: addr.province,
      district: addr.district,
      ward: addr.ward,
      street: addr.street,
      is_default: addr.is_default,
      address_type: addr.address_type as 'home' | 'office',
    });
    setAddressMessage({ type: '', text: '' });
    setShowAddressForm(true);
  };

  const closeAddressForm = () => {
    setShowAddressForm(false);
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm);
    setAddressMessage({ type: '', text: '' });
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAddr(true);
    setAddressMessage({ type: '', text: '' });

    const body = {
      receiver_name: addressForm.receiver_name,
      phone: addressForm.phone,
      province: addressForm.province,
      district: addressForm.district,
      ward: addressForm.ward,
      street: addressForm.street,
      is_default: addressForm.is_default,
      address_type: addressForm.address_type,
    };

    try {
      const url = editingAddressId
        ? `${API_BASE_URL}/users/addresses/${editingAddressId}`
        : `${API_BASE_URL}/users/addresses`;

      const res = await fetch(url, {
        method: editingAddressId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        setAddressMessage({ type: 'error', text: errData?.message || t('account.errorGeneral') });
        return;
      }

      setAddressMessage({ type: 'success', text: editingAddressId ? t('account.updateAddressSuccess') : t('account.addAddressSuccess') });
      await fetchAddresses();
      closeAddressForm();
    } catch {
      setAddressMessage({ type: 'error', text: t('account.networkError') });
    } finally {
      setIsSavingAddr(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (!window.confirm(t('account.confirmDeleteAddress'))) return;

    try {
      const res = await fetch(`${API_BASE_URL}/users/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        toast(t('account.errorDeleteAddress'), 'error');
        return;
      }

      toast(t('account.deleteAddressSuccess'), 'success');
      await fetchAddresses();
    } catch {
      toast(t('account.errorDeleteAddressGeneral'), 'error');
    }
  };

  const formatPrice = (price: string | number) => {
    const numPrice = Number(price);
    if (i18n.language === 'en') {
      const usdPrice = numPrice / 25000;
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(usdPrice);
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(numPrice);
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const renderStatusBadge = (status: string) => {
    const statusMeta = getOrderStatusMeta(status);
    const translationKey = `orderStatus.${status?.toLowerCase()}`;
    // Use translation if it exists, otherwise fallback to the meta label
    const label = i18n.exists(translationKey) ? t(translationKey) : statusMeta.label;
    
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusMeta.badgeClassName}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-dark-bg min-h-screen py-12 px-4">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-serif font-bold text-slate-900 dark:text-dark-text mb-8">{t('account.myAccount')}</h1>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 shrink-0">
            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border p-4 sticky top-24">
              <div className="flex items-center gap-3 mb-6 px-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-dark-accent rounded-full flex items-center justify-center font-bold text-xl uppercase shrink-0">
                  {profile?.full_name?.charAt(0) || profile?.email?.charAt(0) || 'U'}
                </div>
                <div className="overflow-hidden">
                  <p className="font-bold text-slate-900 dark:text-dark-text truncate">{profile?.full_name || t('account.member')}</p>
                  <p className="text-sm text-slate-500 dark:text-dark-text-muted truncate">{profile?.email}</p>
                </div>
              </div>

              <nav className="space-y-1">
                <button
                  onClick={() => {
                    setActiveTab('profile');
                    setMessage({ type: '', text: '' });
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    activeTab === 'profile' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-dark-accent' : 'text-slate-600 dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-hover'
                  }`}
                >
                  <User size={20} /> {t('account.personalInfo')}
                </button>
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    activeTab === 'orders' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-dark-accent' : 'text-slate-600 dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-hover'
                  }`}
                >
                  <ShoppingBag size={20} /> {t('account.orderHistory')}
                </button>
                <button
                  onClick={() => setActiveTab('addresses')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    activeTab === 'addresses' ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-dark-accent' : 'text-slate-600 dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-hover'
                  }`}
                >
                  <MapPin size={20} /> {t('account.addressBook')}
                </button>
                <div className="h-px bg-slate-100 dark:bg-dark-border my-2 mx-4" />
                <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-rose-600 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40">
                  <LogOut size={20} /> {t('account.logout')}
                </button>
              </nav>
            </div>
          </div>

          <div className="flex-1">
            {/* --- Profile Tab --- */}
            {activeTab === 'profile' && (
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border p-6 md:p-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6 pb-4 border-b border-slate-100 dark:border-dark-border">{t('account.personalInfo')}</h2>

                {message.text && (
                  <div
                    className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                      message.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-900'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-100 dark:border-rose-900'
                    }`}
                  >
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    {message.text}
                  </div>
                )}

                <form className="space-y-6 max-w-lg" onSubmit={handleUpdateProfile}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.fullName')}</label>
                    <input
                      type="text"
                      value={editFullName}
                      onChange={(e) => setEditFullName(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.email')}</label>
                    <input
                      type="email"
                      disabled
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-dark-bg border dark:border-dark-border text-slate-500 dark:text-dark-text-muted rounded-lg"
                      value={profile?.email || ''}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.phone')}</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                      placeholder={t('account.phonePlaceholder')}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.gender')}</label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-dark-bg dark:text-dark-text"
                    >
                      <option value="">{t('account.notUpdated')}</option>
                      <option value="male">{t('account.male')}</option>
                      <option value="female">{t('account.female')}</option>
                      <option value="other">{t('account.other')}</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.birthday')}</label>
                    <input
                      type="date"
                      value={editBirthday}
                      onChange={(e) => setEditBirthday(e.target.value)}
                      className="w-full px-4 py-2 border dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 dark:bg-dark-accent text-white font-bold rounded-lg hover:bg-indigo-700 dark:hover:bg-dark-accent-hover disabled:opacity-70">
                    {isSaving ? t('account.saving') : t('account.saveChanges')}
                  </button>
                </form>

                <div className="mt-12 pt-8 border-t border-rose-100 dark:border-rose-900">
                  <h3 className="text-lg font-bold text-rose-600 dark:text-rose-300 mb-2 flex items-center gap-2">
                    <AlertCircle size={20} /> {t('account.deleteAccount')}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-dark-text-muted mb-5 leading-relaxed max-w-lg">
                    {t('account.deleteAccountWarning')}
                  </p>
                  <button
                    onClick={handleDeleteAccount}
                    className="px-5 py-2.5 bg-white dark:bg-dark-surface border-2 border-rose-600 dark:border-rose-700 text-rose-600 dark:text-rose-300 font-bold rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 transition-colors"
                  >
                    {t('account.deleteAccountConfirm')}
                  </button>
                </div>
              </div>
            )}

            {/* --- Orders Tab --- */}
            {activeTab === 'orders' && (
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border p-6 md:p-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text mb-6 pb-4 border-b border-slate-100 dark:border-dark-border">{t('account.orderHistory')}</h2>

                {orders.length === 0 ? (
                  <div className="text-center py-12">
                    <ShoppingBag className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-dark-text-muted font-medium">{t('account.noOrders')}</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {orders.map((order) => (
                      <div key={order.order_code} className="border dark:border-dark-border rounded-xl overflow-hidden">
                        <div className="bg-slate-50 dark:bg-dark-bg px-6 py-4 flex flex-wrap gap-4 justify-between items-center border-b dark:border-dark-border">
                          <div>
                            <p className="text-sm text-slate-500 dark:text-dark-text-muted">{t('account.orderCode')}</p>
                            <p className="font-bold">{order.order_code}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500 dark:text-dark-text-muted">{t('account.orderDate')}</p>
                            <p className="font-bold">{formatDate(order.created_at)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-500 dark:text-dark-text-muted">{t('account.totalAmount')}</p>
                            <p className="font-bold text-indigo-600 dark:text-dark-accent">{formatPrice(order.total_amount)}</p>
                          </div>
                          <div>{renderStatusBadge(order.status)}</div>
                        </div>

                        {order.items?.map((item, index) => (
                          <div key={`${order.order_code}-${index}`} className="px-6 py-4 flex items-center gap-4 border-b dark:border-dark-border last:border-0">
                            <img
                              src={item.book.cover_url || 'https://placehold.co/100x150'}
                              alt={item.book.title}
                              className="w-16 h-20 bg-slate-200 dark:bg-dark-surface-hover rounded object-cover"
                            />
                            <div>
                              <p className="font-bold text-slate-900 dark:text-dark-text">{item.book.title}</p>
                              <p className="text-sm text-slate-500 dark:text-dark-text-muted">
                                {t('account.quantity')}: {item.quantity} x {formatPrice(item.unit_price)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* --- Addresses Tab --- */}
            {activeTab === 'addresses' && (
              <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-slate-100 dark:border-dark-border p-6 md:p-8">
                <div className="flex justify-between items-center mb-6 pb-4 border-b dark:border-dark-border">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-dark-text">{t('account.addressBook')}</h2>
                  {!showAddressForm && (
                    <button
                      onClick={openAddForm}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-dark-accent text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-dark-accent-hover transition-colors"
                    >
                      <Plus size={18} /> {t('account.addNewAddress')}
                    </button>
                  )}
                </div>

                {/* Address form */}
                {showAddressForm && (
                  <form onSubmit={handleSaveAddress} className="mb-8 p-6 border dark:border-dark-border rounded-xl bg-slate-50 dark:bg-dark-bg">
                    <h3 className="font-bold text-slate-800 dark:text-dark-text mb-4">
                      {editingAddressId ? t('account.editAddress') : t('account.addNewAddress')}
                    </h3>

                    {addressMessage.text && (
                      <div
                        className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
                          addressMessage.type === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {addressMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        {addressMessage.text}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.receiverName')}</label>
                        <input
                          type="text"
                          value={addressForm.receiver_name}
                          onChange={(e) => setAddressForm({ ...addressForm, receiver_name: e.target.value })}
                          className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.phoneNumber')}</label>
                        <input
                          type="tel"
                          value={addressForm.phone}
                          onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.province')}</label>
                        <select
                          value={addressForm.province}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddressForm({ ...addressForm, province: val, district: '', ward: '' });
                            fetchDistricts(val);
                          }}
                          className="w-full px-3 py-2 border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-dark-surface dark:text-dark-text"
                          required
                        >
                          <option value="">{t('account.selectProvince')}</option>
                          {provinces.map((p) => (
                            <option key={p.code} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.district')}</label>
                        <select
                          value={addressForm.district}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAddressForm({ ...addressForm, district: val, ward: '' });
                            fetchWards(val);
                          }}
                          disabled={!addressForm.province || loadingDistricts}
                          className="w-full px-3 py-2 border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-dark-surface dark:text-dark-text disabled:bg-slate-100 dark:disabled:bg-dark-surface-hover"
                          required
                        >
                          <option value="">{loadingDistricts ? t('account.loading') : t('account.selectDistrict')}</option>
                          {districts.map((d) => (
                            <option key={d.code} value={d.name}>{d.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.ward')}</label>
                        <select
                          value={addressForm.ward}
                          onChange={(e) => setAddressForm({ ...addressForm, ward: e.target.value })}
                          disabled={!addressForm.district || loadingWards}
                          className="w-full px-3 py-2 border dark:border-dark-border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-dark-surface dark:text-dark-text disabled:bg-slate-100 dark:disabled:bg-dark-surface-hover"
                          required
                        >
                          <option value="">{loadingWards ? t('account.loading') : t('account.selectWard')}</option>
                          {wards.map((w) => (
                            <option key={w.code} value={w.name}>{w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.streetAddress')}</label>
                        <input
                          type="text"
                          value={addressForm.street}
                          onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                          className="w-full px-3 py-2 border dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-6">
                      {/* Address type */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700 dark:text-dark-text">{t('account.addressType')}</label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="addrType"
                            value="home"
                            checked={addressForm.address_type === 'home'}
                            onChange={() => setAddressForm({ ...addressForm, address_type: 'home' })}
                            className="accent-indigo-600"
                          />
                          <Home size={16} className="text-slate-500 dark:text-dark-text-muted" />
                          <span className="text-sm text-slate-600 dark:text-dark-text-muted">{t('account.home')}</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="addrType"
                            value="office"
                            checked={addressForm.address_type === 'office'}
                            onChange={() => setAddressForm({ ...addressForm, address_type: 'office' })}
                            className="accent-indigo-600"
                          />
                          <Building2 size={16} className="text-slate-500 dark:text-dark-text-muted" />
                          <span className="text-sm text-slate-600 dark:text-dark-text-muted">{t('account.office')}</span>
                        </label>
                      </div>

                      {/* Default checkbox */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={addressForm.is_default}
                          onChange={(e) => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                          className="accent-indigo-600 w-4 h-4"
                        />
                        <span className="text-sm text-slate-600 dark:text-dark-text-muted">{t('account.setAsDefault')}</span>
                      </label>
                    </div>

                    <div className="mt-5 flex gap-3">
                      <button
                        type="submit"
                        disabled={isSavingAddr}
                        className="px-5 py-2 bg-indigo-600 dark:bg-dark-accent text-white rounded-lg text-sm font-medium hover:bg-indigo-700 dark:hover:bg-dark-accent-hover disabled:opacity-70"
                      >
                        {isSavingAddr ? t('account.saving') : t('account.save')}
                      </button>
                      <button
                        type="button"
                        onClick={closeAddressForm}
                        className="px-5 py-2 border border-slate-200 dark:border-dark-border rounded-lg text-sm text-slate-600 dark:text-dark-text-muted hover:bg-slate-50 dark:hover:bg-dark-surface-hover"
                      >
                        {t('account.cancel')}
                      </button>
                      {editingAddressId && (
                        <button
                          type="button"
                          onClick={() => {
                            if (editingAddressId) {
                              handleDeleteAddress(editingAddressId);
                              closeAddressForm();
                            }
                          }}
                          className="px-5 py-2 ml-auto border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 rounded-lg text-sm font-medium hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        >
                          <Trash2 size={16} className="inline mr-1" /> {t('account.delete')}
                        </button>
                      )}
                    </div>
                  </form>
                )}

                {/* Address list */}
                {addressLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                  </div>
                ) : addresses.length === 0 && !showAddressForm ? (
                  <div className="text-center py-12">
                    <MapPin className="w-16 h-16 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                    <p className="text-slate-500 dark:text-dark-text-muted font-medium">{t('account.noAddress')}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.address_id}
                        className="border dark:border-dark-border rounded-xl p-4 hover:border-indigo-200 dark:hover:border-indigo-700 transition-colors cursor-pointer relative"
                        onClick={() => openEditForm(addr)}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {addr.address_type === 'office' ? (
                              <Building2 size={18} className="text-slate-400 dark:text-dark-text-muted" />
                            ) : (
                              <Home size={18} className="text-slate-400 dark:text-dark-text-muted" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-slate-900 dark:text-dark-text">{addr.receiver_name}</span>
                              <span className="text-slate-400 dark:text-dark-text-muted">|</span>
                              <span className="text-slate-600 dark:text-dark-text-muted text-sm">{addr.phone}</span>
                              {addr.is_default && (
                                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-dark-accent rounded">
                                  {t('account.default')}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-dark-text-muted">
                              {addr.street}, {addr.ward}, {addr.district}, {addr.province}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openEditForm(addr)}
                              className="p-1.5 text-slate-400 dark:text-dark-text-muted hover:text-indigo-600 dark:hover:text-dark-accent rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface-hover"
                              title={t('account.edit')}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(addr.address_id)}
                              className="p-1.5 text-slate-400 dark:text-dark-text-muted hover:text-rose-600 dark:hover:text-rose-300 rounded-lg hover:bg-slate-50 dark:hover:bg-dark-surface-hover"
                              title={t('account.delete')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
