// src/index.js
// Servidor principal del agente

require("dotenv").config();
const express = require("express");
const db = require("./database");
const agent = require("./agent");
const scheduler = require("./scheduler");

const app = express();
app.use(express.json());

// ============================================
// WEBHOOK DE WHATSAPP
// ============================================

// Verificacion inicial del webhook (Meta lo llama una sola vez al configurar)
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    res.status(200).send(challenge);
  } else {
    console.error("Verificacion de webhook fallida");
    res.sendStatus(403);
  }
});

// Recibir mensajes entrantes
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    if (!value?.messages) {
      return res.sendStatus(200); // No es un mensaje, ignorar
    }

    const mensaje = value.messages[0];
    const numeroRemitente = mensaje.from;

    // Procesar de forma asincrona (no bloquear la respuesta a Meta)
    agent.procesarMensaje(numeroRemitente, mensaje).catch(console.error);

    res.sendStatus(200);
  } catch (error) {
    console.error("Error en webhook:", error);
    res.sendStatus(500);
  }
});

// ============================================
// PANEL DE ADMINISTRACION (para ti)
// ============================================

// Ver estado del dia
app.get("/estado", (req, res) => {
  const revisiones = db.obtenerRevisionesHoy();
  const stats = db.obtenerEstadisticas();

  res.json({
    fecha: new Date().toLocaleDateString("es-CR"),
    estadisticas: stats,
    revisiones_hoy: revisiones,
  });
});

// Ver historial
app.get("/historial", (req, res) => {
  const dias = parseInt(req.query.dias) || 30;
  const historial = db.obtenerHistorial(dias);
  res.json({ historial, total: historial.length });
});

// Enviar recordatorio manual (util para pruebas)
app.post("/enviar-recordatorio", async (req, res) => {
  try {
    await scheduler.enviarRecordatorios();
    res.json({ ok: true, mensaje: "Recordatorios enviados" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verificacion de salud del servidor
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ============================================
// INICIO DEL SERVIDOR
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`
  ============================================
  Agente Finca - Nacimientos de Agua
  ============================================
  Servidor corriendo en puerto ${PORT}
  Webhook: /webhook
  Panel: /estado
  ============================================
  `);

  // Iniciar programador de recordatorios
  scheduler.iniciarScheduler();
});
