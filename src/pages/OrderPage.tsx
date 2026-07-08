import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useOrders } from '@/context/OrdersContext';
import { Button } from '@/components/ui/button';
import OrderDetail from '@/components/OrderDetail';

const OrderPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useOrders();

  // Get previous and next order IDs for navigation across all orders
  const currentIndex = orders.findIndex(o => o.id === id);
  const prevOrderId = currentIndex > 0 ? orders[currentIndex - 1].id : null;
  const nextOrderId = currentIndex < orders.length - 1 ? orders[currentIndex + 1].id : null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => prevOrderId && navigate(`/order/${prevOrderId}`, { state: location.state })}
              disabled={!prevOrderId}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => nextOrderId && navigate(`/order/${nextOrderId}`, { state: location.state })}
              disabled={!nextOrderId}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        <OrderDetail
          orderId={id || ''}
          variant="page"
          onDeleted={() => navigate('/?view=orders')}
        />
      </main>
    </div>
  );
};

export default OrderPage;
