// Módulo 03 — Lección 1: Creación de un Servidor MCP Nativo
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio";
import { z } from "zod";

// 1. Inicialización del servidor MCP
const server = new McpServer({
    name: 'store-mcp-server',
    version: '1.0.0'
});

// 2. Base de datos simulada de inventario de tienda
const inventoryDatabase: Record<string, { name: string; stock: number; price: number; }> = {
    'PROD-001': { name: 'Teclado Mecánico RGB', stock: 15, price: 89.99 },
    'PROD-002': { name: 'Monitor Gamer 4K 144Hz', stock: 0, price: 499.99 }, // Sin Stock
};

// 3. Registro formal de la herramienta con el standar MCP
server.registerTool(
    'getProductStock',
    {
        description: 'Consulta el inventario disponible y precio de un producto a partir de su ID (ej. PROD-001)',
        inputSchema: {
            productId: z.string().describe('Código del producto a consultar'),
        },
    },
    async ({ productId }) => {
        const product = inventoryDatabase[productId];

        if (!product) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ found: false, error: `El producto ${productId} no existe` }),
                    },
                ],
            };
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ found: true, product }),
                },
            ],
        };
    }
);

// 4. Función de inicio y conexión del transporte stdio
async function startServer() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('🚀 [Servidor MCP]: store-mcp-server listo y escuchando en stdio...');
}

startServer().catch((error) => {
    console.error('❌ Error fatal al iniciar el servidor MCP: ', error);
    process.exit(1);
});