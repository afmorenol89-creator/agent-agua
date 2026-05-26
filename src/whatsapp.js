// src/whatsapp.js
// Comunicacion con la API de WhatsApp Cloud (Meta)

const axios = require("axios");

const BASE_URL = "https://graph.facebook.com/v19.0";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
    "Content-Type": "application/json",
  };
}

// Enviar mensaje de texto simple
async function enviarMensaje(numero, texto) {
  try {
    const response = await axios.post(
      `${BASE_URL}/${process.env.WHATSAPP_PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: numero,
        type: "text",
        text: { body: texto },
      },
      { headers: getHeaders() }
    );
    console.log(`Mensaje enviado a ${numero}: OK`);
    return response.data;
  } catch (error) {
    console.error(
      `Error enviando mensaje a ${numero}:`,
      error.response?.data || error.message
    );
    throw error;
  }
}

// Enviar el recordatorio con formato amigable
async function enviarRecordatorio(trabajador) {
  const mensaje =
    `Buenos dias ${trabajador.nombre}! 👋\n\n` +
    `Es momento de revisar los nacimientos de agua. Por favor:\n\n` +
    `1️⃣ Visita *Lote 1*, *Lote 2* y *Lote 3*\n` +
    `2️⃣ Toma una *foto* del estado de cada uno\n` +
    `3️⃣ Graba un *video* breve mostrando el caudal\n` +
    `4️⃣ Enviame las fotos y videos aqui\n\n` +
    `Si hay algun problema (fuga, contaminacion, caudal bajo) escribe una nota.\n\n` +
    `Gracias! 🌊`;

  return await enviarMensaje(trabajador.numero, mensaje);
}

// Enviar seguimiento si no ha respondido
async function enviarSeguimiento(trabajador) {
  const mensaje =
    `Hola ${trabajador.nombre}, aun no hemos recibido tu reporte de hoy.\n\n` +
    `Por favor envia las fotos y videos de los nacimientos cuando puedas. 📸🎥`;

  return await enviarMensaje(trabajador.numero, mensaje);
}

// Confirmar que se recibio el reporte
async function enviarConfirmacion(trabajador) {
  const mensaje =
    `Reporte recibido y registrado. Gracias ${trabajador.nombre}! ✅\n\n` +
    `Proximo recordatorio en 2 dias.`;

  return await enviarMensaje(trabajador.numero, mensaje);
}

// Alertar al dueno de la finca
async function enviarAlertaDueno(trabajadorNombre, trabajadorNumero) {
  const mensaje =
    `⚠️ *Alerta Finca*\n\n` +
    `${trabajadorNombre} (${trabajadorNumero}) no ha enviado el reporte de revision de hoy.\n\n` +
    `Nacimientos sin verificar: Lote 1, Lote 2, Lote 3\n\n` +
    `Fecha: ${new Date().toLocaleDateString("es-CR")}`;

  return await enviarMensaje(process.env.TU_NUMERO, mensaje);
}

// Obtener URL de un archivo multimedia recibido
async function obtenerUrlMultimedia(mediaId) {
  try {
    const response = await axios.get(`${BASE_URL}/${mediaId}`, {
      headers: getHeaders(),
    });
    return response.data.url;
  } catch (error) {
    console.error("Error obteniendo URL multimedia:", error.message);
    return null;
  }
}

module.exports = {
  enviarMensaje,
  enviarRecordatorio,
  enviarSeguimiento,
  enviarConfirmacion,
  enviarAlertaDueno,
  obtenerUrlMultimedia,
};
