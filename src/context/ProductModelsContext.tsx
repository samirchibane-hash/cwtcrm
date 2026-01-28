import { createContext, useContext, useState, ReactNode } from 'react';
import { productModels as initialModels, ProductModel, createEmptyModel, defaultTierNames } from '@/data/productModels';

interface ProductModelsContextType {
  models: ProductModel[];
  addModel: (model: ProductModel) => void;
  updateModel: (model: ProductModel) => void;
  deleteModel: (id: string) => void;
  getModelByName: (name: string) => ProductModel | undefined;
}

const ProductModelsContext = createContext<ProductModelsContextType | undefined>(undefined);

export const ProductModelsProvider = ({ children }: { children: ReactNode }) => {
  const [models, setModels] = useState<ProductModel[]>(initialModels);

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
