// Challenge
import 'dotenv/config';
import { generateText, tool, stepCountIs } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Telemetría y estado simulado de la nube
interface ServiceHealth {
    cpuUsagePercent: number;
    memoryUsagePercent: number;
    errorRate5xx: number;
    activeDeployment: string;
}

const cloudInfrastructure: Record<string, ServiceHealth> = {
    'checkout-service': {
        cpuUsagePercent: 94,
        memoryUsagePercent: 98,
        errorRate5xx: 76.5, // 76.5% de transacciones fallando
        activeDeployment: 'v2.4.1', // Esta versión recién desplegada introdujo el bug
    },
};

const serverLogs: Record<string, string[]> = {
    'checkout-service': [
        '15:02:11 [INFO] Despliegue v2.4.1 completado con éxito.',
        '15:03:45 [WARN] Pool de conexiones a Redis agotado (max 100/100).',
        '15:04:12 [ERROR] OutOfMemoryError en checkout-worker-pod-3: Fuga de memoria en caché Redis.',
        '15:05:00 [FATAL] HTTP 500 Gateway Timeout en todas las peticiones a /checkout.',
    ],
};

// 2. Herramienta de diagnóstico 1: Métricas de salud en tiempo real.
const queryServiceMetrics = tool({
    description: 'Consulta las métricas de rendimiento (CPU, Memoria, tasa de error 5xx y versión activa) de un servicio',
    inputSchema: z.object({
        serviceName: z.string().describe('Nombre del microservicio a inspeccionar, por ejemplo: checkoutService'),
    }),
    execute: async ({ serviceName }) => {
        console.log(`\n📊 [Diagnóstico SRE]: Leyendo métricas de ${serviceName}...`);

        const health = cloudInfrastructure[serviceName];
        if (!health) {
            return { found: false, error: `El servicio ${serviceName} no existe en el cluster.` };
        }

        return { found: true, metrics: health };
    },
});

// 3. Herramienta de diagnóstico 2: Inspección de logs de error.
const inspectServerLogs = tool({
    description: 'Obtiene las trazas y lineas de log recientes de un servicio para identificar excepciones y causas raíz',
    inputSchema: z.object({
        serviceName: z.string().describe('Nombre del microservicio a inspeccionar, por ejemplo: checkoutService'),
    }),
    execute: async ({ serviceName }) => {
        console.log(`\n📜 [Diagnóstico SRE]: Extrayendo logs del sistema para ${serviceName}...`);

        const logs = serverLogs[serviceName];
        if (!logs) {
            return { found: false, error: `No hay logs disponibles para ${serviceName}.` };
        }

        return { found: true, recentLogs: logs };
    },
});

const triggerMitigationAction = tool({
    description: 'Aplica una acción correctiva de emergencia en la infraestructura  para mitigar una caida  de servicio',
    inputSchema: z.object({
        serviceName: z.string().describe('Nombre del servicio afectado'),
        action: z
        .enum(['restart_pods', 'scale_replicas', 'flush_cache', 'rollback_deployment'])
        .describe('Acción técnica de mitigación a ejecutar en el cluster'),
        targetVersion: z
        .string()
        .nullable()
        .describe('Versión a la cuál regresar si la acción es rollback_deployment (ej. v.2.4.0), o null'),
        justification: z.string().describe('Justificación técnica de SRE de por qué se eligió esta acción específica'),
    }),
    execute: async ({ serviceName, action, targetVersion, justification }) => {
        console.log(`\n🚨 [Mitigación SRE]: Ejecutando acción "${action}" en ${serviceName}...`);
        console.log(`   Justificación del agente: "${justification}"`);

        // Simulamos la remediación de Kubernetes / Cloud
        if (action === 'rollback_deployment') {
            const rollbackVersion = targetVersion ?? 'v2.4.0';

            // Restauramos la salud del servicio
            cloudInfrastructure[serviceName] = {
                cpuUsagePercent: 24,
                memoryUsagePercent: 35,
                errorRate5xx: 0.05,
                activeDeployment: rollbackVersion,
            };

            return {
                success: true,
                actionExecuted: 'rollback_deployment',
                activeVersion: rollbackVersion,
                newHealth: cloudInfrastructure[serviceName],
                status: 'INCIDENT_RESOLVED',
                message: `Rollback a ${rollbackVersion} completado con éxito. Métricas normalizadas`,
            };
        }

        return {
            success: true,
            actionExecuted: action,
            status: 'ACTION_APPLIED_PARTIAL',
            message: `Se aplicó ${action}, pero la versión defectuosa continua activa`,
        };
    },
});

// 5. Ejecución del agente autónomo SRE
async function main() {
    const alertPrompt = `ALERTA CRÍTICA: El servicio checkout-service está arrojando errores 500 y latencia alta en producción. 
    Investiga la causa raíz usando las herramientas de diagnóstico y ejecuta la acción de mitigación definitiva.`;

    console.log('=====================================================');
    console.log('🚨 INCIDENTE EN VIVO: ALERTA DE PRODUCCIÓN DISPARADA');
    console.log('=====================================================\n');
    console.log(`Prompt de alerta: "${alertPrompt}"\n`);

    console.log('--- 1. AGENTE AUTÓNOMO INICIANDO PROTOCOLO SRE ---');

    const response = await generateText({
        model,
        tools: {
            queryServiceMetrics,
            inspectServerLogs,
            triggerMitigationAction,
        },
        // Le permitimos hasta 6 pasos para investigar, mitigar y redactar reporte
        stopWhen: stepCountIs(6),
        prompt: alertPrompt,
    });

    console.log('\n--- 2. BITÁCORA FORENSE DE ACCIONES DEL AGENTE ---');
    for (let i = 0; i < response.toolCalls.length; i++) {
        const call = response.toolCalls[i];
        const result = response.toolResults[i];

        console.log(`\n▶ Paso #${i + 1}:`);
        console.log(`  • Herramienta:  "${call.toolName}"`);
        console.log(`  • Parámetros:   `, call.input);

        if (result) {
            console.log(`  • Resultado:    `, result.output);
        }
    }

    console.log('\n--- 3. REPORTE FINAL DE RESOLUCIÓN DEL INCIDENTE ---');
    console.log(response.text);

    // ============================================================================
    // Suite de Aserciones Automáticas de Ingeniería
    // ============================================================================
    console.log('\n=====================================================');
    console.log('🔍 AUDITORÍA DE DESEMPEÑO DEL AGENTE SRE');
    console.log('=====================================================');

    const toolNames = response.toolCalls.map((t) => t.toolName);
    const mitigationCall = response.toolCalls.find((t) => t.toolName === 'triggerMitigationAction');
    const serviceState = cloudInfrastructure['checkout-service'];

    const checks = [
        {
            name: 'El agente consultó las métricas del servicio',
            pass: toolNames.includes('queryServiceMetrics'),
        },
        {
            name: 'El agente inspeccionó los logs para hallar la causa raíz',
            pass: toolNames.includes('inspectServerLogs'),
        },
        {
            name: 'El agente ejecutó una acción de mitigación técnica',
            pass: toolNames.includes('triggerMitigationAction'),
        },
        {
            name: 'El agente eligió la mitigación correcta (rollback_deployment)',
            pass: (mitigationCall?.input as any)?.action === 'rollback_deployment',
        },
        {
            name: 'El servicio quedó restablecido con tasa de error < 1%',
            pass: serviceState.errorRate5xx < 1.0,
        },
    ];

    let allPassed = true;
    for (const check of checks) {
        if (check.pass) {
            console.log(`✅${check.name}`);
        } else {
            console.error(`❌Falló: ${check.name}`);
            allPassed = false
        }
    }

    if (allPassed) {
        console.log('\n🎉 ¡FELICIDADES! Tu Agente SRE resolvió el incidente al 100%.');
    } else {
        console.warn('\n⚠️ El incidente no fue completamente resuelto. Revisa las acciones.');
    }
}

main().catch(console.error);