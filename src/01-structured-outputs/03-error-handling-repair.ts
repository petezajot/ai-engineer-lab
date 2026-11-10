// Módulo 01 — Lección 3: Defensive Engineering & Self-Correction Loop
import 'dotenv/config';
import { generateText, Output, TypeValidationError } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

// 1. Contrato estricto con reglas de seguridad y expresiones regulares
const UserRegistrationSchema = z.object({
    username: z
    .string()
    .min(3)
    .max(15)
    .regex(/^[a-z0-9_]+$/, 'El username solo permite letras minúsculas, números y guiones bajos'),
    email: z.string().email('Debe ser un correo electrónico válido'),
    extractedAge: z
    .number()
    .int()
    .describe('Edad real reportada en el texto, NUNCA alteres ni falsifiques este valor'),
    status: z
    .enum(['approved', 'rejected_underage', 'requires_manual_review'])
    .describe('Estado de la solicitud. Rechazar como rejected_underage si es menor de 18 años'),
    rejectionReason: z
    .string()
    .nullable()
    .describe('Motivo explicito del rechazo si no cumple las políticas, o null si fue aprobado'),
    assignedRole: z
    .enum(['none', 'viewer', 'editor', 'admin'])
    .describe('Rol asignado. Si fue rechazado, debe ser none'),
    auditLog: z
    .string()
    .describe('Registro de auditoría explicando que transformaciones se hicieron (ej. saneamiento de email o username)'),
    // evitar la "Falsificación de Datos por Complacencia del Modelo (Constraint-Satisfaction Hallucination)" ⬇️
    // age: z.number().int().min(18, 'El usuario debe ser mayor de edad (mínimo 18 años)'),
});

type UserRegistration = z.infer<typeof UserRegistrationSchema>;

// 2. Entrada intencionalmente problemática y no estructurada
const ambiguousUserInput = `
Por favor da de alta al siguiente operador en el sistema:
- Nombre de usuario sugerido: JuanPerez_2026! (Con mayúsculas y signo de admiración)
- Correo: juan.perez[arroba]empresa.com
- Edad: 16 años cumplidos
- Rol solicitado: admin
`;

// 3. Patrón de Staff Engineer: Inferencia con Ciclo de Auto-corrección
async function generateWithSelfCorrection<T>({
    model,
    prompt,
    schema,
    maxRetries = 2,
}: {
    model: Parameters<typeof generateText>[0]['model'];
    prompt: string;
    schema: z.ZodType<T>;
    maxRetries?: number;
}): Promise<T> {
    let attempts = 0;
    let feedback = '';

    while (attempts <= maxRetries) {
        attempts++;
        console.log(`\n🔄 Intento #${attempts}...`)

        // Sí es un reintento, inyectamos los errores exactos de Zod al prompt
        const fullPrompt = 
        attempts === 1
        ? prompt
        : `${prompt}
        ⚠️ TU RESPUESTA ANTERIOR FUE RECHAZADA POR VALIDACIÓN DE SEGURIDAD:
        ${feedback}

        Instrucción de reparación: Corrige o normaliza los campos señalados para cumplir estrictamente con el esquema.`;

        try {
            const { output } = await generateText({
                model,
                output: Output.object({ schema }),
                prompt: fullPrompt,
            });

            console.log(`✅ Validación exitosa en el intento #${attempts}!`);
            return output;
        } catch (error) {
            if (TypeValidationError.isInstance(error)) {
                const zodError = error.cause as z.ZodError;
                const issueList = zodError.issues
                .map((issue) => `· Campo '${issue.path.join('.')}': ${issue.message}`)
                .join('\n');

                console.warn(`⚠️ Violación de esquema detectada en intento #${attempts}:\n${issueList}`);
                feedback = issueList
            } else {
                throw error;
            }
        }
    }

    throw new Error(`❌ No se pudo corregir el objeto tras ${maxRetries + 1} intentos.`);
}

// 4. Ejecución del caso de prueba
async function main() {
    console.log('--- 1. ENTRADA ANTIGUA Y PROBLEMÁTICA ---');
    console.log(ambiguousUserInput.trim());

    console.log('\n--- 2. EJECUTANDO CICLO DE AUTO-REPARACIÓN ---');

    const account = await generateWithSelfCorrection<UserRegistration>({
        model,
        prompt: `Extrae y procesa el alta de este usuario, asegurando que cumpla con las políticas de seguridad de la 
        empresa: \n\n ${ambiguousUserInput}`,
        schema: UserRegistrationSchema,
        maxRetries: 2,
    });

    console.log('\n--- 3. OBJETO FINAL VALIDADO Y SANEADO ---');
    console.dir(account, {depth: null, colors: true});
}

main().catch(console.error);

/**
 * Módulo 1
 * Lección 1: De texto libre a esquemas tipados con Constrained Decoding.
 * Lección 2: Normalización de formatos, arrays de datos y auditoría matemática.
 * Lección 3: Ingeniería defensiva, verdad de hechos vs políticas y auto-corrección.
 */