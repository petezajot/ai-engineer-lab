// Módulo 03 — Lección 3: Recursos (Resources) en MCP
import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const model = google('gemini-3.5-flash-lite');

// 1. Inicialización del servidor que expondrá recursos
const server = new McpServer({
    name: 'store-knowledge-server',
    version: '1.0.0',
});

// 2. Registro formal de un recurso estático de solo lectura en MCP
server.registerResource(
    'return-policy',
    'store://policies/returns',
    {
        description: 'Políticas oficiales de devolución, garantía y reembolsos de la tienda',
        mimeType: 'text/plain',
    },
    async (uri) => {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: `POLÍTICA OFICIAL DE DEVOLUCIONES Y REEMBOLSOS:
                    1. Plazo: Todo cliente tiene hasta 30 días naturales posteriores a la entrega para solicitar una devolución.
                    2. Estado del producto: Debe incluir empaque original, manuales y accesorios completos.
                    3. Costos de envío: Si la devolución es por defecto de fábrica, el envío es 100% gratuito. Si es por arrepentimiento del cliente, el flete corre por cuenta del comprador.
                    4. Excepciones: Software descargable y productos de higiene personal abiertos NO tienen devolución.`,
                    mimeType: 'text/plain',
                },
            ],
        };
    }
);

// 3. Creamos un par de transportes enlazados en memoria (Cliente <-> Servidor)
const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
const client = new Client({ 
    name: 'store-client', 
    version: '1.0.0' 
});

// 4. Conexión de ambos extremos y descrubrimiento de recursos
async function main() {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    console.log('✅ Servidor y Cliente MCP conectados en memoria');

    // Descubrimos que recursos expone el servidor
    const available = await client.listResources();
    console.log('\n---1. RECURSOS DISPONIBLES EN EL SERVIDOR ---');
    for (const res of available.resources) {
        console.log(`• [${res.name}] -> URI: ${res.uri}`);
        console.log(`  Descripción: ${res.description}`);
    }

    // Le ordenamos al cliente que lea el contenido del recurso  por su URI
    console.log('\n--- 2. LEYENDO RECURSOS DESDE EL CLIENTE ---');
    const policyResource = await client.readResource({
        uri: 'store://policies/returns',
    });

    const content = policyResource.contents[0];
    if (!content || !('text' in content)) {
        throw new Error('El recurso devuelto no contiene texto legible.');
    }

    const policyText = content.text;
    console.log(policyText);

    // Pasamos el contenido del recurso a Gemini como contexto
    console.log('\n--- 3. RESPUESTA DE GEMINI BASADA EN EL RECURSO MCP ---');

    const { text } = await generateText({
        model,
        system: `Eres un asistente de soporte de la tienda. Basa tus respuestas ESTRICTAMENTE en esta política oficial: \n\n
        ${policyText}
        `,
        prompt: `Compré un teclado hace 15 días, tengo su empaque original pero me arrepentí de la compra. ¿Puedo devolverlo y quien
        paga el envío?`
    });
    console.log(text);

    // Cerramos la conexión del cliente
    await client.close();
    console.log(`\n🔒 Conexión MCP cerrada exitosamente`);
};

main().catch(console.error);