# Examen-U-3

# 🧪 Mini Hackatón U3 — Sistema Web para Préstamo de Instrumentos de Laboratorio

Aplicación web sencilla para gestionar instrumentos de laboratorio con:
- Login / Logout con bcrypt  
- Roles (ADMIN / ASISTENTE / AUDITOR)  
- CRUD de instrumentos  
- Búsqueda en vivo  
- Importar y exportar Excel  
- UI con Bootstrap  

---

**Sistema Web para Préstamo de Instrumentos de Laboratorio**
(autenticación, roles, búsqueda en vivo, Excel, `.env`, `nodemon`, Bootstrap, Live Share y GitHub)

## 1) Objetivo 

Construir un sistema web **sencillo** que permita **gestionar el catálogo** de instrumentos y **registrar préstamos** básicos. Debe incluir **login**, **roles**, **CRUD de instrumentos**, **búsqueda en vivo** y **carga/descarga** de datos en **Excel**.

### Requisitos:
- Tener instalado MySQL.
- Tener un editor de código (VSCode recomendado).


 
### Dependencias

```
npm i express mysql2 dotenv bcrypt multer xlsx
npm i -D nodemon
```

---

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
## 2) Base de datos (simple y suficiente)

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

---

### Paso 1: Crear el servidor y la página web básica

1. **Crea la estructura de archivos**:

   - Crea una carpeta para tu proyecto llamada `mini-hackaton-lab`.
   - Dentro de esta carpeta, crea un archivo llamado `server.js`.
   - Crea otra carpeta llamada `public` y dentro de ella, un archivo llamado `
     index.html,
     login.html,
     instrumentos.html,
     prestamos.html (opcional),
     busqueda.html,
     navbar.html,
     styles.css`.

2. **`nodemon.json` (simple)**:

 - Crea un archivo nuevo llamado `nodemon.json` y agrega.
   
```json
{ "watch": ["server.js", "public"], "exec": "node server.js" }
```

