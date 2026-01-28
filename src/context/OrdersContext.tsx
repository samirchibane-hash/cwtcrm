import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { orders as initialOrders, Order, OrderModelItem } from '@/data/orders';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OrdersContextType {
  orders: Order[];
  updateOrder: (order: Order) => void;
  deleteOrder: (id: string) => void;
  getOrderById: (id: string) => Order | undefined;
  addOrder: (order: Omit<Order, 'id'>) => Promise<Order | null>;
  isLoading: boolean;
}

const OrdersContext = createContext<OrdersContextType | undefined>(undefined);

export const OrdersProvider = ({ children }: { children: ReactNode }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load orders from Supabase on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          // Map database format to app format
          const mappedOrders: Order[] = data.map(row => {
            const modelItemsRaw = row.model_items as unknown as any[];
            // Extract tracking/orderUpdates from the last item if present
            const metaItem = modelItemsRaw?.find((item: any) => 'tracking' in item || 'orderUpdates' in item);
            const modelItems = (modelItemsRaw?.filter((item: any) => 'quantity' in item) || []) as OrderModelItem[];
            
            return {
              id: row.id,
              customer: row.company,
              placed: row.order_total,
              units: modelItems.reduce((sum, item) => sum + (item.quantity || 0), 0),
              modelType: row.model_type || '',
              modelItems,
              totalValue: Number(row.total_value) || 0,
              invoice: row.po_number || '',
              status: row.status as Order['status'],
              tracking: metaItem?.tracking || '',
              orderUpdates: metaItem?.orderUpdates || '',
              orderType: (row.order_type as Order['orderType']) || 'Standard',
            };
          });
          setOrders(mappedOrders);
        } else {
          // Seed initial orders if database is empty
          await seedInitialOrders();
        }
      } catch (error) {
        console.error('Failed to load orders:', error);
        toast({
          title: 'Error',
          description: 'Failed to load orders from database.',
          variant: 'destructive',
        });
        // Fallback to initial orders
        setOrders(initialOrders);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrders();
  }, []);

  const seedInitialOrders = async () => {
    try {
      const ordersToInsert = initialOrders.map(order => ({
        id: order.id,
        po_number: order.invoice,
        company: order.customer,
        order_total: order.placed,
        status: order.status,
        order_type: order.orderType || 'Standard',
        model_type: order.modelType,
        model_items: JSON.parse(JSON.stringify([
          ...order.modelItems,
          { tracking: order.tracking, orderUpdates: order.orderUpdates }
        ])),
        total_value: order.totalValue,
      }));

      const { data, error } = await supabase
        .from('orders')
        .insert(ordersToInsert)
        .select();

      if (error) throw error;

      if (data) {
        setOrders(initialOrders);
      }
    } catch (error) {
      console.error('Failed to seed initial orders:', error);
      setOrders(initialOrders);
    }
  };

  const updateOrder = async (updatedOrder: Order) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          po_number: updatedOrder.invoice,
          company: updatedOrder.customer,
          order_total: updatedOrder.placed,
          status: updatedOrder.status,
          order_type: updatedOrder.orderType || 'Standard',
          model_type: updatedOrder.modelType,
          model_items: JSON.parse(JSON.stringify([
            ...updatedOrder.modelItems,
            { tracking: updatedOrder.tracking, orderUpdates: updatedOrder.orderUpdates }
          ])),
          total_value: updatedOrder.totalValue,
        })
        .eq('id', updatedOrder.id);

      if (error) throw error;

      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    } catch (error) {
      console.error('Failed to update order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order.',
        variant: 'destructive',
      });
    }
  };

  const deleteOrder = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (error) {
      console.error('Failed to delete order:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    }
  };

  const getOrderById = (id: string): Order | undefined => {
    return orders.find(o => o.id === id);
  };

  const addOrder = async (orderData: Omit<Order, 'id'>): Promise<Order | null> => {
    try {
      // Calculate total value based on model items and order type
      let totalValue = 0;
      if (orderData.orderType === 'Standard') {
        // Simple calculation - you may want to use the pricing tier logic
        totalValue = orderData.totalValue || 0;
      }

      const { data, error } = await supabase
        .from('orders')
        .insert({
          po_number: orderData.invoice || '',
          company: orderData.customer,
          order_total: orderData.placed,
          status: orderData.status,
          order_type: orderData.orderType || 'Standard',
          model_type: orderData.modelType,
          model_items: JSON.parse(JSON.stringify([
            ...orderData.modelItems,
            { tracking: orderData.tracking || '', orderUpdates: orderData.orderUpdates || '' }
          ])),
          total_value: totalValue,
        })
        .select()
        .single();

      if (error) throw error;

      const newOrder: Order = {
        id: data.id,
        customer: data.company,
        placed: data.order_total,
        units: orderData.units,
        modelType: data.model_type || '',
        modelItems: orderData.modelItems,
        totalValue: Number(data.total_value) || 0,
        invoice: data.po_number || '',
        status: data.status as Order['status'],
        tracking: orderData.tracking || '',
        orderUpdates: orderData.orderUpdates || '',
        orderType: (data.order_type as Order['orderType']) || 'Standard',
      };

      setOrders(prev => [newOrder, ...prev]);
      return newOrder;
    } catch (error) {
      console.error('Failed to add order:', error);
      toast({
        title: 'Error',
        description: 'Failed to create order.',
        variant: 'destructive',
      });
      return null;
    }
  };

  return (
    <OrdersContext.Provider value={{ orders, updateOrder, deleteOrder, getOrderById, addOrder, isLoading }}>
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
