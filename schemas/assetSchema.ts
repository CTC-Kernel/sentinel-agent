import { z } from 'zod';
import { Criticality } from '../types';

export const assetSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    type: z.enum(['Matériel', 'Logiciel', 'Données', 'Service', 'Humain'], {
        error: "Le type est requis",
    }),
    owner: z.string().min(1, "Le propriétaire est requis"),
    confidentiality: z.nativeEnum(Criticality),
    integrity: z.nativeEnum(Criticality),
    availability: z.nativeEnum(Criticality),
    location: z.string().optional(),
    purchaseDate: z.string().optional(),
    purchasePrice: z.coerce.number().min(0).optional(),
    warrantyEnd: z.string().optional(),
    nextMaintenance: z.string().optional(),
    lifecycleStatus: z.enum(['Neuf', 'En service', 'En réparation', 'Fin de vie', 'Rebut']).optional(),
    ownerId: z.string().optional(),
});

export type AssetFormData = z.infer<typeof assetSchema>;
