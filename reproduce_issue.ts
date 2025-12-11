import { z } from 'zod';

const schema = z.object({
    name: z.string(),
    aiAnalysis: z.object({
        type: z.string(),
        response: z.record(z.string(), z.any()),
        timestamp: z.string()
    }).optional().nullable(),
});

const data = { name: "Test Asset" };
const validated = schema.parse(data);
console.log("Validated keys:", Object.keys(validated));
console.log("Has aiAnalysis key:", "aiAnalysis" in validated);
console.log("aiAnalysis value:", validated.aiAnalysis);

const dataToUpdate = {
    ...validated,
    aiAnalysis: validated.aiAnalysis || undefined
};
console.log("dataToUpdate keys:", Object.keys(dataToUpdate));
console.log("dataToUpdate.aiAnalysis:", dataToUpdate.aiAnalysis);
