# Examen-U-3

### Requisitos:
- Tener instalado Node.js y MySQL.
- Tener un editor de código (VSCode recomendado).

  ### Estructura sugerida

```
/mini-hackaton-lab
├── server.js
├── package.json
├── nodemon.json
├── .env            # no subir a Git
├── .env.example    # sí subir a Git
├── /db
│   └── schema.sql
├── /uploads        # temporales xlsx
└── /public
    ├── index.html
    ├── login.html
    ├── instrumentos.html
    ├── prestamos.html (opcional)
    ├── busqueda.html
    ├── navbar.html
    └── styles.css
```
## 4) Base de datos (simple y suficiente)

Ejecutar `db/schema.sql`:

```sql
CREATE DATABASE IF NOT EXISTS laboratorio CHARACTER SET utf8mb4;
USE laboratorio;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  correo VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN','ASISTENTE','AUDITOR') NOT NULL DEFAULT 'ASISTENTE'
);

CREATE TABLE IF NOT EXISTS instrumentos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  categoria VARCHAR(80) NOT NULL,
  estado ENUM('DISPONIBLE','PRESTADO','MANTENIMIENTO') DEFAULT 'DISPONIBLE',
  ubicacion VARCHAR(120)
);

-- (Opcional) préstamos mínimos
CREATE TABLE IF NOT EXISTS prestamos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instrumento_id INT NOT NULL,
  usuario_correo VARCHAR(120) NOT NULL,
  fecha_salida DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_regreso DATETIME NULL,
  FOREIGN KEY (instrumento_id) REFERENCES instrumentos(id)
);
```

**Usuario no‑root:**

```sql
CREATE USER IF NOT EXISTS 'lab_user'@'localhost' IDENTIFIED BY 'lab_pass';
GRANT ALL PRIVILEGES ON laboratorio.* TO 'lab_user'@'localhost';
FLUSH PRIVILEGES;
```

---


**Rutas mínimas:**

* `POST /api/auth/register` 
* `POST /api/auth/login` / `POST /api/auth/logout`
* `GET /api/instrumentos` 
* `POST /api/instrumentos` 
* `PUT /api/instrumentos/:id` 
* `DELETE /api/instrumentos/:id` 
* `GET /api/instrumentos/buscar?q=` 
* `POST /api/instrumentos/upload` 
* `GET /api/instrumentos/download`

> **Seguridad mínima:** consultas **parametrizadas** (con `?`), validar campos requeridos, manejar errores con mensajes simples.

---




---
