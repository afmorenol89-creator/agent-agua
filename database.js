// src/database.js
const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");

const adapter = new FileSync(path.join(__dirname, "../database/finca.json"));
const db = low(adapter);

// Valores por defecto
db.defaults({ revisiones: [], recordatorios: [], multimedia: [] }).write();

function registrarRevision(trabajadorNumero, trabajadorNombre, lote, fecha) {
  db.get("revisiones").push({
    id: Date.now(),
    trabajador_numero: trabajadorNumero,
    trabajador_nombre: trabajadorNombre,
    lote,
    fecha_revision: fecha,
    fecha_creacion: new Date().toISOString(),
    tiene_foto: false,
    tiene_video: false,
    completado: false,
  }).write();
}

function marcarConMultimedia(trabajadorNumero, tipo) {
  const hoy = new Date().toISOString().split("T")[0];
  const campo = tipo === "image" ? "tiene_foto" : "tiene_video";
  const revision = db.get("revisiones")
    .filter({ trabajador_numero: trabajadorNumero, fecha_revision: hoy })
    .last()
    .value();
  if (revision) {
    db.get("revisiones")
      .find({ id: revision.id })
      .assign({ [campo]: true, completado: true })
      .write();
  }
}

function obtenerRevisionesHoy() {
  const hoy = new Date().toISOString().split("T")[0];
  return db.get("revisiones").filter({ fecha_revision: hoy }).value();
}

function obtenerHistorial(dias = 30) {
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  return db.get("revisiones")
    .filter(r => new Date(r.fecha_revision) >= desde)
    .value();
}

function registrarRecordatorio(trabajadorNumero) {
  db.get("recordatorios").push({
    id: Date.now(),
    trabajador_numero: trabajadorNumero,
    fecha_envio: new Date().toISOString(),
    respondio: false,
    alerta_enviada: false,
  }).write();
}

function marcarRecordatorioRespondido(trabajadorNumero) {
  const recordatorio = db.get("recordatorios")
    .filter({ trabajador_numero: trabajadorNumero, respondio: false })
    .last()
    .value();
  if (recordatorio) {
    db.get("recordatorios")
      .find({ id: recordatorio.id })
      .assign({ respondio: true, fecha_respuesta: new Date().toISOString() })
      .write();
  }
}

function obtenerRecordatoriosSinRespuesta() {
  const hace12h = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  return db.get("recordatorios")
    .filter(r => !r.respondio && !r.alerta_enviada && r.fecha_envio <= hace12h)
    .value();
}

function marcarAlertaEnviada(id) {
  db.get("recordatorios").find({ id }).assign({ alerta_enviada: true }).write();
}

function guardarMultimedia(trabajadorNumero, tipo, mediaId, url = null) {
  db.get("multimedia").push({
    id: Date.now(),
    trabajador_numero: trabajadorNumero,
    tipo,
    media_id: mediaId,
    url,
    fecha: new Date().toISOString(),
  }).write();
}

function obtenerEstadisticas() {
  const hoy = new Date().toISOString().split("T")[0];
  const revisionesHoy = db.get("revisiones").filter({ fecha_revision: hoy }).value();
  return {
    hoy: {
      reportaron: new Set(r
