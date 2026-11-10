// Módulo 01 — Lección 1: De Texto Libre a Structured Outputs
import 'dotenv/config';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// Entrada NO ESTRUCTURADA: correo de soporte técnico
const rawTicketEmail = `
Hola soporte,
Soy Carlos Martínez de la empresa Acme Corp (carlos.m@acme.com).
Ayer a las 3:30 PM intentamos procesar el lote #9821 y falló con el error 504 Gateway Timeout.
Afectó a más de 120 clientes que esperaban sus reportes mensuales.
Es la segunda vez que nos ocurre esta semana, por favor clasifiquen esto como urgente.
`;

const SupportTicketSchema = z.object({
    sender: z.object({
        name: z.string().describe('Nombre del usuario que reporta'),
        email: z.string().describe('Correo electrónico corporativo'),
        company: z.string().describe('Empresa del cliente'),
    }),
    incident: z.object({
        batchId: z.string().nullable().describe('ID del lote afectado, o null si no existe'),
        errorCode: z.string().describe('Código de error HTTP o de sistema reportado'),
        affectedUsers: z.number().int().positive().describe('Cantidad estimada de usuarios afectados'),
        severity: z.enum(['low', 'medium', 'high', 'critical']).describe('Severidad inferida según el impacto')
    }),
    summary: z.string().describe('Resumen ejecutivo del problema en máximo 15 palabras'),
});

// Inferimos el tipo de TypeScript automáticamente
type SupportTicket = z.infer<typeof SupportTicketSchema>

async function main() {
    console.log('--- 1. ENTRADA NO ESTRUCTURADA');
    console.log(rawTicketEmail.trim())

    console.log('\n --- 2. EJECUTANDO INFERENCIA ESTRUCTURADA ---');
    console.log('Enviando texto y esquema Zod a Gemini...\n');

    const { output } = await generateText({
        model,
        output: Output.object({
            schema: SupportTicketSchema,
        }),
        prompt: `Extrae la información del siguiente correo de soporte: \n\n${rawTicketEmail}`
    });

    // 'output' está 100% tipado como SupportTicket tanto en TypeScript como en runtime.
    const ticket: SupportTicket = output;

      console.log('✅ OBJETO EXTRAÍDO:');
      console.dir(ticket, { depth: null, colors: true });
      console.log('\n--- 3. ACCESO TIPADO DIRECTO EN TYPESCRIPT ---');
      console.log(`• Remitente: ${ticket.sender.name} (${ticket.sender.company})`);
      console.log(`• Correo: ${ticket.sender.email}`);
      console.log(`• Lote afectado: ${ticket.incident.batchId ?? 'Sin lote'}`);
      console.log(`• Código de error: ${ticket.incident.errorCode}`);
      console.log(`• Severidad calculada: [${ticket.incident.severity.toUpperCase()}]`);
      console.log(`• Afectados: ${ticket.incident.affectedUsers} usuarios`);
      console.log(`• Resumen: "${ticket.summary}"`);
};

main().catch(console.error);