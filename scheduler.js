// src/scheduler.js
// Programacion de recordatorios automaticos

const cron = require("node-cron");
const whatsapp = require("./whatsapp");
const db = require("./database");

function obtenerTrabajadores() {
  return [
    {
      nombre: process.env.TRABAJADOR_1_NOMBRE,
      numero: process.env.TRABAJADOR_1_NUMERO,
    },
    {
      nombre: process.env.TRABAJADOR_2_NOMBRE,
      numero: process.env.TRABAJADOR_2_NUMERO,
    },
    {
      nombre: process.env.TRABAJADOR_3_NOMBRE,
      numero: process.env.TRABAJADOR_3_NUMERO,
    },
  ].filter((t) => t.nombre && t.numero);
}

// Enviar recordatorio a todos los trabajadores
async function enviarRecordatorios() {
  const trabajadores = obtenerTrabajadores();
  console.log(
    `[${new Date().toLocaleString("es-CR")}] Enviando recordatorios a ${trabajadores.length} trabajadores...`
  );

  for (const trabajador of trabajadores) {
    try {
      await whatsapp.enviarRecordatorio(trabajador);
      db.registrarRecordatorio(trabajador.numero);
      // Pausa de 1 segundo entre mensajes para evitar rate limits
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`Error enviando a ${trabajador.nombre}:`, error.message);
    }
  }
}

// Verificar quien no ha respondido y enviar alertas
async function verificarRespuestas() {
  const trabajadores = obtenerTrabajadores();
  const pendientes = db.obtenerRecordatoriosSinRespuesta();

  for (const recordatorio of pendientes) {
    const trabajador = trabajadores.find(
      (t) => t.numero === recordatorio.trabajador_numero
    );
    if (!trabajador) continue;

    try {
      // Seguimiento al trabajador
      await whatsapp.enviarSeguimiento(trabajador);
      // Alerta al dueno
      await whatsapp.enviarAlertaDueno(trabajador.nombre, trabajador.numero);
      db.marcarAlertaEnviada(recordatorio.id);
      console.log(`Alerta enviada por falta de reporte de ${trabajador.nombre}`);
    } catch (error) {
      console.error(`Error enviando alerta por ${trabajador.nombre}:`, error.message);
    }
  }
}

function iniciarScheduler() {
  const hora = process.env.HORA_RECORDATORIO || "8";

  // Recordatorio cada 2 dias a la hora configurada
  // Lunes, miercoles, viernes = dias 1,3,5 de la semana (ajusta segun necesites)
  // O usa: cada dia y el agente lleva el conteo
  cron.schedule(
    `0 ${hora} * * 1,3,5`,
    async () => {
      console.log("Ejecutando recordatorio programado...");
      await enviarRecordatorios();
    },
    { timezone: process.env.TIMEZONE || "America/Costa_Rica" }
  );

  // Verificar falta de respuesta a las 8pm
  cron.schedule(
    `0 20 * * *`,
    async () => {
      console.log("Verificando respuestas pendientes...");
      await verificarRespuestas();
    },
    { timezone: process.env.TIMEZONE || "America/Costa_Rica" }
  );

  console.log(
    `Scheduler activo: recordatorios a las ${hora}:00, verificacion a las 20:00`
  );
}

module.exports = { iniciarScheduler, enviarRecordatorios, obtenerTrabajadores };
