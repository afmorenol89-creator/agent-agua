// src/database.js
// Manejo de la base de datos SQLite

const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "../database/finca.db");

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    initTables();
  }
  return db;
}

function initTables() {
  const database = getDB();

  // Tabla de revisiones
  database.exec(`
    CREATE TABLE IF NOT EXISTS revisiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_numero TEXT NOT NULL,
      trabajador_nombre TEXT NOT NULL,
      lote TEXT NOT NULL,
      fecha_revision TEXT NOT NULL,
      fecha_creacion TEXT DEFAULT (datetime('now')),
      tiene_foto INTEGER DEFAULT 0,
      tiene_video INTEGER DEFAULT 0,
      notas TEXT,
      completado INTEGER DEFAULT 0
    );
  `);

  // Tabla de recordatorios enviados
  database.exec(`
    CREATE TABLE IF NOT EXISTS recordatorios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_numero TEXT NOT NULL,
      fecha_envio TEXT DEFAULT (datetime('now')),
      respondio INTEGER DEFAULT 0,
      fecha_respuesta TEXT,
      alerta_enviada INTEGER DEFAULT 0
    );
  `);

  // Tabla de mensajes multimedia recibidos
  database.exec(`
    CREATE TABLE IF NOT EXISTS multimedia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trabajador_numero TEXT NOT NULL,
      tipo TEXT NOT NULL,
      media_id TEXT,
      url TEXT,
      fecha TEXT DEFAULT (datetime('now'))
    );
  `);

  console.log("Base de datos inicializada correctamente");
}

// ---- REVISIONES ----

function registrarRevision(trabajadorNumero, trabajadorNombre, lote, fecha) {
  const database = getDB();
  const stmt = database.prepare(`
    INSERT INTO revisiones (trabajador_numero, trabajador_nombre, lote, fecha_revision)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(trabajadorNumero, trabajadorNombre, lote, fecha);
}

function marcarConMultimedia(trabajadorNumero, tipo) {
  const database = getDB();
  const campo = tipo === "image" ? "tiene_foto" : "tiene_video";
  const hoy = new Date().toISOString().split("T")[0];
  const stmt = database.prepare(`
    UPDATE revisiones
    SET ${campo} = 1, completado = (tiene_foto + tiene_video >= 1)
    WHERE trabajador_numero = ?
      AND fecha_revision = ?
    ORDER BY id DESC
    LIMIT 1
  `);
  return stmt.run(trabajadorNumero, hoy);
}

function obtenerRevisionesHoy() {
  const database = getDB();
  const hoy = new Date().toISOString().split("T")[0];
  return database
    .prepare(
      `
    SELECT * FROM revisiones WHERE fecha_revision = ? ORDER BY fecha_creacion DESC
  `
    )
    .all(hoy);
}

function obtenerHistorial(dias = 30) {
  const database = getDB();
  return database
    .prepare(
      `
    SELECT * FROM revisiones 
    WHERE fecha_revision >= date('now', '-${dias} days')
    ORDER BY fecha_revision DESC, id DESC
  `
    )
    .all();
}

// ---- RECORDATORIOS ----

function registrarRecordatorio(trabajadorNumero) {
  const database = getDB();
  const stmt = database.prepare(`
    INSERT INTO recordatorios (trabajador_numero) VALUES (?)
  `);
  return stmt.run(trabajadorNumero);
}

function marcarRecordatorioRespondido(trabajadorNumero) {
  const database = getDB();
  const stmt = database.prepare(`
    UPDATE recordatorios
    SET respondio = 1, fecha_respuesta = datetime('now')
    WHERE trabajador_numero = ? AND respondio = 0
    ORDER BY id DESC
    LIMIT 1
  `);
  return stmt.run(trabajadorNumero);
}

function obtenerRecordatoriosSinRespuesta() {
  const database = getDB();
  return database
    .prepare(
      `
    SELECT * FROM recordatorios
    WHERE respondio = 0
      AND alerta_enviada = 0
      AND datetime(fecha_envio, '+12 hours') <= datetime('now')
  `
    )
    .all();
}

function marcarAlertaEnviada(id) {
  const database = getDB();
  const stmt = database.prepare(
    "UPDATE recordatorios SET alerta_enviada = 1 WHERE id = ?"
  );
  return stmt.run(id);
}

// ---- MULTIMEDIA ----

function guardarMultimedia(trabajadorNumero, tipo, mediaId, url = null) {
  const database = getDB();
  const stmt = database.prepare(`
    INSERT INTO multimedia (trabajador_numero, tipo, media_id, url)
    VALUES (?, ?, ?, ?)
  `);
  return stmt.run(trabajadorNumero, tipo, mediaId, url);
}

// ---- ESTADISTICAS ----

function obtenerEstadisticas() {
  const database = getDB();
  const hoy = new Date().toISOString().split("T")[0];

  const totalHoy = database
    .prepare(
      "SELECT COUNT(DISTINCT trabajador_numero) as total FROM revisiones WHERE fecha_revision = ?"
    )
    .get(hoy);

  const completadasHoy = database
    .prepare(
      "SELECT COUNT(DISTINCT trabajador_numero) as total FROM revisiones WHERE fecha_revision = ? AND completado = 1"
    )
    .get(hoy);

  const totalMes = database
    .prepare(
      "SELECT COUNT(*) as total FROM revisiones WHERE fecha_revision >= date('now', 'start of month')"
    )
    .get();

  return {
    hoy: { reportaron: totalHoy.total, completaron: completadasHoy.total },
    mes: { total: totalMes.total },
  };
}

module.exports = {
  getDB,
  registrarRevision,
  marcarConMultimedia,
  obtenerRevisionesHoy,
  obtenerHistorial,
  registrarRecordatorio,
  marcarRecordatorioRespondido,
  obtenerRecordatoriosSinRespuesta,
  marcarAlertaEnviada,
  guardarMultimedia,
  obtenerEstadisticas,
};
