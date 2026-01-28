import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ProductModel, productModels as initialModels, PricingTier } from '@/data/productModels';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProductModelsContextType {
  models: ProductModel[];
  addModel: (model: ProductModel) => void;
  updateModel: (model: ProductModel) => void;
  deleteModel: (id: string) => void;
  getModelByName: (name: string) => ProductModel | undefined;
  isLoading: boolean;
}

const ProductModelsContext = createContext<ProductModelsContextType | undefined>(undefined);

export const ProductModelsProvider = ({ children }: { children: ReactNode }) => {
  const [models, setModels] = useState<ProductModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Load models from Supabase on mount
  useEffect(() => {
    const loadModels = async () => {
      try {
        const { data, error } = await supabase
          .from('product_models')
          .select('*')
          .order('name');

        if (error) throw error;

        if (data && data.length > 0) {
          // Map database format to app format
          const mappedModels: ProductModel[] = data.map(row => ({
            id: row.id,
            name: row.name,
            description: row.description || '',
            pricingTiers: (row.pricing_tiers as unknown as PricingTier[]) || [],
          }));
          setModels(mappedModels);
        } else {
          // Seed initial models if database is empty
          await seedInitialModels();
        }
      } catch (error) {
        console.error('Failed to load product models:', error);
        toast({
          title: 'Error',
          description: 'Failed to load product models from database.',
          variant: 'destructive',
        });
        // Fallback to initial models
        setModels(initialModels);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();
  }, []);

  const seedInitialModels = async () => {
    try {
      const modelsToInsert = initialModels.map(model => ({
        id: model.id,
        name: model.name,
        description: model.description,
        pricing_tiers: JSON.parse(JSON.stringify(model.pricingTiers)),
      }));

      const { data, error } = await supabase
        .from('product_models')
        .insert(modelsToInsert)
        .select();

      if (error) throw error;

      if (data) {
        const mappedModels: ProductModel[] = data.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          pricingTiers: (row.pricing_tiers as unknown as PricingTier[]) || [],
        }));
        setModels(mappedModels);
      }
    } catch (error) {
      console.error('Failed to seed initial models:', error);
      setModels(initialModels);
    }
  };

  const addModel = async (model: ProductModel) => {
    try {
      const { data, error } = await supabase
        .from('product_models')
        .insert({
          name: model.name,
          description: model.description,
          pricing_tiers: JSON.parse(JSON.stringify(model.pricingTiers)),
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        const newModel: ProductModel = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          pricingTiers: (data.pricing_tiers as unknown as PricingTier[]) || [],
        };
        setModels(prev => [...prev, newModel]);
      }
    } catch (error) {
      console.error('Failed to add model:', error);
      toast({
        title: 'Error',
        description: 'Failed to save product model.',
        variant: 'destructive',
      });
    }
  };

  const updateModel = async (model: ProductModel) => {
    // Optimistically update the UI first
    setModels(prev => prev.map(m => m.id === model.id ? model : m));
    
    try {
      const { error } = await supabase
        .from('product_models')
        .update({
          name: model.name,
          description: model.description,
          pricing_tiers: JSON.parse(JSON.stringify(model.pricingTiers)),
        })
        .eq('id', model.id);

      if (error) throw error;
      
      console.log('Product model updated successfully:', model.name);
    } catch (error) {
      console.error('Failed to update model:', error);
      // Revert the optimistic update by reloading from database
      const { data } = await supabase.from('product_models').select('*').order('name');
      if (data) {
        const mappedModels: ProductModel[] = data.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description || '',
          pricingTiers: (row.pricing_tiers as unknown as PricingTier[]) || [],
        }));
        setModels(mappedModels);
      }
      toast({
        title: 'Error',
        description: 'Failed to update product model.',
        variant: 'destructive',
      });
    }
  };

  const deleteModel = async (id: string) => {
    try {
      const { error } = await supabase
        .from('product_models')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setModels(prev => prev.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to delete model:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete product model.',
        variant: 'destructive',
      });
    }
  };

  const getModelByName = (name: string): ProductModel | undefined => {
    return models.find(m => 
      name.toLowerCase().includes(m.name.toLowerCase())
    );
  };

  return (
    <ProductModelsContext.Provider value={{ models, addModel, updateModel, deleteModel, getModelByName, isLoading }}>
      {children}
    </ProductModelsContext.Provider>
  );
};

export const useProductModels = () => {
  const context = useContext(ProductModelsContext);
  if (!context) {
    throw new Error('useProductModels must be used within a ProductModelsProvider');
  }
  return context;
};
