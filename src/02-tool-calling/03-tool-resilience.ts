// Módulo 02 — Lección 3: Resiliencia y Manejo de Errores en Tools
import 'dotenv/config';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Simulación de un sistema de comercio electronico
interface Order {
    orderId: string;
    item: string;
    status: 'shipped' | 'processing' | 'delivered';
}

const mockOrders: Record<string, Order> = {
    'ORD-101': { orderId: 'ORD-101', item: 'Laptop Pro 16"', status: 'shipped' },
}

// 2. Herramienta 1: Consulta de pedidos protegida con try/catch
const checkOrderStatus = tool({
    description: 'Consulta el estado de envío de un pedido en el sistema de logística a partir de su orderId',
    inputSchema: z.object({
        orderId: z.string().describe('ID del pedido en formato ORD-XXX, ejemplo: ORD-101, ORD-102'),
    }),
    execute: async ({ orderId }) => {
        console.log(`\n📦 [Tool 1]: Consultando el sistema de paquetería para ${orderId}...`);

        try {
            // Simulamos que el pedido ORD-999 sufre una caída en el servidor de paquetería
            if (orderId === 'ORD-999') {
                throw new Error('503 Service Unavailable: La API del proveedor de logística está fuera de linea por mantenimiento');
            }

            const order = mockOrders[orderId];
            if (!order) {
                return { success: false, error: `El pedido ${orderId} no fue encontrado en la base de datos` };
            }

            return { success: true, data: order };
        } catch (error) {
            console.warn(`⚠️ [Servidor Node.js]: Error capturado de forma segura: ${(error as Error).message}`);

            // Le devolvemos el error al modelo como información procesable:
            return {
                success: false,
                error: (error as Error).message,
                recommendation: 'El servicio de paquetería falló. Si el caso es urgente, genera un ticket de soporte',
            }
        }
    },
});

// 3. Herramienta 2: Herramienta de contingencia (Fallback) para soporte humano.
const escalateToSupportTicket = tool({
    description: 'Abre un ticket de soporte de emergencia para que un agente humano investigue un pedido con problemas técnicos',
    inputSchema: z.object({
        orderId: z.string().describe('ID del pedido afectado'),
        issueDescription: z.string().describe('Explicación detallada del fallo técnico o problema detectado'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Nivel de prioridad del ticket')
    }),
    execute: async ({ orderId, issueDescription, priority }) => {
        console.log(`\n🎫 [Tool 2 (Fallback)]: Creando ticket de soporte para ${orderId}...`);

        // Simulamos la creación del ticket en Zendesk / jira
        const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;

        return {
            ticketCreated: true,
            ticketId,
            assignedDepartment: 'Logística & Envíos prioritarios',
            priority,
            reason: issueDescription
        };
    },
});

// 4. Ejecución del ciclo resiliente con generateText
async function main() {
    const userPrompt = 'Hola, necesito saber el estado urgente de mi pedido ORD-999. Es un regalo para mañana y no sé donde está';

    console.log('--- 1. PETICIÓN DEL USUARIO ---');
    console.log(`"${userPrompt}"\n`);

    console.log('--- 2. EJECUCIÓN CON MANEJO DE ERRORES Y CONTINGENCIA ---');

    const response = await generateText({
        model,
        tools: {
            checkOrderStatus,
            escalateToSupportTicket,
        },
        // Le damos hasta 5 pasos para que pueda intentar la consulta, ver el fallo y escalar.
        stopWhen: stepCountIs(5),
        prompt: userPrompt,
    });

    console.log('\n--- 3. HISTORIAL DE INTENTOS Y CONTINGENCIA ---');
    for (let i = 0; i < response.toolCalls.length; i++) {
        const call = response.toolCalls[i];
        const result = response.toolResults[i];

        console.log(`\n▶ Acción #${i + 1}:`);
        console.log(`  • Herramienta invocada: "${call.toolName}"`);
        console.log(`  • Input enviado:       `, call.input);

        if (result) {
            console.log(`  • Output recibido:     `, result.output);
        }
    }

    console.log('\n--- 4. RESPUESTA FINAL AL CLIENTE ---');
    console.log(response.text);
}

main().catch(console.error);