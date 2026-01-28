import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { productModels as initialModels, ProductModel } from '@/data/productModels';

interface ProductModelsContextType {
  models: ProductModel[];
  addModel: (model: ProductModel) => void;
  updateModel: (model: ProductModel) => void;
  deleteModel: (id: string) => void;
  getModelByName: (name: string) => ProductModel | undefined;
}

const ProductModelsContext = createContext<ProductModelsContextType | undefined>(undefined);

const STORAGE_KEY = 'product-models';

// Load from localStorage or use initial models
const loadModels = (): ProductModel[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load product models from storage:', e);
  }
  return initialModels;
};

// Save to localStorage
const saveModels = (models: ProductModel[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(models));
  } catch (e) {
    console.error('Failed to save product models to storage:', e);
  }
};

export const ProductModelsProvider = ({ children }: { children: ReactNode }) => {
  const [models, setModels] = useState<ProductModel[]>(loadModels);

  // Persist changes to localStorage
  useEffect(() => {
    saveModels(models);
  }, [models]);

  const addModel = (model: ProductModel) => {
    setModels(prev => [...prev, model]);
  };

  const updateModel = (model: ProductModel) => {
    setModels(prev => prev.map(m => m.id === model.id ? model : m));
  };

  const deleteModel = (id: string) => {
    setModels(prev => prev.filter(m => m.id !== id));
  };

  const getModelByName = (name: string): ProductModel | undefined => {
    return models.find(m => 
      name.toLowerCase().includes(m.name.toLowerCase())
    );
  };

  return (
    <ProductModelsContext.Provider value={{ models, addModel, updateModel, deleteModel, getModelByName }}>
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
