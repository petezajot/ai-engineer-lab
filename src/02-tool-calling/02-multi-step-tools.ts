// Módulo 02 — Lección 2: Encadenamiento Autónomo (Multi-Step & ReAct)
import 'dotenv/config';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Base de datos bancaria simulada
interface Account {
    accountId: string;
    owner: string;
    balance: number;
    currency: string;
    status: 'active' | 'frozen';
}

const mockDatabase: Record<string, Account> = {
    'ACC-001': { accountId: 'ACC-001', owner: 'Carlos Mendoza', balance: 14250.5, currency: 'USD', status: 'active' },
    'ACC-002': { accountId: 'ACC-002', owner: 'Sofía Reyes', balance: 830.0, currency: 'USD', status: 'frozen' }
}

// 2. Herramienta 1: Resuelve el nombre de una persona a su ID de cuenta
const findAccountByNumber = tool({
    description: 'Busca y devuelve el ID de cuenta (accountId) de un cliente a partis de su nombre o apellido',
    inputSchema: z.object({
        name: z.string().describe('Nombre o apellido del cliente a buscar (ej. Carlos o Sofía)'),
    }),
    execute: async ({ name }) => {
        console.log(`\n🔍 [Tool 1]: Buscando en el directorio de clientes a "${name}".`);

        const account = Object.values(mockDatabase).find((acc) => 
            acc.owner.toLowerCase().includes(name.toLowerCase())
        );

        if (!account) {
            return { found: false, message: `No se encontró ningún cliente con el nombre "${name}".`};
        };

        // Devolvemos solo la identidad, no el saldo:
        return { found: true, accountId: account.accountId, owner: account.owner };
    },
});

// 3. Herramienta 2: Obtiene el estado financiero usando el accountId descubierto
const getAccountDetails = tool({
    description: 'Consulta el saldo y estado operativo (active/frozen) de una cuenta a partir de su accountId',
    inputSchema: z.object({
        accountId: z.string().describe('El identificador único de la cuenta, por ejemplo ACC-001'),
    }),
    execute: async ({ accountId }) => {
        console.log(`\n💳 [Tool 2]: Consultando saldo y estado de la cuenta ${accountId}...`);

        const account = mockDatabase[accountId];
        if (!account) {
            return { found: false, message: `La cuenta ${accountId} no existe.` };
        };

        return {
            found: true,
            balance: account.balance,
            currency: account.currency,
            status: account.status
        };
    },
});

// 4. Ejecución del ciclo multi-paso
async function main() {
    const userPrompt = 'Quiero transferir $500 de la cuenta de Carlos Mendoza a la cuenta de Sofía Reyes. ¿Es posible realizar la transferencia?';

    console.log('--- 1. PETICIÓN DEL USUARIO ---');
    console.log(`"${userPrompt}"\n`);

    console.log('--- 2. EJECUCIÓN AUTÓNOMA DEL AGENTE ---');

    const response = await generateText({
        model,
        tools: {
            findAccountByNumber,
            getAccountDetails
        },
        // Le damos hasta 5 pasos para que pueda encadenar búsquedas y consultas
        stopWhen: stepCountIs(5),
        prompt: userPrompt
    });

    console.log('\n--- 3. HISTORIAL DE HERRAMIENTAS EJECUTADAS ---');
    for(let i = 0; i < response.toolCalls.length; i++) {
        const call = response.toolCalls[i];
        const result = response.toolResults[i];

        console.log(`\n▶ Acción #${i + 1}:`);
        console.log(`  • Herramienta:  "${call.toolName}"`);
        console.log(`  • Input enviado:`, call.input);

        if (result) {
            console.log(`  • Output recibido:`, result.output);
        }
    }

    console.log('\n--- 4. DICTAMEN FINAL DEL MODELO ---');
    console.log(response.text);
};

main().catch(console.error);