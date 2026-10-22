import { createContext, useState, useEffect, useContext, type ReactNode } from 'react';
import { useToast } from '../components/Toast';
import { API_BASE_URL } from '../config/api';

interface CartItem {
  bookId: string;
  quantity: number;
}

interface CartContextType {
  token: string | null;
  guestId: string;
  cartItems: CartItem[];
  setToken: (token: string | null) => void;
  fetchCart: () => void;
  handleAddToCart: (bookId: string, quantity?: number) => Promise<void>;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [guestId] = useState<string>(() => {
    let id = localStorage.getItem('guest_id');
    if (!id) {
      id = 'guest:' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('guest_id', id);
    }
    return id;
  });
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const { toast } = useToast();

  const fetchCart = () => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      headers['x-guest-id'] = guestId;
    }

    fetch(`${API_BASE_URL}/cart`, { headers })
    .then(res => res.json())
    .then(data => {
      if(data && data.items) setCartItems(data.items);
    })
    .catch(err => console.error('Error fetching cart:', err));
  };

  useEffect(() => {
    fetchCart();
  }, [token, guestId]);

  const handleAddToCart = async (bookId: string, quantity: number = 1) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      headers['x-guest-id'] = guestId;
    }

    const res = await fetch(`${API_BASE_URL}/cart/add`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ bookId, quantity })
    });
    
    if (res.ok) {
      fetchCart();
      toast("Đã thêm vào giỏ hàng!", 'success');
    } else {
      toast("Không thể thêm vào giỏ hàng", 'error');
    }
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ token, guestId, cartItems, setToken, fetchCart, handleAddToCart, cartCount }}>
      {children}
    </CartContext.Provider>
  );
}

// Custom hook để dùng cho tiện
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};