// Módulo 02 — Lección 1: Tu Primera Herramienta Determinista
import 'dotenv/config';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Tipo de dato de una cuenta bancaria
interface Account {
    owner: string;
    balance: number;
    currency: string;
    status: 'active' | 'frozen';
}

// 2. Base de datos simulada en memoria:
const mockDatabase: Record<string, Account> = {
    'ACC-001': { owner: 'Carlos Mendoza', balance: 14250.5, currency: 'USD', status: 'active' },
    'ACC-002': { owner: 'Sofía Reyes', balance: 830.0, currency: 'USD', status: 'frozen' },
}

// 3. Definición formal de la herramienta para el LLM
const getAccountDetails = tool ({
    description: 'Obtiene los detalles, saldo actual y estado de una cuenta bancaria a partir de su ID',
    inputSchema: z.object({
        accountId: z.string().describe('El identificador único de la cuenta, ejemplo: ACC-001 o ACC-002'),
    }),
    execute: async ({ accountId }) => {
        console.log(`\n⚙️ [Servidor Node.js]: Buscando en la base de datos la cuenta ${accountId}...`);

        const account = mockDatabase[accountId];
        if(!account) {
            return { found: false, error: `La cuenta ${accountId} no existe en el sistema.` };
        }

        return { found: true, data: account };
    },
});

// 4. Ejecución del ciclo con generateText
async function main() {
    const userPrompt = `Hola, ¿la cuenta ACC-001 puede hacer transferencias y cuál es su saldo actual?`;

    console.log('--- 1. PREGUNTA DEL USUARIO ---');
    console.log(`"${userPrompt}"\n`);
    console.log('--- 2. INFERENCIA CON HERRAMIENTAS ---');

    const response = await generateText({
        model,
        tools: {
            getAccountDetails,
        },
        stopWhen: stepCountIs(2),
        prompt: userPrompt,
    });

    console.log('\n--- 3. INSPECCIÓN TRAS BAMBALINAS ---');

    // Qué herramienta decidió llamar el LLM y qué argumentos envió:
    for (const call of response.toolCalls) {
        console.log(`• Tool invocada por el LLM: "${call.toolName}"`);
        console.log(`• Argumentos generados: `, call.input);
    }

    // Qué le devolvió nuestra función TypeScript al LLM:
    for (const result of response.toolResults) {
        console.log(`• Resultado de la función: `, result.output);
    }

    console.log('\n--- 4. RESPUESTA FINAL SINTETIZADA POR EL LLM ---');
    console.log(response.text);
};

main().catch(console.error);