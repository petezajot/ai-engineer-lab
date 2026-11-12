// Módulo 03 — Lección 2: Creación del Cliente MCP e Inferencia con Gemini
import 'dotenv/config';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Configuración del transporte que levantará el servidor en segundo plano
const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'src/03-mcp/server.ts'],
});

// 2. Instancia del cliente oficial MCP
const mcpClient = new Client({
    name: 'store-ai-client',
    version: '1.0.0',
});

// 3. Adaptamos la herramienta del servidor MCP para que Gemini pueda invocarla
const getProductStock = tool({
    description: 'Consulta el inventario disponible y precio de un producto a partir de su ID',
    inputSchema: z.object({
        productId: z.string().describe('Código del producto a consultar, por ejemplo: PROD-001 o PROD-002'),
    }),
    execute: async ({ productId }) => {
        console.log(`\n📡 [Cliente MCP]: Solicitando "getProductStock" al servidor para ${productId}...`);

        // Hacemos la llamada oficial por protocolo JSON-RCP
        const result = await mcpClient.callTool({
            name: 'getProductStock',
            arguments: { productId },
        });

        return result.content;
    },
});

// 4. Función principal que orquesta la conexión, descubrimiento y consulta
async function main() {
    console.log('--- 1. CONECTANDO CLIENTE CON SERVIDOR MCP ---');
    await mcpClient.connect(transport)
    console.log('✅ Conexión establecida con store-mcp-server.');

    // Le pedimos al servidor la lista oficial de herramientas registradas:
    const toolList = await mcpClient.listTools();
    console.log('\n--- 2. HERRAMIENTAS DESCUBIERTAS POR MCP ---');
    for (const t of toolList.tools) {
        console.log(`• Herramienta disponible: "${t.name}" -> ${t.description}`);
    }

    const userPrompt = `Hola, ¿Tienen disponible el monitor gamer PROD-002 y cuanto cuesta?`;
    console.log(`\n--- 3. PREGUNTA DEL CLIENTE ---`);
    console.log(`"${userPrompt}"`);

    console.log('\n--- 4. INFERENCIA CON GEMINI VÍA MCP ---');
    const response = await generateText({
        model,
        tools: {
            getProductStock,
        },
        stopWhen: stepCountIs(3),
        prompt: userPrompt,
    });

    console.log('\n--- 5. RESPUESTA FINAL DE GEMINI ---');
    console.log(response.text);

    // Cerramos la conexión para apagar el subproceso limpiamente
    await mcpClient.close();
    console.log('\n🔌 Conexión MCP cerrada.')
};

main().catch(console.error);