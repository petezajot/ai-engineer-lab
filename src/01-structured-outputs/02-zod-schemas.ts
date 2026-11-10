// Módulo 01 — Lección 2: Modelado Avanzado con Zod
import 'dotenv/config';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

const model = google('gemini-3.5-flash-lite');

const rawInvoiceText = `
INVOICE #INV-2026-0042
Fecha de emisión: 04 de Noviembre de 2026
Proveedor: CloudScale Technologies S.A. de C.V. (RFC: CST190823AB1)
Cliente: FinTech Innovations Inc.
Moneda: USD
Líneas de Detalle:
1. Instancias GPU H100 - Horas bajo demanda
   Cantidad: 40 hrs | Precio Unitario: $3.25 | Subtotal: $130.00
2. Almacenamiento SSD NVMe Dedicado 2TB
   Cantidad: 1 mes | Precio Unitario: $150.00 | Subtotal: $150.00
3. Soporte Enterprise 24/7 SLA 99.99%
   Cantidad: 1 | Precio Unitario: $200.00 | Subtotal: $200.00
Descuento aplicado: Cupón STARTUP_ACCEL por -$30.00
IVA / Impuestos (16%): $72.00
Total a Pagar: $522.00
Estado: Pendiente de pago. Vence en 15 días.
`

const InvoiceSchema = z.object({
    invoiceNumber: z.string().describe('Código identificador de la factura'),
    issueDate: z.string().describe('Fecha de emisión normalizada en formato ISO YYYY-MM-DD'), // Normalización de formato
    vendor: z.object({
        name: z.string().describe('Razón social o nombre de la empresa proveedora'),
        taxId: z.string().nullable().describe('Identificación fiscal (RFC, CIF, Tax ID), o null si no existe')
    }),
    currency: z.enum(['USD', 'EUR', 'MXN', 'GBP']).describe('Código ISO de la moneda'),
    items: z.array(
        z.object({
            description: z.string().describe('Descripción del producto o servicio'),
            quantity: z.number().positive().describe('Cantidad adquirida'),
            unitPrice: z.number().nonnegative().describe('Precio unitario'),
            subtotal: z.number().nonnegative().describe('Subtotal calculado (quantity * unitPrice)')
        })
    ).describe('Lista de conceptos o productos facturados'),
    financials: z.object({
        subtotalAmount: z.number().describe('Suma de los conceptos antes de descuentos e impuestos'),
        discountAmount: z.number().nonnegative().describe('Monto descontado, 0 si no hubo'),
        taxPercentage: z.number().min(0).max(100).describe('Porcentaje de impuesto aplicado'),
        taxAmount: z.number().describe('Monto monetario del impuesto'),
        totalAmount: z.number().positive().describe('Total final a pagar')
    }),
    paymentStatus: z.enum(['pending', 'paid', 'overdue', 'cancelled']).describe('Estado de pago actual'),
    dueDays: z.number().int().nullable().describe('Días de plazo para vencimiento si se especifican, o null')
});

// Inferencia
type Invoice = z.infer<typeof InvoiceSchema>;

async function main() {
    console.log("--- 1. INICIANDO EXTRACCION FINANCIERA ---")
    const { output } = await generateText({
        model,
        output: Output.object({
            schema: InvoiceSchema,
        }),
        prompt: `Extrae todos los datos de esta factura con estricta precisión matemática: \n\n${rawInvoiceText}`
    });

    const invoice: Invoice = output;

    console.log("✅ Factura parseada:");
    console.dir(invoice, {depth: null, colors: true});

    // Verificaciones de integridad de negocio en typescript
    console.log('\n--- 2. AUDITORÍA DETERMINISTA EN RUNTIME ---');
    // Se calcula la suma real de los items en código
    const calculatedItemsSum = invoice.items.reduce((sum, item) => sum + item.subtotal, 0);
    console.log(`* Suma calculada de items: $${calculatedItemsSum.toFixed(2)}`);
    console.log(`* Subtotal reportado: $${invoice.financials.subtotalAmount.toFixed(2)}`);
    // Comprobación matemática: subtotal - descuento + impuestos = total
    const expectedTotal = invoice.financials.subtotalAmount - invoice.financials.discountAmount + invoice.financials.taxAmount;
    console.log(`* Total calculado: $${expectedTotal.toFixed(2)}`);
    console.log(`* Total reportado: $${invoice.financials.totalAmount.toFixed(2)}`)

    if (Math.abs(calculatedItemsSum - invoice.financials.subtotalAmount) < 0.01 &&
    Math.abs(expectedTotal - invoice.financials.totalAmount) < 0.01) {
        console.log('\n 🛡️ AUDITORÍA EXITOSA: La factura es matemáticamente consistente.');
    } else {
        console.warn('\n ⚠️ DISCREPANCIA: Los números de la factura no cuadran.')
    }
}

main().catch(console.error);