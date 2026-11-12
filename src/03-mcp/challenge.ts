//Desafío del Módulo 03: "OmniOps Autonomous MCP Agent"
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory';
import { z } from 'zod';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';

const model = google('gemini-3.5-flash-lite');


interface DbInfrastructure {
    status: string;
    cpu: number;
    memory: number;
    restartCount: number;
};

const infrastructureDatabase: Record<string, DbInfrastructure> = {
    'srv-payment-01': { status: 'critical', cpu: 98, memory: 94, restartCount: 0 },
    'srv-auth-02': { status: 'healthy', cpu: 22, memory: 41, restartCount: 1 },
};

var incidentTickets = [];

const server = new McpServer({
    name: 'omniops-mcp-server',
    version: '1.0.0',
})

server.registerResource(
    'incident-runbook',
    'ops://runbooks/incident-response',
    {
        description: 'Procedimientos estandar de respuesta y mitigación de incidentes',
        mimeType: 'text/plain'
    },
    async (uri) => {
        return {
            contents: [
                {
                    uri: uri.href,
                    text: `PROCEDIMIENTO ESTÁNDAR DE OPERACIÓN (SOP - INCIDENT RESPONSE):
                    1. Diagnóstico: Si un servidor presenta estado 'critical' o CPU > 90%, se considera incidente severo.
                    2. Remediación inmediata: Es mandatorio ejecutar el reinicio del servidor afectado.
                    3. Escalamiento: Si el servidor es de pagos o autenticación y estuvo en estado crítico, es OBLIGATORIO crear y 
                    escalar un ticket con severidad 'P1' dirigido al equipo 'team-devops-oncall'.`
                },
            ],
        };
    }
);

server.registerTool(
    'checkServerMetrics',
    {
        description: 'Consulta las métricas y estado actual de salud de un servidor',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor a consultar'),
        }),
    },
    async ({ serverId }) => {
        const serverToCheck = infrastructureDatabase[serverId];
        if (!serverToCheck) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ found: false, error: `El servidor ${serverId} no existe` }),
                    },
                ],
            };
        };

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ found: true, data: serverToCheck })
                },
            ],
        };
    }
);

server.registerTool(
    'restartServer',
    {
        description: 'Reinicia el servidor afectado para restaurar su servicio',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor a reiniciar'),
        }),
    },
    async ({ serverId }) => {
        const serverToRestart = infrastructureDatabase[serverId];
        if (!serverToRestart) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({ found: false, error: `El servidor ${serverId} no puede ser reiniciado por que no existe` }),
                    },
                ],
            }
        }

        serverToRestart.status = 'Healthy';
        serverToRestart.cpu = 28;
        serverToRestart.memory = 40;
        serverToRestart.restartCount = 1;

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ found: true, message: 'Servidor reiniciado exitosamente', data: serverToRestart }),
                },
            ],
        };
    }
);

server.registerTool(
    'createIncidentTicket',
    {
        description: 'Crea un ticket oficial de incidente en el sistema',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor afectado por el que se levantará el ticket'),
            severity: z.enum(['P1', 'P2', 'P3']).describe('Nivel de severidad de la afectación'),
            team: z.string().describe('Equipo que deberá atender incidencia y al que se dirigirá el ticket'),
            reason: z.string().describe('Descripción de la incidencia, razón por la que debe darse atención')
        }),
    },
    async ({
        serverId,
        severity,
        team,
        reason
    }) => {
        console.log(`\n🎫 Fallback: Creando ticket de soporte para el servidor ${serverId}...`);

        const ticketId = `TCK-${Math.floor(1000 + Math.random() * 9000)}`;
        const ticket = {
            ticketId : {
                serverId,
                team,
                severity,
                reason
            }
        }

        incidentTickets.push(ticket);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({ ticketCreated: true, ticketId }),
                },
            ],
        };
    }
);

async function main() {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({
        name: 'omniops-client',
        version: '1.0.0'
    });

    await server.connect(serverTransport);
    await client.connect(clientTransport);

    // Listado de recursos del server.
    const processResource = await client.readResource({
        uri: 'ops://runbooks/incident-response',
    });

    const resourcesContent = processResource.contents[0];
    if (!resourcesContent || !('text' in resourcesContent)) {
        throw new Error('El recurso devuelto no contiene texto');
    }

    const resText = resourcesContent.text;
    console.log(resText);

    // Listado de herramientas disponibles
    const tools = await client.listTools();
    for (const t of tools.tools) {
        console.log(`Herramientas disponibles: "${t.name}" -> "${t.description}"`);
    }

    // Herramientas
    const checkServerMetrics = tool({
        description: 'Consulta las métricas y estado actual de salud de un servidor',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor a consultar'),
        }),
        execute: async ({ serverId }) => {
            const result = await client.callTool({
                name: 'checkServerMetrics',
                arguments: { serverId },
            });

            return result.content;
        },
    });

    const restartServer = tool({
        description: 'Reinicia el servidor afectado para restaurar su servicio',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor a reiniciar')
        }),
        execute: async ({ serverId }) => {
            const result = await client.callTool({
                name: 'restartServer',
                arguments: { serverId },
            });

            return result.content;
        },
    });

    const createIncidentTicket = tool({
        description: 'Crea un ticket oficial de incidente en el sistema',
        inputSchema: z.object({
            serverId: z.string().describe('ID del servidor afectado por el que se levantará el ticket'),
            severity: z.enum(['P1', 'P2', 'P3']).describe('Nivel de severidad de la afectación'),
            team: z.string().describe('Equipo que deberá atender incidencia y al que se dirigirá el ticket'),
            reason: z.string().describe('Descripción de la incidencia, razón por la que debe darse atención')
        }),
        execute: async ({
            serverId,
            severity,
            team,
            reason
        }) => {
            const result = await client.callTool({
                name: 'createIncidentTicket',
                arguments: {serverId, severity, team, reason },
            });

            return result.content;
        },
    });

    const response = await generateText({
        model,
        system: `Eres un agente autónomo SRE. 
        Basa tus respuestas ESTRICTAMENTE en esta política oficial: ${resText}`,
        prompt: 'ALERTA DEL SISTEMA DE MONITOREO: El servidor srv-payment-01 está fallando. Aplica el procedimiento del Runbook, remedia el fallo y escala el ticket si el protocolo lo exige.',
        tools: {
            checkServerMetrics,
            restartServer,
            createIncidentTicket
        },
        stopWhen: stepCountIs(6)
    });

    console.log(response.output);

    console.log('Verificación de estado final')
    const srv = infrastructureDatabase['srv-payment-01'];
    console.log('Estado final del servidor: ', srv);
    console.log('Tickets generados: ', incidentTickets);

    if (srv.status.toLowerCase() !== 'healthy') {
        throw new Error(`Assertion failed: El servidor debería estar healthy, pero está en ${srv.status}`);
    }

    if (srv.restartCount !== 1) {
        throw new Error(`Assertion failed: restartCount debería ser 1, pero es ${srv.restartCount}`);
    }

    if (incidentTickets.length === 0) {
        throw new Error('Assertion failed: No se generó ningún ticket de incidente');
    }

    console.log('\n🎉 ¡DESAFÍO COMPLETADO CON ÉXITO: Agente Autónomo MCP Operativo!');

    await client.close();
};

main().catch(console.error);