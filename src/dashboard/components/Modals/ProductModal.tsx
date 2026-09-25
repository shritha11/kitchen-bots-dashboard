import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateModal, EditModal } from './index';
import { ProductSchema, CommerceProduct } from '../../types/commerce';
import { z } from 'zod';

import { Input } from '../ui/Input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/Form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Checkbox } from '../ui/Checkbox';
import { Button } from '../ui/Button';
import { Text } from '../ui/Typography';
import { Plus, Trash2 } from 'lucide-react';
import { Textarea } from '../ui/Textarea';

// Schema for the form
const FormSchema = ProductSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

type FormData = z.infer<typeof FormSchema>;

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: FormData) => Promise<void>;
  initialData?: CommerceProduct | null;
}

export function ProductModal({ isOpen, onClose, onSubmit, initialData }: ProductModalProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema) as any,
    defaultValues: {
      name: '',
      sku: '',
      category: '',
      brand: '',
      shortDescription: '',
      description: '',
      images: [],
      tags: [],
      specifications: [],
      variants: [],
      isFeatured: false,
      status: 'Draft',
      visibility: 'Public'
    }
  });

  const { fields: specFields, append: appendSpec, remove: removeSpec } = useFieldArray({
    control: form.control,
    name: "specifications"
  });

  const { fields: variantFields, append: appendVariant, remove: removeVariant } = useFieldArray({
    control: form.control,
    name: "variants"
  });
  
  const { fields: imageFields, append: appendImage, remove: removeImage } = useFieldArray({
    control: form.control,
    name: "images"
  });

  useEffect(() => {
    if (initialData) {
      const normalizedImages = (initialData.images || []).map((img: any, idx: number) => {
        if (typeof img === 'string') {
          return { id: `img-${initialData.id || 'default'}-${idx + 1}`, url: img, type: 'image' as const, isPrimary: idx === 0, order: idx };
        }
        if (img && typeof img === 'object') {
          return {
            id: img.id || `img-${initialData.id || 'default'}-${idx + 1}`,
            url: img.url || '',
            type: img.type || 'image',
            isPrimary: img.isPrimary !== undefined ? Boolean(img.isPrimary) : idx === 0,
            order: img.order !== undefined ? Number(img.order) : idx
          };
        }
        return { id: `img-${initialData.id || 'default'}-${idx + 1}`, url: String(img || ''), type: 'image' as const, isPrimary: idx === 0, order: idx };
      });

      const normalizedSpecs = (initialData.specifications || []).map((s: any, idx: number) => {
        if (typeof s === 'string') {
          const [name, val] = s.split(': ');
          return { id: `spec-${initialData.id || 'default'}-${idx + 1}`, group: 'General', name: name || 'Spec', value: val || s };
        }
        return {
          id: s.id || `spec-${initialData.id || 'default'}-${idx + 1}`,
          group: s.group || 'General',
          name: s.name || '',
          value: s.value || ''
        };
      });

      form.reset({
        name: initialData.name,
        sku: initialData.sku,
        category: initialData.category,
        brand: initialData.brand || '',
        shortDescription: initialData.shortDescription || '',
        description: initialData.description || '',
        images: normalizedImages,
        tags: initialData.tags || [],
        specifications: normalizedSpecs,
        variants: initialData.variants || [],
        isFeatured: initialData.isFeatured,
        status: initialData.status,
        visibility: initialData.visibility
      });
    } else {
      form.reset({
        name: '',
        sku: '',
        category: '',
        brand: '',
        shortDescription: '',
        description: '',
        images: [],
        tags: [],
        specifications: [],
        variants: [],
        isFeatured: false,
        status: 'Draft',
        visibility: 'Public'
      });
    }
  }, [initialData, isOpen, form]);

  const onFormSubmit = async (data: FormData) => {
    try {
      await onSubmit(data);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  const ModalComponent = initialData ? EditModal : CreateModal;
  const title = initialData ? 'Edit Product' : 'Add New Product';
  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'variants' | 'images'>('basic');

  return (
    <ModalComponent
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="xl"
      onSubmit={form.handleSubmit(onFormSubmit)}
      isSubmitting={form.formState.isSubmitting}
    >
      <div className="flex border-b border-border mb-4">
        {['basic', 'specs', 'variants', 'images'].map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            onClick={() => setActiveTab(tab as any)}
          >
            {tab}
          </button>
        ))}
      </div>

      <Form {...form}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); form.handleSubmit(onFormSubmit)(e); }}>
          
          {/* BASIC TAB */}
          <div className={activeTab === 'basic' ? 'block' : 'hidden'}>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g., Commercial Oven" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Master SKU</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g., KB-OVEN-01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g., Cooking Equipment" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Brand</FormLabel>
                    <FormControl>
                      <Input type="text" placeholder="e.g., KitchenBots" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="shortDescription"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Short Description</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Brief summary" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="mt-4">
                  <FormLabel>Full Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Detailed product description..." className="min-h-[100px]" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Hidden">Hidden</SelectItem>
                        <SelectItem value="Archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select visibility" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Public">Public</SelectItem>
                        <SelectItem value="B2B_Only">B2B Only</SelectItem>
                        <SelectItem value="Hidden">Hidden</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center space-x-3 space-y-0 mt-6 bg-slate-50 p-4 rounded-lg border border-border-default">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal text-sm cursor-pointer">
                    Feature on Homepage
                  </FormLabel>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* SPECS TAB */}
          <div className={activeTab === 'specs' ? 'block' : 'hidden'}>
            <div className="flex justify-between items-center mb-4">
              <Text className="font-medium">Technical Specifications</Text>
              <Button type="button" variant="outline" size="sm" onClick={() => appendSpec({ id: crypto.randomUUID(), group: 'General', name: '', value: '' })}>
                <Plus size={16} className="mr-2" /> Add Spec
              </Button>
            </div>
            
            {specFields.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border-default rounded-lg text-slate-500">
                No specifications added yet.
              </div>
            ) : (
              <div className="space-y-4">
                {specFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-border-default rounded-lg">
                    <FormField
                      control={form.control}
                      name={`specifications.${index}.group`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Group</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Electrical" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`specifications.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Voltage" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`specifications.${index}.value`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel className="text-xs">Value</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. 220V" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" className="mt-6 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeSpec(index)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VARIANTS TAB */}
          <div className={activeTab === 'variants' ? 'block' : 'hidden'}>
            <div className="flex justify-between items-center mb-4">
              <Text className="font-medium">Product Variants</Text>
              <Button type="button" variant="outline" size="sm" onClick={() => appendVariant({ 
                id: crypto.randomUUID(), 
                productId: initialData?.id || '', 
                name: '', 
                sku: '', 
                price: 0, 
                status: 'Active',
                weightUnit: 'kg',
                images: [], 
                specifications: [] 
              })}>
                <Plus size={16} className="mr-2" /> Add Variant
              </Button>
            </div>

            {variantFields.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border-default rounded-lg text-slate-500">
                No variants added. The product itself will be the only item.
              </div>
            ) : (
              <div className="space-y-4">
                {variantFields.map((field, index) => (
                  <div key={field.id} className="p-4 bg-slate-50 border border-border-default rounded-lg relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeVariant(index)}>
                      <Trash2 size={16} />
                    </Button>
                    <div className="grid grid-cols-2 gap-4 mr-8">
                      <FormField
                        control={form.control}
                        name={`variants.${index}.name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Variant Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Large / Red" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${index}.sku`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Variant SKU</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. KB-OVEN-01-L-R" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${index}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Price</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} onChange={e => field.onChange(parseFloat(e.target.value))} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`variants.${index}.status`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Active">Active</SelectItem>
                                <SelectItem value="Draft">Draft</SelectItem>
                                <SelectItem value="Discontinued">Discontinued</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IMAGES TAB */}
          <div className={activeTab === 'images' ? 'block' : 'hidden'}>
            <div className="flex justify-between items-center mb-4">
              <Text className="font-medium">Product Media</Text>
              <Button type="button" variant="outline" size="sm" onClick={() => appendImage({ id: crypto.randomUUID(), url: '', type: 'image', isPrimary: imageFields.length === 0, order: imageFields.length })}>
                <Plus size={16} className="mr-2" /> Add Media
              </Button>
            </div>

            {imageFields.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border-default rounded-lg text-slate-500">
                No images added yet.
              </div>
            ) : (
              <div className="space-y-4">
                {imageFields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-4 p-3 bg-slate-50 border border-border-default rounded-lg">
                    <div className="w-16 h-16 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                      {form.watch(`images.${index}.url`) ? (
                        <img src={form.watch(`images.${index}.url`)} alt="preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No img</div>
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name={`images.${index}.url`}
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel className="text-xs">Media URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://..." {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`images.${index}.isPrimary`}
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-4">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <FormLabel className="text-xs font-normal">Primary Image</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeImage(index)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </form>
      </Form>
    </ModalComponent>
  );
}
