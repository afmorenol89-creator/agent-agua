// src/agent.js
// Procesamiento inteligente de mensajes con Claude AI

const Anthropic = require("@anthropic-ai/sdk");
const db = require("./database");
const whatsapp = require("./whatsapp");
const scheduler = require("./scheduler");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres el asistente de control de nacimientos de agua de una finca. 
Tu funcion es ayudar a los trabajadores a reportar el estado de los nacimientos.

Los nacimientos que se deben revisar son: Lote 1, Lote 2 y Lote 3.

Cuando un trabajador te escriba:
- Si envia una foto o video: confirma que lo recibiste y pregunta si hay algo anormal
- Si describe un problema: registralo y avisa que se notificara al dueno
- Si pregunta algo sobre los nacimientos: responde brevemente y amigablemente
- Siempre responde en espanol
- Se breve y claro (max 3 oraciones)
- Usa emojis con moderacion

NO hagas preguntas innecesarias. Si ya tienes la informacion, confirma y listo.`;

// Procesar mensaje de texto
async function procesarMensajeTexto(trabajador, texto) {
  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: texto }],
    });

    const respuesta = response.content[0].text;
    await whatsapp.enviarMensaje(trabajador.numero, respuesta);
    db.marcarRecordatorioRespondido(trabajador.numero);
  } catch (error) {
    console.error("Error procesando con Claude:", error.message);
    await whatsapp.enviarMensaje(
      trabajador.numero,
      "Mensaje recibido. Gracias!"
    );
  }
}

// Procesar mensaje multimedia (foto o video)
async function procesarMultimedia(trabajador, tipo, mediaId) {
  try {
    // Guardar referencia en DB
    const url = await whatsapp.obtenerUrlMultimedia(mediaId);
    db.guardarMultimedia(trabajador.numero, tipo, mediaId, url);

    // Registrar la revision del dia
    const hoy = new Date().toISOString().split("T")[0];
    db.registrarRevision(trabajador.numero, trabajador.nombre, "todos", hoy);
    db.marcarConMultimedia(trabajador.numero, tipo);
    db.marcarRecordatorioRespondido(trabajador.numero);

    // Contar cuantos archivos lleva hoy
    const revisiones = db.obtenerRevisionesHoy();
    const deEsteWorker = revisiones.filter(
      (r) => r.trabajador_numero === trabajador.numero
    );
    const tieneAmbosTipos =
      deEsteWorker.some((r) => r.tiene_foto) &&
      deEsteWorker.some((r) => r.tiene_video);

    if (tieneAmbosTipos) {
      // Tiene foto y video - reporte completo
      await whatsapp.enviarConfirmacion(trabajador);
    } else {
      const tipoRecibido = tipo === "image" ? "foto" : "video";
      const tipoFaltante = tipo === "image" ? "video" : "foto";
      await whatsapp.enviarMensaje(
        trabajador.numero,
        `${tipoRecibido === "foto" ? "Foto" : "Video"} recibida. Gracias! Cuando puedas, envia tambien el ${tipoFaltante}. 📋`
      );
    }
  } catch (error) {
    console.error("Error procesando multimedia:", error.message);
    await whatsapp.enviarMensaje(
      trabajador.numero,
      "Archivo recibido y guardado. Gracias!"
    );
  }
}

// Punto de entrada principal para procesar cualquier mensaje entrante
async function procesarMensaje(numeroRemitente, mensaje) {
  const trabajadores = scheduler.obtenerTrabajadores();
  const trabajador = trabajadores.find((t) => t.numero === numeroRemitente);

  if (!trabajador) {
    console.log(`Mensaje de numero desconocido: ${numeroRemitente}`);
    return;
  }

  console.log(
    `[${new Date().toLocaleString("es-CR")}] Mensaje de ${trabajador.nombre}: ${mensaje.type}`
  );

  if (mensaje.type === "text") {
    await procesarMensajeTexto(trabajador, mensaje.text.body);
  } else if (mensaje.type === "image") {
    await procesarMultimedia(trabajador, "image", mensaje.image.id);
  } else if (mensaje.type === "video") {
    await procesarMultimedia(trabajador, "video", mensaje.video.id);
  } else {
    // Tipo no manejado (audio, documento, etc.)
    await whatsapp.enviarMensaje(
      trabajador.numero,
      "Recibido! Por favor envia fotos o videos de los nacimientos. 📸"
    );
  }
}

module.exports = { procesarMensaje };
