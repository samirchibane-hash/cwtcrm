import { useState } from 'react';
import { Plus, Pencil, Trash2, Package, DollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { productModels as initialModels, ProductModel, createEmptyModel, defaultTierNames } from '@/data/productModels';

const ProductModelsDialog = () => {
  const [models, setModels] = useState<ProductModel[]>(initialModels);
  const [editingModel, setEditingModel] = useState<ProductModel | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const { toast } = useToast();

  const handleSaveModel = () => {
    if (!editingModel) return;

    if (!editingModel.name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Model name is required.',
        variant: 'destructive',
      });
      return;
    }

    setModels(prev => {
      const existingIndex = prev.findIndex(m => m.id === editingModel.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = editingModel;
        return updated;
      }
      return [...prev, editingModel];
    });

    toast({
      title: isAddingNew ? 'Model Added' : 'Model Updated',
      description: `${editingModel.name} has been saved.`,
    });

    setEditingModel(null);
    setIsAddingNew(false);
  };

  const handleDeleteModel = (id: string) => {
    const model = models.find(m => m.id === id);
    setModels(prev => prev.filter(m => m.id !== id));
    toast({
      title: 'Model Deleted',
      description: `${model?.name} has been removed.`,
    });
  };

  const handleAddNew = () => {
    setEditingModel(createEmptyModel());
    setIsAddingNew(true);
  };

  const handleEditModel = (model: ProductModel) => {
    setEditingModel({ ...model, pricingTiers: model.pricingTiers.map(t => ({ ...t })) });
    setIsAddingNew(false);
  };

  const handleTierPriceChange = (tierIndex: number, price: string) => {
    if (!editingModel) return;
    const newTiers = [...editingModel.pricingTiers];
    newTiers[tierIndex] = { ...newTiers[tierIndex], price: parseFloat(price) || 0 };
    setEditingModel({ ...editingModel, pricingTiers: newTiers });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Package className="h-4 w-4 mr-2" />
          Product Models
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Product Models & Pricing
          </DialogTitle>
        </DialogHeader>

        {editingModel ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="model-name">Model Name</Label>
                <Input
                  id="model-name"
                  value={editingModel.name}
                  onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                  placeholder="e.g., 2 GPM"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="model-description">Description</Label>
                <Input
                  id="model-description"
                  value={editingModel.description}
                  onChange={(e) => setEditingModel({ ...editingModel, description: e.target.value })}
                  placeholder="Brief description..."
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2 mb-3">
                <DollarSign className="h-4 w-4" />
                Pricing Tiers
              </Label>
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">Tier</TableHead>
                      <TableHead className="font-semibold text-right">Price ($)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editingModel.pricingTiers.map((tier, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{tier.name}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            value={tier.price}
                            onChange={(e) => handleTierPriceChange(index, e.target.value)}
                            className="w-32 ml-auto text-right"
                            min="0"
                            step="100"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingModel(null);
                  setIsAddingNew(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveModel}>
                {isAddingNew ? 'Add Model' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleAddNew} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Model
              </Button>
            </div>

            <Accordion type="single" collapsible className="w-full">
              {models.map((model) => (
                <AccordionItem key={model.id} value={model.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{model.name}</span>
                      {model.description && (
                        <span className="text-sm text-muted-foreground">— {model.description}</span>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pt-2 space-y-4">
                      <div className="rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="font-semibold">Tier</TableHead>
                              <TableHead className="font-semibold text-right">Price</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {model.pricingTiers.map((tier, index) => (
                              <TableRow key={index}>
                                <TableCell>{tier.name}</TableCell>
                                <TableCell className="text-right font-mono">
                                  ${tier.price.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditModel(model)}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteModel(model.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>

            {models.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No product models yet. Add your first model to get started.</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ProductModelsDialog;
