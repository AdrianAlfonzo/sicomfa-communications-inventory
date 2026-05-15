import express from "express";
import cors from "cors";
import pg from "pg";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadsDir = path.join(__dirname, "uploads");


if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(uploadsDir));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen."));
    }
  },
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// health check
app.get("/health", async (req, res) => {
  try {
    const r = await pool.query("select now() as now");
    res.json({ ok: true, db_time: r.rows[0].now });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// listar radios
app.get("/radios", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "select id, marca, modelo, serie, estado, ubicacion_texto, lat, lng, observaciones, created_at, updated_at from radios order by id desc"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// crear radio
app.post("/radios", async (req, res) => {
  const {
    marca,
    modelo,
    serie,
    estado,
    ubicacion_texto,
    lat,
    lng,
    observaciones,
  } = req.body;

  if (!marca || !modelo || !serie || lat === undefined || lng === undefined) {
    return res
      .status(400)
      .json({ error: "Faltan campos: marca, modelo, serie, lat, lng" });
  }

  const q = `
    insert into radios (marca, modelo, serie, estado, ubicacion_texto, lat, lng, observaciones)
    values ($1,$2,$3, coalesce($4,'OPERACIONAL'), $5, $6, $7, $8)
    returning *
  `;

  try {
    const { rows } = await pool.query(q, [
      marca,
      modelo,
      serie,
      estado,
      ubicacion_texto ?? null,
      Number(lat),
      Number(lng),
      observaciones ?? null,
    ]);

    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// editar radio
app.put("/radios/:id", async (req, res) => {
  const { id } = req.params;
  const {
    marca,
    modelo,
    serie,
    estado,
    ubicacion_texto,
    lat,
    lng,
    observaciones,
  } = req.body;

  if (!marca || !modelo || !serie || lat === undefined || lng === undefined) {
    return res
      .status(400)
      .json({ error: "Faltan campos: marca, modelo, serie, lat, lng" });
  }

  try {
    const result = await pool.query(
      `
      update radios
      set marca = $1,
          modelo = $2,
          serie = $3,
          estado = $4,
          ubicacion_texto = $5,
          lat = $6,
          lng = $7,
          observaciones = $8,
          updated_at = now()
      where id = $9
      returning *
      `,
      [
        marca,
        modelo,
        serie,
        estado,
        ubicacion_texto ?? null,
        Number(lat),
        Number(lng),
        observaciones ?? null,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Radio no encontrado." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

//eliminar radio
app.delete("/radios/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      "delete from radios where id = $1 returning id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Radio no encontrado." });
    }

    res.json({ ok: true, id: Number(id) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/radios/:id/fotos", upload.single("foto"), async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: "No se recibió ninguna foto." });
  }

  try { 
    const radioCheck = await pool.query(
      "select id from radios where id = $1",
      [id]
    );

    if (radioCheck.rows.length === 0) {
      return res.status(404).json({ error: "Radio no encontrado." });
    }

    const result = await pool.query(
      `
      insert into radio_fotos (radio_id, filename, original_name, mime_type)
      values ($1, $2, $3, $4)
      returning *
      `,
      [id, req.file.filename, req.file.originalname, req.file.mimetype]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/radios/:id/fotos", async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `
      select id, radio_id, filename, original_name, mime_type, created_at
      from radio_fotos
      where radio_id = $1
      order by created_at desc
      `,
      [id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API running on :${port}`)); 