// Challenge del módulo 1
import 'dotenv/config';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// ============================================================================
// 1. Datos no estructurados del incidente (Entrada del reto)
// ============================================================================
const rawIncidentLog = `
INCIDENT LOG - 03/Nov/2026
Canal #incident-payments-down
14:02 UTC - @dev-ops: Alertas de Datadog disparadas. La tasa de error en /api/v1/charge saltó a 87%.
14:05 UTC - @lead-architect: PostgreSQL primario está en 100% de CPU. Conexiones saturadas (pool exhausto en 500/500).
14:12 UTC - @backend-juan: El microservicio de recomendaciones lanzó un cron job sin rate limit que ejecutó una query full-scan sin índice sobre la tabla transacciones.
14:20 UTC - @dba: Matamos la query del cron manualmente. El pool se recuperó a 45 conexiones activas.
14:35 UTC - @sre: El tráfico volvió a la normalidad. Latencia p99 en 120ms.
Impacto: Estuvimos caídos 33 minutos exactos. Estimamos que 4,200 transacciones fallaron, con un volumen aproximado de $185,000 USD retenidos.
Servicios involucrados: Payments-API, Recommendation-Engine, RDS-Postgres.
Causa raíz: Consulta no indexada ejecutada por job no coordinado en base transaccional.
Acciones acordadas:
- Juan agregará el índice B-tree compuesto en la tabla transacciones para el viernes (prioridad alta).
- SRE configurará pgBouncer para aislar pools de microservicios secundarios en 2 semanas.
- Arquitectura redactará política para prohibir queries analíticas sobre la réplica primaria (urgente, esta semana).
`;

// ============================================================================
// 2. Tu misión: Diseñar el Esquema Zod (¡Aquí programas tú!)
// ============================================================================
// TODO: Diseña PostMortemSchema con:
// - incident: { title, severity ('SEV-1' | 'SEV-2' | 'SEV-3'), rootCauseCategory, summary, affectedServices: string[] }
// - metrics: { downtimeMinutes: number, affectedTransactions: number, estimatedLossUSD: number }
// - timeline: array de { timestampUTC, phase ('detection' | 'investigation' | 'mitigation' | 'resolution'), event }
// - actionItems: array de { task, ownerRole, priority ('low' | 'medium' | 'high' | 'critical') }

const PostMortemSchema = z.object({
    incident: z.object({
        title: z
        .string()
        .toUpperCase()
        .describe('Título del incidente'),
        severity: z
        .enum(['SEV-1', 'SEV-2', 'SEV-3'])
        .describe('Severidad del incidente según el impacto'),
        rootCauseCategory: z
        .string()
        .describe('Causa raíz del incidente'),
        summary: z
        .string()
        .describe('Resumen ejecutivo del problema, orientado a desarrolladores de software en máximo 20 palabras'),
        affectedServices: z
        .array(
            z.object({
                serviceName: z
                .string()
                .describe('Nombre de cada servicio afectado')
            })
        ).describe('Servicios involucrados'),
    }),
    metrics: z.object({
        downtimeMinutes: z
        .number()
        .int()
        .min(0)
        .nullable()
        .describe('Tiempo que duró el incidente que afectó a los usuarios'),
        affectedTransactions: z
        .number()
        .int()
        .min(0)
        .nullable()
        .describe('Número de transacciones afectadas por el incidente'),
        estimatedLossUSD: z
        .number()
        .int()
        .min(0)
        .nullable()
        .describe('Cantidad retenida debido al incidente en USD')
    }),
    timeline: z
    .array(
        z.object({
            timestampUTC: z
            .string()
            .describe('Fecha y hora en la que se registró cada mensaje en formato ISO YYYY-MM-DD HH:MM:ss'),
            phase: z
            .enum(['detection', 'investigation', 'mitigation', 'resolution'])
            .describe('Fase en la que actualmente se encuentra la atención al incidente'),
            event: z
            .string()
            .describe('Evento que ocurre en cada fase')
        })
    ),
    actionItems: z.array(
        z.object({
            task: z
            .string()
            .describe('Tarea a llevar a cabo para solucionar el incidente'),
            ownerRole: z
            .string()
            .describe('Nombre de quién llevará a cabo la tarea para solucionar el incidente'),
            priority: z
            .enum(['low', 'medium', 'high', 'critical'])
            .describe('Prioridad de la acción')
        })
    )
});

type PostMortem = z.infer<typeof PostMortemSchema>;

async function runChallenge() {
    console.log('====================')
    console.log('🏆 EJECUTANDO RETO FINAL: INCIDENT POST-MORTEM');
    console.log('====================')

    console.log(`Analizando reporte caótico de Slack con Gemini... \n`)
    const startTime = Date.now()

    const { output } = await generateText({
        model,
        output: Output.object({
            schema: PostMortemSchema,
        }),
        prompt: `Extrae de forma analítica y precisa el reporte de port-mortem a partir del siguiente registro de 
        incidentes:\n\n${rawIncidentLog}`,
    });

    const postMortem: PostMortem = output;
    const duration = Date.now() - startTime;

    console.log(`⏱️ Inferencia completada en ${duration}ms\n`)
    console.log(`📊 REPORTE ESTRUCTURADO:`)
    console.dir(postMortem, {depth: null, colors: true});

    // ============================================================================
    // Suite de Aserciones Automáticas de Negocio
    // ============================================================================

    console.log(`\nAUDITORÍA DE INTEGRIDAD DE DATOS`);
    const checks = [
        {
            name: 'Severidad clasificada como SEV-1 (Caída crítica del sistema de pagos)',
            pass: postMortem.incident.severity === 'SEV-1',
        },
        {
            name: 'Downtime exacto = 33 minutos',
            pass: postMortem.metrics.downtimeMinutes === 33,
        },
        {
            name: 'Transacciones afectadas = 4,200',
            pass: postMortem.metrics.affectedTransactions === 4200,
        },
        {
            name: 'Monto retenido = $185,000 USD',
            pass: postMortem.metrics.estimatedLossUSD === 185000,
        },
        {
            name: 'Línea de tiempo cronológica con al menos 4 eventos',
            pass: postMortem.timeline.length >= 4,
        },
        {
            name: 'Identificados al menos 3 planes de acción acordados',
            pass: postMortem.actionItems.length >= 3,
        },
    ];

    let allPassed = true;
    for(const check of checks) {
        if (check.pass) {
            console.log(`✅ ${check.name}`);
        } else {
            console.error(`❌ Fallo: ${check.name}`)
            allPassed = false
        }
    }

    if (allPassed) {
        console.log(`\n¡Felicidades! Has superado el reto del Módulo 1 al 100%`);
    } else {
        console.warn(`\nAlgunas aserciones no pasaron. Revisa los resultados`);
    }
}

runChallenge().catch(console.error);