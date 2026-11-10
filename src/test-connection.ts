import 'dotenv/config';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

async function main() {
    console.log('📡 Probando conexión con Google Gemini...');

    const response = await generateText({
        model: google('gemini-3.5-flash-lite'),
        prompt: 'Di "¡Conexión exitosa!" y explica en 10 palabras qué es un LLM.'
    });

    console.log('\n 🤖 Respuesta del modelo: \n', response.text);
}

main().catch((error) => {
    console.error('\n ❌ Error de conexión: ', error.message);
});