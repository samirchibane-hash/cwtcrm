import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { orders as initialOrders, Order } from '@/data/orders';

interface OrdersContextType {
  orders: Order[];
  updateOrder: (order: Order) => void;
  getOrderById: (id: string) => Order | undefined;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

const STORAGE_KEY = 'crm-orders';

// Load from localStorage or use initial orders
const loadOrders = (): Order[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load orders from storage:', e);
  }
  return initialOrders;
};

// Save to localStorage
const saveOrders = (orders: Order[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('Failed to save orders to storage:', e);
  }
};

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>(loadOrders);

  // Persist changes to localStorage
  useEffect(() => {
    saveOrders(orders);
  }, [orders]);

  const updateOrder = (updatedOrder: Order) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find(o => o.id === id);
  };

  return (
    <OrdersContext.Provider value={{ orders, updateOrder, getOrderById }}>
      {children}
    </OrdersContext.Provider>
  );
};

export const useOrders = () => {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrdersProvider');
  }
  return context;
};
