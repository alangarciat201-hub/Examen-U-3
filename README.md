# Examen-U-3

# 🧪 Mini Hackatón — Sistema Web para Préstamo de Instrumentos de Laboratorio

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
     - Crea otra carpeta llamada `views` y dentro de ella, un archivo llamado `
     views`.

2. ### `nodemon.json` (simple)

 - Crea un archivo nuevo llamado `nodemon.json` y agrega.
   
```json
{ "watch": ["server.js", "public"], "exec": "node server.js" }
```

3. ### `.env.example`

 - Crea un archivo nuevo llamado `.env.example` y agrega.
   
```env
PORT=3000
DB_HOST=localhost
DB_USER=lab_user
DB_PASS=lab_pass
```

3. **Escribe el código básico del servidor**:

   En `server.js`, agrega el siguiente código para crear el servidor
```
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const xlsx = require('xlsx');
const bcrypt = require('bcrypt');
const app = express();
const path = require('path');
const mysql = require('mysql2');
const upload = multer({ dest: 'uploads/' });

require('dotenv').config();

// Configuración de la sesión
app.use(session({
  secret: 'secretKey',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Conexión a MySQL
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

connection.connect(err => {
  if (err) {
    console.error('Error conectando a MySQL:', err);
    return;
  }
  console.log('Conexión exitosa a MySQL');
});

// Middleware de autenticación
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }
  next();
}

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.session.user) {
      return res.redirect('/login.html');
    }
    
    const userRole = req.session.user.tipo_usuario;
    
    if (Array.isArray(allowedRoles)) {
      if (!allowedRoles.includes(userRole)) {
        return res.status(403).send('Acceso denegado');
      }
    } else {
      if (userRole !== allowedRoles) {
        return res.status(403).send('Acceso denegado');
      }
    }
    
    next();
  };
}

// ============ RUTAS PÚBLICAS ============

// Ruta de registro
app.post('/registro', (req, res) => {
  console.log('=== REGISTRO ===');
  console.log('Datos recibidos:', req.body);
  
  const { username, correo, password, codigos_de_acceso } = req.body;
  
  if (!codigos_de_acceso) {
    return mostrarError(res, 'Ingresa un código de acceso');
  }
  
  const query = 'SELECT rol FROM codigos_de_acceso WHERE codigo = ?';
  
  connection.query(query, [codigos_de_acceso.trim()], (err, results) => {
    if (err || results.length === 0) {
      console.log('Código no encontrado');
      return mostrarError(res, 'Código de acceso inválido');
    }
    
    const rolBD = results[0].rol;
    console.log('Rol encontrado en BD:', rolBD);
    
    let rolUsuario;
    if (rolBD === 'admin' || rolBD === 'Administrador') {
      rolUsuario = 'ADMIN';
    } else if (rolBD === 'asistente' || rolBD === 'Asistente') {
      rolUsuario = 'ASISTENTE';
    } else if (rolBD === 'auditor' || rolBD === 'Auditor') {
      rolUsuario = 'AUDITOR';
    } else {
      rolUsuario = 'ASISTENTE';
    }
    
    console.log('Rol convertido para insertar:', rolUsuario);
    
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const insertUser = 'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?, ?, ?, ?)';
    
    connection.query(insertUser, [username, correo, hashedPassword, rolUsuario], (err, result) => {
      if (err) {
        console.error('Error insertando:', err);
        if (err.code === 'ER_DUP_ENTRY') {
          return mostrarError(res, 'El correo ya está registrado');
        }
        return mostrarError(res, 'Error al registrar usuario');
      }
      
      console.log(`✅ Usuario ${username} registrado como ${rolUsuario}`);
      res.redirect('/login.html');
    });
  });
});

// Ruta de login
app.post('/login', (req, res) => {
  console.log('=== LOGIN ===');
  console.log('Datos recibidos:', req.body);
  
  const { correo, password } = req.body;
  
  if (!correo || !password) {
    return mostrarErrorLogin(res, 'Ingresa correo y contraseña');
  }
  
  const query = 'SELECT * FROM usuarios WHERE correo = ?';
  
  connection.query(query, [correo], (err, results) => {
    if (err) {
      console.error('Error en login:', err);
      return mostrarErrorLogin(res, 'Error en la base de datos');
    }
    
    if (results.length === 0) {
      console.log('Usuario no encontrado');
      return mostrarErrorLogin(res, 'Correo o contraseña incorrectos');
    }
    
    const user = results[0];
    console.log('Usuario encontrado:', user.nombre, 'Rol:', user.rol);
    
    const passwordValida = bcrypt.compareSync(password, user.password_hash);
    
    if (!passwordValida) {
      console.log('Contraseña incorrecta');
      return mostrarErrorLogin(res, 'Correo o contraseña incorrectos');
    }
    
    console.log('✅ Login exitoso');
    
    req.session.user = {
      id: user.id,
      nombre: user.nombre,
      correo: user.correo,
      tipo_usuario: user.rol
    };
    
    console.log('Sesión creada:', req.session.user);
    
    switch(user.rol) {
      case 'ADMIN':
        res.redirect('/admin.html');
        break;
      case 'ASISTENTE':
        res.redirect('/asistente.html');
        break;
      case 'AUDITOR':
        res.redirect('/auditor.html');
        break;
      default:
        res.redirect('/');
    }
  });
});

// Cerrar sesión
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// ============ RUTAS PROTEGIDAS ============

// Página principal
app.get('/', requireLogin, (req, res) => {
  switch(req.session.user.tipo_usuario) {
    case 'ADMIN':
      res.sendFile(path.join(__dirname, 'public', 'admin.html'));
      break;
    case 'ASISTENTE':
      res.sendFile(path.join(__dirname, 'public', 'asistente.html'));
      break;
    case 'AUDITOR':
      res.sendFile(path.join(__dirname, 'public', 'auditor.html'));
      break;
    default:
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Rutas para verificar usuario
app.get('/api/usuario-actual', requireLogin, (req, res) => {
  res.json(req.session.user);
});

app.get('/api/tipo-usuario', requireLogin, (req, res) => {
  res.json({ tipo_usuario: req.session.user.tipo_usuario });
});

// ============ CRUD INSTRUMENTOS ============

// Ver todos los instrumentos
app.get('/api/instrumentos', requireLogin, (req, res) => {
  const sql = 'SELECT * FROM instrumentos';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error consultando instrumentos' });
    }
    res.json(results);
  });
});

// Búsqueda de instrumentos - VERSIÓN CORREGIDA
app.get('/api/instrumentos/buscar', requireLogin, (req, res) => {
  const q = req.query.q || '';
  console.log(`🔍 Búsqueda recibida: "${q}"`);
  
  let sql;
  let params;
  
  if (q.trim() === '') {
    sql = 'SELECT * FROM instrumentos ORDER BY nombre';
    params = [];
  } else {
    sql = `
      SELECT * FROM instrumentos 
      WHERE nombre LIKE ? 
         OR categoria LIKE ? 
         OR estado LIKE ? 
         OR ubicacion LIKE ?
      ORDER BY nombre
    `;
    const searchTerm = `%${q}%`;
    params = [searchTerm, searchTerm, searchTerm, searchTerm];
  }
  
  console.log(`📝 SQL: ${sql}`);
  console.log(`📝 Parámetros: ${JSON.stringify(params)}`);
  
  connection.query(sql, params, (err, results) => {
    if (err) {
      console.error('❌ Error en consulta:', err);
      return res.status(500).json({ 
        error: 'Error en búsqueda', 
        message: err.message 
      });
    }
    
    console.log(`✅ Encontrados ${results.length} instrumentos`);
    
    const instrumentosFormateados = results.map(instr => ({
      id: instr.id || 0,
      nombre: instr.nombre || '',
      categoria: instr.categoria || '',
      estado: instr.estado || 'DISPONIBLE',
      ubicacion: instr.ubicacion || '',
      descripcion: instr.descripcion || '',
      marca: instr.marca || '',
      modelo: instr.modelo || ''
    }));
    
    res.json(instrumentosFormateados);
  });
});

// Crear instrumento
app.post('/api/instrumentos', requireLogin, (req, res) => {
  const { nombre, categoria, estado, ubicacion, descripcion, marca, modelo } = req.body;
  
  // Solo ADMIN puede crear instrumentos
  if (req.session.user.tipo_usuario !== 'ADMIN') {
    return res.status(403).json({ error: 'Solo administradores pueden crear instrumentos' });
  }
  
  const sql = 'INSERT INTO instrumentos (nombre, categoria, estado, ubicacion, descripcion, marca, modelo) VALUES (?, ?, ?, ?, ?, ?, ?)';
  
  connection.query(sql, [nombre, categoria, estado, ubicacion, descripcion || '', marca || '', modelo || ''], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error creando instrumento' });
    }
    res.json({ success: true, id: result.insertId });
  });
});

// Actualizar instrumento con validación de roles
// Actualizar instrumento - ESTA RUTA FALTA
app.put('/api/instrumentos/:id', requireLogin, (req, res) => {
  const { id } = req.params;
  const { nombre, categoria, estado, ubicacion, descripcion, marca, modelo } = req.body;
  
  console.log('📥 PUT /api/instrumentos/' + id);
  console.log('📦 Datos recibidos:', req.body);
  
  const userRole = req.session.user.tipo_usuario;
  
  // Validación de permisos por rol
  if (userRole === 'ASISTENTE' && estado === 'MANTENIMIENTO') {
    return res.status(403).json({ 
      error: 'Los asistentes no pueden poner instrumentos en mantenimiento' 
    });
  }
  
  // Solo ADMIN puede editar todos los campos
  if (userRole !== 'ADMIN') {
    // Para no-ADMIN, solo permitir ciertos campos
    const sql = 'UPDATE instrumentos SET nombre = ?, categoria = ?, estado = ?, ubicacion = ?, descripcion = ? WHERE id = ?';
    
    connection.query(sql, [nombre, categoria, estado, ubicacion, descripcion || '', id], (err, result) => {
      if (err) {
        console.error('❌ Error SQL:', err);
        return res.status(500).json({ 
          error: 'Error actualizando instrumento',
          details: err.message 
        });
      }
      
      console.log('✅ Instrumento actualizado. Filas afectadas:', result.affectedRows);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Instrumento no encontrado' });
      }
      
      res.json({ 
        success: true, 
        message: 'Instrumento actualizado correctamente',
        affectedRows: result.affectedRows 
      });
    });
  } else {
    // Para ADMIN, permitir todos los campos
    const sql = 'UPDATE instrumentos SET nombre = ?, categoria = ?, estado = ?, ubicacion = ?, descripcion = ?, marca = ?, modelo = ? WHERE id = ?';
    
    connection.query(sql, [nombre, categoria, estado, ubicacion, descripcion || '', marca || '', modelo || '', id], (err, result) => {
      if (err) {
        console.error('❌ Error SQL:', err);
        return res.status(500).json({ 
          error: 'Error actualizando instrumento',
          details: err.message 
        });
      }
      
      console.log('✅ Instrumento actualizado. Filas afectadas:', result.affectedRows);
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Instrumento no encontrado' });
      }
      
      res.json({ 
        success: true, 
        message: 'Instrumento actualizado correctamente',
        affectedRows: result.affectedRows 
      });
    });
  }
});

// Eliminar instrumento (solo ADMIN)
app.delete('/api/instrumentos/:id', requireLogin, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM instrumentos WHERE id = ?';
  
  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error eliminando instrumento' });
    }
    res.json({ success: true });
  });
});
// ============ GESTIÓN DE USUARIOS ============

// Obtener todos los usuarios (solo ADMIN)
app.get('/api/usuarios', requireLogin, requireRole(['ADMIN']), (req, res) => {
  console.log('📡 Solicitud GET /api/usuarios recibida');
  
  // Consulta SIN created_at (si la columna no existe)
  const sql = 'SELECT id, nombre, correo, rol FROM usuarios ORDER BY id DESC';
  
  console.log('📝 Ejecutando SQL:', sql);
  
  connection.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Error SQL:', err);
      return res.status(500).json({ 
        error: 'Error consultando usuarios', 
        details: err.message
      });
    }
    
    console.log(`✅ Consulta exitosa. Encontrados ${results.length} usuarios`);
    
    // Agregar fecha por defecto si no existe created_at
    const usuariosConFecha = results.map(usuario => ({
      ...usuario,
      created_at: new Date().toISOString() // Fecha actual como placeholder
    }));
    
    res.json(usuariosConFecha);
  });
});

// Crear nuevo usuario (solo ADMIN)
app.post('/api/usuarios', requireLogin, requireRole(['ADMIN']), (req, res) => {
  const { nombre, correo, password, rol } = req.body;
  
  // Validar datos
  if (!nombre || !correo || !password || !rol) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }
  
  // Verificar si el correo ya existe
  const checkSql = 'SELECT id FROM usuarios WHERE correo = ?';
  connection.query(checkSql, [correo], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error verificando usuario' });
    }
    
    if (results.length > 0) {
      return res.status(400).json({ error: 'El correo ya está registrado' });
    }
    
    // Hash de la contraseña
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // Insertar nuevo usuario
    const insertSql = 'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?, ?, ?, ?)';
    connection.query(insertSql, [nombre, correo, hashedPassword, rol], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error creando usuario' });
      }
      res.json({ 
        success: true, 
        id: result.insertId,
        message: 'Usuario creado exitosamente' 
      });
    });
  });
});

// Eliminar usuario (solo ADMIN)
app.delete('/api/usuarios/:id', requireLogin, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  
  // No permitir eliminar al propio usuario
  if (parseInt(id) === req.session.user.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  
  const sql = 'DELETE FROM usuarios WHERE id = ?';
  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Error eliminando usuario' });
    }
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ success: true, message: 'Usuario eliminado' });
  });
});

// Actualizar usuario (opcional - si quieres agregar edición)
// Actualizar usuario (solo ADMIN)
app.put('/api/usuarios/:id', requireLogin, requireRole(['ADMIN']), (req, res) => {
  const { id } = req.params;
  const { nombre, correo, rol } = req.body;
  
  console.log('📝 Actualizando usuario ID:', id);
  console.log('📦 Datos recibidos:', req.body);
  
  // No permitir editar el propio usuario para cambiar rol
  if (parseInt(id) === req.session.user.id && rol !== req.session.user.tipo_usuario) {
    return res.status(400).json({ 
      error: 'No puedes cambiar tu propio rol' 
    });
  }
  
  const sql = 'UPDATE usuarios SET nombre = ?, correo = ?, rol = ? WHERE id = ?';
  connection.query(sql, [nombre, correo, rol, id], (err, result) => {
    if (err) {
      console.error('❌ Error SQL:', err);
      return res.status(500).json({ 
        error: 'Error actualizando usuario',
        details: err.message 
      });
    }
    
    console.log('✅ Usuario actualizado. Filas afectadas:', result.affectedRows);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ 
      success: true, 
      message: 'Usuario actualizado correctamente',
      affectedRows: result.affectedRows 
    });
  });
});

// Descargar Excel
app.get('/descargar-instrumentos', requireLogin, (req, res) => {
  const sql = 'SELECT * FROM instrumentos';
  connection.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error');
    }
    
    const worksheet = xlsx.utils.json_to_sheet(results);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Instrumentos');
    
    const filePath = path.join(__dirname, 'instrumentos.xlsx');
    xlsx.writeFile(workbook, filePath);
    
    res.download(filePath, 'instrumentos.xlsx');
  });
});

// Subir Excel
app.post('/cargar-instrumentos', upload.single('excelFile'), requireLogin, (req, res) => {
  const filePath = req.file.path;
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  data.forEach(row => {
    const { Nombre, Categoria, Estado, Ubicacion } = row;
    const sql = 'INSERT INTO instrumentos (nombre, categoria, estado, ubicacion) VALUES (?, ?, ?, ?)';
    connection.query(sql, [Nombre, Categoria, Estado, Ubicacion]);
  });
  
  res.redirect('/');
});

// ============ FUNCIONES AUXILIARES ============

function mostrarError(res, mensaje) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Error</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body { padding: 20px; }
    </style>
  </head>
  <body>
    <div class="alert alert-danger">
      <h4>Error</h4>
      <p>${mensaje}</p>
      <a href="/registro.html" class="btn btn-primary">Volver</a>
    </div>
  </body>
  </html>`;
  res.send(html);
}

function mostrarErrorLogin(res, mensaje) {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <title>Error Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <style>
      body { padding: 20px; }
    </style>
  </head>
  <body>
    <div class="alert alert-danger">
      <h4>Error en Login</h4>
      <p>${mensaje}</p>
      <a href="/login.html" class="btn btn-primary">Volver al Login</a>
    </div>
  </body>
  </html>`;
  res.send(html);
}

// ============ INICIAR SERVIDOR ============

app.listen(3000, () => {
  console.log('Servidor corriendo en http://localhost:3000');
});

```
4. **Escribe el HTML**:

   En public/index.html, agrega lo siguiente:
```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Laboratorio</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body>
    <nav class="navbar navbar-dark bg-dark">
        <div class="container">
            <span class="navbar-brand">Laboratorio</span>
            <a href="/logout" class="btn btn-outline-light">Cerrar Sesión</a>
        </div>
    </nav>
    
    <div class="container mt-4">
        <h1>Gestión de Laboratorio</h1>
        <p>Selecciona una opción:</p>
        
        <div class="row">
            <div class="col-md-4 mb-3">
                <a href="/instrumentos.html" class="btn btn-primary w-100">Gestión de Instrumentos</a>
            </div>
            <div class="col-md-4 mb-3">
                <a href="/busqueda.html" class="btn btn-success w-100">Búsqueda</a>
            </div>
        </div>
    </div>
</body>
</html>
```
5. **Escribe el  `admin.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Administrador</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        .card-link {
            text-decoration: none;
            color: inherit;
        }
        .card-link:hover .card {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-dark bg-dark">
        <div class="container">
            <span class="navbar-brand">Panel Administrador</span>
            <div>
                <span class="text-light me-3">Bienvenido, <span id="userName"></span></span>
                <a href="/logout" class="btn btn-outline-light">Cerrar Sesión</a>
            </div>
        </div>
    </nav>
    
    <div class="container mt-4">
        <h1>Panel de Administración</h1>
        <p class="text-muted">Tienes control total sobre el sistema</p>
        
        <div class="row mt-4">
            <div class="col-md-4 mb-4">
                <a href="/instrumentos.html" class="card-link">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <i class="bi bi-tools text-primary" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Gestión de Instrumentos</h5>
                            <p class="card-text">Ver, crear, editar y eliminar instrumentos</p>
                        </div>
                    </div>
                </a>
            </div>
            
            <div class="col-md-4 mb-4">
                <a href="/busqueda.html" class="card-link">
                    <div class="card border-success">
                        <div class="card-body text-center">
                            <i class="bi bi-search text-success" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Búsqueda Avanzada</h5>
                            <p class="card-text">Buscar instrumentos con filtros avanzados</p>
                        </div>
                    </div>
                </a>
            </div>
            
            <div class="col-md-4 mb-4">
                <a href="#" onclick="cargarGestionUsuarios()" class="card-link">
                    <div class="card border-warning">
                        <div class="card-body text-center">
                            <i class="bi bi-people text-warning" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Gestión de Usuarios</h5>
                            <p class="card-text">Administrar usuarios y permisos</p>
                        </div>
                    </div>
                </a>
            </div>
        </div>
        
        <!-- Sección para gestión de usuarios -->
        <div id="gestionUsuarios" class="mt-4" style="display: none;">
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">Gestión de Usuarios</h5>
                </div>
                <div class="card-body">
                    <button class="btn btn-primary mb-3" onclick="mostrarModalNuevoUsuario()">
                        <i class="bi bi-plus-circle"></i> Nuevo Usuario
                    </button>
                    <div class="table-responsive">
                        <table class="table" id="tablaUsuarios">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Correo</th>
                                    <th>Rol</th>
                                    <th>Fecha Registro</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="tbodyUsuarios">
                                <!-- Usuarios se cargarán aquí -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Modal para nuevo usuario -->
    <div class="modal fade" id="modalNuevoUsuario" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Nuevo Usuario</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <form id="formNuevoUsuario">
                        <div class="mb-3">
                            <label class="form-label">Nombre</label>
                            <input type="text" class="form-control" id="nombreUsuario" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Correo</label>
                            <input type="email" class="form-control" id="correoUsuario" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Contraseña</label>
                            <input type="password" class="form-control" id="passwordUsuario" required>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Rol</label>
                            <select class="form-control" id="rolUsuario" required>
                                <option value="ADMIN">Administrador</option>
                                <option value="ASISTENTE">Asistente</option>
                                <option value="AUDITOR">Auditor</option>
                            </select>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="button" class="btn btn-primary" onclick="crearUsuario()">Crear Usuario</button>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    <script>
        // Cargar información del usuario
        fetch('/api/usuario-actual')
            .then(res => res.json())
            .then(user => {
                document.getElementById('userName').textContent = user.nombre;
            })
            .catch(() => window.location.href = '/login.html');
        
        // Cargar gestión de usuarios
      // Cargar gestión de usuarios
async function cargarGestionUsuarios() {
    const seccion = document.getElementById('gestionUsuarios');
    seccion.style.display = 'block';
    
    try {
        console.log('📡 Solicitando usuarios...');
        
        // Verificar que estamos autenticados primero
        const token = document.cookie.replace(/(?:(?:^|.*;\s*)token\s*=\s*([^;]*).*$)|^.*$/, "$1");
        
        const response = await fetch('/api/usuarios', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // Si usas tokens JWT, descomenta esta línea:
                // 'Authorization': `Bearer ${token}`
            },
            credentials: 'include' // Importante para enviar cookies de sesión
        });
        
        console.log('📨 Status de respuesta:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Error en respuesta:', errorText);
            
            if (response.status === 403) {
                alert('No tienes permisos para ver usuarios. Solo los administradores pueden acceder a esta función.');
                return;
            }
            
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const usuarios = await response.json();
        console.log(`✅ Usuarios recibidos:`, usuarios);
        
        const tbody = document.getElementById('tbodyUsuarios');
        tbody.innerHTML = '';
        
        if (usuarios.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4">
                        <i class="bi bi-people display-4 text-muted"></i>
                        <p class="mt-2 text-muted">No hay usuarios registrados</p>
                    </td>
                </tr>
            `;
            return;
        }
        
        usuarios.forEach(usuario => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${usuario.id}</td>
                <td>${usuario.nombre}</td>
                <td>${usuario.correo}</td>
                <td>
                    <span class="badge ${
                        usuario.rol === 'ADMIN' ? 'bg-danger' : 
                        usuario.rol === 'ASISTENTE' ? 'bg-success' : 
                        'bg-warning'
                    }">
                        ${usuario.rol}
                    </span>
                </td>
                <td>${new Date(usuario.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })}</td>
                <td>
                    <button class="btn btn-sm btn-warning" onclick="editarUsuario(${usuario.id})" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="eliminarUsuario(${usuario.id})" title="Eliminar">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
        alert(`Error al cargar usuarios: ${error.message}\n\nPor favor, verifica que estás autenticado como administrador.`);
    }
}
        function mostrarModalNuevoUsuario() {
            document.getElementById('formNuevoUsuario').reset();
            const modal = new bootstrap.Modal(document.getElementById('modalNuevoUsuario'));
            modal.show();
        }
        
        async function crearUsuario() {
            const usuario = {
                nombre: document.getElementById('nombreUsuario').value,
                correo: document.getElementById('correoUsuario').value,
                password: document.getElementById('passwordUsuario').value,
                rol: document.getElementById('rolUsuario').value
            };
            
            try {
                const response = await fetch('/api/usuarios', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(usuario)
                });
                
                if (response.ok) {
                    alert('Usuario creado exitosamente');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario'));
                    modal.hide();
                    cargarGestionUsuarios();
                } else {
                    throw new Error('Error al crear usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al crear usuario');
            }
        }
        
        async function eliminarUsuario(id) {
            if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
            
            try {
                const response = await fetch(`/api/usuarios/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    alert('Usuario eliminado');
                    cargarGestionUsuarios();
                } else {
                    throw new Error('Error al eliminar usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al eliminar usuario');
            }
        }
        // Función para editar usuario
async function editarUsuario(id) {
    console.log('📝 Editando usuario ID:', id);
    
    try {
        // Primero buscar el usuario actual
        const response = await fetch(`/api/usuarios`);
        const usuarios = await response.json();
        const usuario = usuarios.find(u => u.id === id);
        
        if (!usuario) {
            alert('Usuario no encontrado');
            return;
        }
        
        // Llenar el formulario
        document.getElementById('editUsuarioId').value = usuario.id;
        document.getElementById('editUsuarioNombre').value = usuario.nombre;
        document.getElementById('editUsuarioCorreo').value = usuario.correo;
        document.getElementById('editUsuarioRol').value = usuario.rol;
        
        // Mostrar modal
        const modal = new bootstrap.Modal(document.getElementById('modalEditarUsuario'));
        modal.show();
        
    } catch (error) {
        console.error('❌ Error al cargar usuario:', error);
        alert('Error al cargar información del usuario');
    }
}

// Función para guardar usuario editado
async function guardarUsuarioEditado() {
    const id = document.getElementById('editUsuarioId').value;
    
    const usuario = {
        nombre: document.getElementById('editUsuarioNombre').value,
        correo: document.getElementById('editUsuarioCorreo').value,
        rol: document.getElementById('editUsuarioRol').value
    };
    
    // Validación básica
    if (!usuario.nombre || !usuario.correo || !usuario.rol) {
        alert('Por favor, complete todos los campos');
        return;
    }
    
    try {
        const response = await fetch(`/api/usuarios/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(usuario)
        });
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Usuario actualizado:', result);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditarUsuario'));
            modal.hide();
            
            // Recargar tabla
            cargarGestionUsuarios();
            
            // Mostrar mensaje
            alert('Usuario actualizado correctamente');
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al actualizar usuario');
        }
        
    } catch (error) {
        console.error('❌ Error actualizando usuario:', error);
        alert('Error: ' + error.message);
    }
}

// Función para cambiar contraseña (opcional)
async function cambiarPasswordUsuario(id) {
    document.getElementById('passwordUsuarioId').value = id;
    
    const modal = new bootstrap.Modal(document.getElementById('modalCambiarPassword'));
    modal.show();
}

async function cambiarPassword() {
    const id = document.getElementById('passwordUsuarioId').value;
    const nuevaPassword = document.getElementById('nuevaPassword').value;
    const confirmarPassword = document.getElementById('confirmarPassword').value;
    
    // Validaciones
    if (nuevaPassword.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres');
        return;
    }
    
    if (nuevaPassword !== confirmarPassword) {
        alert('Las contraseñas no coinciden');
        return;
    }
    
    try {
        const response = await fetch(`/api/usuarios/${id}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: nuevaPassword })
        });
        
        if (response.ok) {
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalCambiarPassword'));
            modal.hide();
            
            // Limpiar formulario
            document.getElementById('formCambiarPassword').reset();
            
            alert('Contraseña cambiada correctamente');
            
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al cambiar contraseña');
        }
        
    } catch (error) {
        console.error('❌ Error cambiando contraseña:', error);
        alert('Error: ' + error.message);
    }
}
    </script>
    <!-- Modal para editar usuario -->
<div class="modal fade" id="modalEditarUsuario" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header bg-warning text-white">
                <h5 class="modal-title">
                    <i class="bi bi-pencil-square"></i> Editar Usuario
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="formEditarUsuario">
                    <input type="hidden" id="editUsuarioId">
                    <div class="mb-3">
                        <label class="form-label">Nombre</label>
                        <input type="text" class="form-control" id="editUsuarioNombre" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Correo</label>
                        <input type="email" class="form-control" id="editUsuarioCorreo" required>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Rol</label>
                        <select class="form-control" id="editUsuarioRol" required>
                            <option value="ADMIN">Administrador</option>
                            <option value="ASISTENTE">Asistente</option>
                            <option value="AUDITOR">Auditor</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-warning text-white" onclick="guardarUsuarioEditado()">
                    <i class="bi bi-save"></i> Guardar Cambios
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Modal para cambiar contraseña (opcional) -->
<div class="modal fade" id="modalCambiarPassword" tabindex="-1">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header bg-info text-white">
                <h5 class="modal-title">
                    <i class="bi bi-key"></i> Cambiar Contraseña
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <form id="formCambiarPassword">
                    <input type="hidden" id="passwordUsuarioId">
                    <div class="mb-3">
                        <label class="form-label">Nueva Contraseña</label>
                        <input type="password" class="form-control" id="nuevaPassword" required minlength="6">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Confirmar Contraseña</label>
                        <input type="password" class="form-control" id="confirmarPassword" required>
                    </div>
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i> La contraseña debe tener al menos 6 caracteres
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-info text-white" onclick="cambiarPassword()">
                    <i class="bi bi-check-circle"></i> Cambiar Contraseña
                </button>
            </div>
        </div>
    </div>
</div>
</body>
</html>

```

5. **Escribe el  `asistente.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Asistente</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        .card-link {
            text-decoration: none;
            color: inherit;
        }
        .card-link:hover .card {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-dark bg-success">
        <div class="container">
            <span class="navbar-brand">Panel Asistente</span>
            <div>
                <span class="text-light me-3">Bienvenido, <span id="userName"></span></span>
                <a href="/logout" class="btn btn-outline-light">Cerrar Sesión</a>
            </div>
        </div>
    </nav>
    
    <div class="container mt-4">
        <h1>Panel de Asistente</h1>
        <p class="text-muted">Puedes ver y editar instrumentos (no borrar)</p>
        
        <div class="row mt-4">
            <div class="col-md-6 mb-4">
                <a href="/instrumentos.html" class="card-link">
                    <div class="card border-success">
                        <div class="card-body text-center">
                            <i class="bi bi-tools text-success" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Gestión de Instrumentos</h5>
                            <p class="card-text">Ver y editar instrumentos (no eliminar)</p>
                        </div>
                    </div>
                </a>
            </div>
            
            <div class="col-md-6 mb-4">
                <a href="/busqueda.html" class="card-link">
                    <div class="card border-primary">
                        <div class="card-body text-center">
                            <i class="bi bi-search text-primary" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Búsqueda</h5>
                            <p class="card-text">Buscar instrumentos disponibles</p>
                        </div>
                    </div>
                </a>
            </div>
        </div>
        
        <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Permisos de Asistente:</strong> Puedes ver y editar instrumentos, pero no eliminar. 
            No puedes poner instrumentos en "Mantenimiento".
        </div>
    </div>
    
    <script>
        fetch('/api/usuario-actual')
            .then(res => res.json())
            .then(user => {
                document.getElementById('userName').textContent = user.nombre;
            })
            .catch(() => window.location.href = '/login.html');
    </script>
</body>
</html>

```

6. **Escribe el  `auditor.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Panel Auditor</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        .card-link {
            text-decoration: none;
            color: inherit;
        }
        .card-link:hover .card {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <nav class="navbar navbar-dark bg-warning">
        <div class="container">
            <span class="navbar-brand">Panel Auditor</span>
            <div>
                <span class="text-light me-3">Bienvenido, <span id="userName"></span></span>
                <a href="/logout" class="btn btn-outline-light">Cerrar Sesión</a>
            </div>
        </div>
    </nav>
    
    <div class="container mt-4">
        <h1>Panel de Auditoría</h1>
        <p class="text-muted">Modo solo lectura - Puedes ver información pero no modificar</p>
        
        <div class="row mt-4">
            <div class="col-md-6 mb-4">
                <a href="/instrumentos.html" class="card-link">
                    <div class="card border-warning">
                        <div class="card-body text-center">
                            <i class="bi bi-eye text-warning" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Ver Instrumentos</h5>
                            <p class="card-text">Consulta el inventario completo (solo lectura)</p>
                        </div>
                    </div>
                </a>
            </div>
            
            <div class="col-md-6 mb-4">
                <a href="/busqueda.html" class="card-link">
                    <div class="card border-info">
                        <div class="card-body text-center">
                            <i class="bi bi-search text-info" style="font-size: 2rem;"></i>
                            <h5 class="card-title mt-3">Búsqueda</h5>
                            <p class="card-text">Busca información específica</p>
                        </div>
                    </div>
                </a>
            </div>
        </div>
        
        <div class="alert alert-warning">
            <i class="bi bi-shield-exclamation me-2"></i>
            <strong>Modo Auditor:</strong> Solo tienes permisos de lectura. No puedes crear, editar ni eliminar registros.
        </div>
    </div>
    
    <script>
        fetch('/api/usuario-actual')
            .then(res => res.json())
            .then(user => {
                document.getElementById('userName').textContent = user.nombre;
            })
            .catch(() => window.location.href = '/login.html');
    </script>
</body>
</html>

```
7. **Escribe el  `busqueda.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Búsqueda de Instrumentos</title>
    
    <!-- Bootstrap 5.3 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <style>
        body { padding-top: 70px; }
        .card { margin-bottom: 20px; }
        .search-box { margin-bottom: 30px; }
    </style>
</head>
<body>
  
   <!-- En la navbar (después de la marca y antes del usuario) -->
<nav class="navbar navbar-dark bg-primary fixed-top">
    <div class="container-fluid">
        <a class="navbar-brand" href="#">
            <i class="bi bi-search"></i> Búsqueda de Instrumentos
        </a>
        
        <!-- BOTÓN DE REGRESO - AGREGAR ESTO -->
        <div>
            <a href="/" class="btn btn-outline-light btn-sm me-3">
                <i class="bi bi-house-door"></i> Menú Principal
            </a>
            
            <span class="text-light me-3" id="userName">Usuario</span>
            <a href="/logout" class="btn btn-sm btn-outline-light">Salir</a>
        </div>
    </div>
</nav>

    <div class="container mt-4">
        <h1 class="mb-4">Búsqueda de Instrumentos del Laboratorio</h1>
        
        <!-- Barra de búsqueda simple -->
        <div class="card search-box">
            <div class="card-body">
                <h5 class="card-title">¿Qué instrumento buscas?</h5>
                <div class="input-group">
                    <input type="text" class="form-control" id="searchInput" 
                           placeholder="Escribe el nombre, categoría o ubicación...">
                    <button class="btn btn-primary" onclick="searchInstruments()">
                        <i class="bi bi-search"></i> Buscar
                    </button>
                </div>
                <div class="mt-2">
                    <small class="text-muted">Ejemplos: "microscopio", "disponible", "laboratorio"</small>
                </div>
            </div>
        </div>

        <!-- Resultados -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Resultados</h5>
                <span class="badge bg-primary" id="resultCount">0</span>
            </div>
            <div class="card-body">
                <!-- Loading -->
                <div id="loading" class="text-center py-4">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p class="mt-2">Cargando instrumentos...</p>
                </div>
                
                <!-- Resultados -->
                <div id="resultsContainer" style="display: none;">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Nombre</th>
                                    <th>Categoría</th>
                                    <th>Estado</th>
                                    <th>Ubicación</th>
                                </tr>
                            </thead>
                            <tbody id="resultsTable">
                                <!-- Los resultados se cargarán aquí -->
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Sin resultados -->
                <div id="noResults" class="text-center py-5" style="display: none;">
                    <i class="bi bi-search display-1 text-muted mb-3"></i>
                    <h4 class="text-muted">No se encontraron instrumentos</h4>
                    <p class="text-muted">Intenta con otros términos de búsqueda</p>
                </div>
            </div>
        </div>
        
        <!-- Información de debug -->
        <div class="card mt-3">
            <div class="card-header">
                <h5 class="mb-0">Información de diagnóstico</h5>
            </div>
            <div class="card-body">
                <button class="btn btn-sm btn-info" onclick="testConnection()">
                    <i class="bi bi-wifi"></i> Probar conexión con el servidor
                </button>
                <div id="debugInfo" class="mt-2 small"></div>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        // Variables globales
        let allInstruments = [];
        
        // Cuando la página se carga
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Página de búsqueda cargada');
            
            // Cargar información del usuario
            loadUserInfo();
            
            // Cargar todos los instrumentos
            loadInstruments();
            
            // Configurar búsqueda al presionar Enter
            document.getElementById('searchInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchInstruments();
                }
            });
        });
        
        // Cargar información del usuario
        async function loadUserInfo() {
            try {
                const response = await fetch('/api/usuario-actual');
                if (response.ok) {
                    const user = await response.json();
                    document.getElementById('userName').textContent = user.nombre || 'Usuario';
                }
            } catch (error) {
                console.log('No se pudo cargar información del usuario:', error);
            }
        }
        
        // Cargar todos los instrumentos
        async function loadInstruments() {
            console.log('🔄 Iniciando carga de instrumentos...');
            showLoading();
            
            try {
                // Primero intentar con la ruta principal
                console.log('📡 Intentando conectar a /api/instrumentos/buscar...');
                const response = await fetch('/api/instrumentos/buscar?q=');
                
                if (!response.ok) {
                    throw new Error(`Error HTTP: ${response.status}`);
                }
                
                allInstruments = await response.json();
                console.log(`✅ Cargados ${allInstruments.length} instrumentos`);
                console.log('📋 Instrumentos:', allInstruments);
                
                // Mostrar resultados
                displayResults(allInstruments);
                hideLoading();
                
            } catch (error) {
                console.error('❌ Error cargando instrumentos:', error);
                
                // Intentar con ruta alternativa
                try {
                    console.log('📡 Intentando ruta alternativa /api/instrumentos-test...');
                    const testResponse = await fetch('/api/instrumentos-test');
                    
                    if (testResponse.ok) {
                        allInstruments = await testResponse.json();
                        console.log(`✅ Cargados ${allInstruments.length} instrumentos desde ruta alternativa`);
                        displayResults(allInstruments);
                    } else {
                        throw new Error('Ruta alternativa también falló');
                    }
                    
                } catch (secondError) {
                    console.error('❌ Ambas rutas fallaron:', secondError);
                    
                    // Mostrar mensaje de error amigable
                    document.getElementById('loading').innerHTML = `
                        <div class="alert alert-danger">
                            <h5>Error de conexión</h5>
                            <p>No se pudo conectar con el servidor. Verifica que:</p>
                            <ul>
                                <li>El servidor esté corriendo (node server.js)</li>
                                <li>La base de datos esté conectada</li>
                                <li>Estés autenticado correctamente</li>
                            </ul>
                            <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
                        </div>
                    `;
                }
                
                hideLoading();
            }
        }
        
        // Buscar instrumentos
        function searchInstruments() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
            
            if (!searchTerm) {
                // Si no hay término, mostrar todos
                displayResults(allInstruments);
                return;
            }
            
            // Filtrar instrumentos
            const filtered = allInstruments.filter(instrument => {
                return (
                    (instrument.nombre && instrument.nombre.toLowerCase().includes(searchTerm)) ||
                    (instrument.categoria && instrument.categoria.toLowerCase().includes(searchTerm)) ||
                    (instrument.ubicacion && instrument.ubicacion.toLowerCase().includes(searchTerm)) ||
                    (instrument.estado && instrument.estado.toLowerCase().includes(searchTerm))
                );
            });
            
            displayResults(filtered);
        }
        
        // Mostrar resultados
        function displayResults(instruments) {
            const resultsTable = document.getElementById('resultsTable');
            const resultsContainer = document.getElementById('resultsContainer');
            const noResults = document.getElementById('noResults');
            const resultCount = document.getElementById('resultCount');
            
            // Actualizar contador
            resultCount.textContent = instruments.length;
            
            if (instruments.length === 0) {
                resultsContainer.style.display = 'none';
                noResults.style.display = 'block';
                return;
            }
            
            noResults.style.display = 'none';
            resultsContainer.style.display = 'block';
            
            // Limpiar tabla
            resultsTable.innerHTML = '';
            
            // Agregar filas
            instruments.forEach(instrument => {
                const row = document.createElement('tr');
                
                // Determinar clase de estado
                let estadoClass = '';
                let estadoIcon = '';
                switch(instrument.estado) {
                    case 'DISPONIBLE':
                        estadoClass = 'success';
                        estadoIcon = 'bi-check-circle';
                        break;
                    case 'PRESTADO':
                        estadoClass = 'warning';
                        estadoIcon = 'bi-arrow-left-right';
                        break;
                    case 'MANTENIMIENTO':
                        estadoClass = 'danger';
                        estadoIcon = 'bi-wrench';
                        break;
                    default:
                        estadoClass = 'secondary';
                        estadoIcon = 'bi-question-circle';
                }
                
                row.innerHTML = `
                    <td>${instrument.id || ''}</td>
                    <td><strong>${instrument.nombre || 'Sin nombre'}</strong></td>
                    <td>${instrument.categoria || 'Sin categoría'}</td>
                    <td>
                        <span class="badge bg-${estadoClass}">
                            <i class="bi ${estadoIcon} me-1"></i>
                            ${instrument.estado || 'Desconocido'}
                        </span>
                    </td>
                    <td>${instrument.ubicacion || 'Sin ubicación'}</td>
                `;
                
                resultsTable.appendChild(row);
            });
        }
        
        // Mostrar loading
        function showLoading() {
            document.getElementById('loading').style.display = 'block';
            document.getElementById('resultsContainer').style.display = 'none';
            document.getElementById('noResults').style.display = 'none';
        }
        
        // Ocultar loading
        function hideLoading() {
            document.getElementById('loading').style.display = 'none';
        }
        
        // Probar conexión
        async function testConnection() {
            const debugInfo = document.getElementById('debugInfo');
            debugInfo.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Probando conexión...';
            
            try {
                // Probar varias rutas
                const tests = [
                    { name: 'API Principal', url: '/api/instrumentos/buscar?q=' },
                    { name: 'API Alternativa', url: '/api/instrumentos-test' },
                    { name: 'Usuario Actual', url: '/api/usuario-actual' }
                ];
                
                let results = [];
                
                for (const test of tests) {
                    try {
                        const startTime = Date.now();
                        const response = await fetch(test.url);
                        const endTime = Date.now();
                        
                        results.push(`
                            <div class="mb-1">
                                <strong>${test.name}:</strong>
                                <span class="badge bg-${response.ok ? 'success' : 'danger'}">
                                    ${response.ok ? 'OK' : 'ERROR'} (${endTime - startTime}ms)
                                </span>
                                ${!response.ok ? ` - ${response.status}` : ''}
                            </div>
                        `);
                    } catch (error) {
                        results.push(`
                            <div class="mb-1">
                                <strong>${test.name}:</strong>
                                <span class="badge bg-danger">ERROR</span>
                                - ${error.message}
                            </div>
                        `);
                    }
                }
                
                debugInfo.innerHTML = results.join('');
                
            } catch (error) {
                debugInfo.innerHTML = `<div class="text-danger">Error: ${error.message}</div>`;
            }
        }
        
        // Función simple para mostrar alertas
        function showAlert(message, type = 'info') {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
            alertDiv.innerHTML = `
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            `;
            
            document.querySelector('.container').prepend(alertDiv);
            
            setTimeout(() => {
                alertDiv.remove();
            }, 5000);
        }
    </script>
</body>
</html>

```

8. **Escribe el  `instrumentos.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestión de Instrumentos - Sistema Laboratorio</title>
    
    <!-- Bootstrap 5.3 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Bootstrap Icons -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- CSS Personalizado -->
    <link rel="stylesheet" href="/css/styles.css">
    
    <style>
        .instrument-card {
            transition: all 0.3s ease;
            border: 1px solid #e3e6f0;
        }
        
        .instrument-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.1);
        }
        
        .status-badge {
            padding: 0.5em 1em;
            border-radius: 20px;
            font-weight: 600;
        }
        
        .status-available {
            background-color: #d1f7e5;
            color: #0a8f6b;
        }
        
        .status-borrowed {
            background-color: #fff4e5;
            color: #e67700;
        }
        
        .status-maintenance {
            background-color: #ffe5e5;
            color: #e63946;
        }
        
        .action-buttons .btn {
            padding: 0.375rem 0.75rem;
            margin: 0 0.125rem;
        }
        
        .filter-tabs .nav-link {
            border-radius: 0.5rem 0.5rem 0 0;
            font-weight: 500;
        }
        
        .filter-tabs .nav-link.active {
            background-color: #4e73df;
            color: white;
        }
    </style>
</head>
<body>
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg navbar-custom navbar-dark fixed-top">
        <div class="container-fluid">
            <a class="navbar-brand fw-bold" href="/">
                <i class="bi bi-tools me-2"></i>
                Gestión de Instrumentos
            </a>
            
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarInstruments">
                <span class="navbar-toggler-icon"></span>
            </button>
            
            <div class="collapse navbar-collapse" id="navbarInstruments">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/">
                            <i class="bi bi-house me-1"></i> Inicio
                        </a>
                    </li>
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle d-flex align-items-center" href="#" data-bs-toggle="dropdown">
                            <i class="bi bi-person-circle me-2"></i>
                            <span id="userName">Usuario</span>
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end">
                            <li><a class="dropdown-item" href="#"><i class="bi bi-person me-2"></i>Mi Perfil</a></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="/logout"><i class="bi bi-box-arrow-right me-2"></i>Cerrar Sesión</a></li>
                        </ul>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Contenido Principal -->
    <div class="container-fluid mt-5 pt-4">
        <div class="row">
            <!-- Sidebar -->
            <div class="col-md-3 col-lg-2 d-md-block sidebar bg-light p-3" style="min-height: calc(100vh - 73px);">
                <div class="position-sticky">
                    <div class="text-center mb-4">
                        <div class="bg-primary rounded-circle p-3 d-inline-block">
                            <i class="bi bi-tools text-white fs-2"></i>
                        </div>
                        <h5 class="mt-3">Instrumentos</h5>
                    </div>
                    
                    <ul class="nav flex-column">
                        <li class="nav-item mb-2">
                            <a class="nav-link active" href="/instrumentos.html">
                                <i class="bi bi-grid me-2"></i>
                                Vista General
                            </a>
                        </li>
                        <li class="nav-item mb-2">
                            <a class="nav-link" href="#modalAgregar" data-bs-toggle="modal">
                                <i class="bi bi-plus-circle me-2"></i>
                                Agregar Nuevo
                            </a>
                        </li>
                        <li class="nav-item mb-2">
                            <a class="nav-link" href="/busqueda.html">
                                <i class="bi bi-search me-2"></i>
                                Búsqueda Avanzada
                            </a>
                        </li>
                        <li class="nav-item mb-2">
                            <a class="nav-link" href="/prestamos.html">
                                <i class="bi bi-arrow-left-right me-2"></i>
                                Préstamos
                            </a>
                        </li>
                        <li class="nav-item mb-2">
                            <a class="nav-link" href="#" onclick="descargarExcel()">
                                <i class="bi bi-download me-2"></i>
                                Exportar Excel
                            </a>
                        </li>
                    </ul>
                    
                    <!-- Filtros -->
                    <div class="mt-4 pt-3 border-top">
                        <h6 class="text-muted mb-3"><i class="bi bi-funnel me-2"></i>Filtrar por:</h6>
                        
                        <div class="mb-3">
                            <label class="form-label small text-muted mb-2">Estado</label>
                            <div class="btn-group w-100" role="group">
                                <button type="button" class="btn btn-outline-primary btn-sm active" onclick="filterInstruments('all')">
                                    Todos
                                </button>
                                <button type="button" class="btn btn-outline-success btn-sm" onclick="filterInstruments('DISPONIBLE')">
                                    <i class="bi bi-check-circle"></i>
                                </button>
                                <button type="button" class="btn btn-outline-warning btn-sm" onclick="filterInstruments('PRESTADO')">
                                    <i class="bi bi-arrow-left-right"></i>
                                </button>
                                <button type="button" class="btn btn-outline-danger btn-sm" onclick="filterInstruments('MANTENIMIENTO')">
                                    <i class="bi bi-wrench"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small text-muted mb-2">Categoría</label>
                            <select class="form-select form-select-sm" id="filterCategory" onchange="filterByCategory()">
                                <option value="">Todas las categorías</option>
                            </select>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label small text-muted mb-2">Ubicación</label>
                            <select class="form-select form-select-sm" id="filterLocation" onchange="filterByLocation()">
                                <option value="">Todas las ubicaciones</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Contenido Principal -->
            <main class="col-md-9 ms-sm-auto col-lg-10 px-md-4">
                <!-- Header con acciones -->
                <div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
                    <div>
                        <h1 class="h2"><i class="bi bi-tools me-2"></i>Gestión de Instrumentos</h1>
                        <p class="text-muted mb-0">Administra todos los instrumentos del laboratorio</p>
                    </div>
                    <div class="btn-toolbar mb-2 mb-md-0">
                        <div class="btn-group me-2">
                            <button type="button" class="btn btn-sm btn-outline-secondary" onclick="refreshTable()">
                                <i class="bi bi-arrow-clockwise"></i> Actualizar
                            </button>
                            <button type="button" class="btn btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modalImportar">
                                <i class="bi bi-upload me-1"></i> Importar
                            </button>
                        </div>
                        <button type="button" class="btn btn-sm btn-primary" data-bs-toggle="modal" data-bs-target="#modalAgregar">
                            <i class="bi bi-plus-circle me-1"></i> Nuevo Instrumento
                        </button>
                    </div>
                </div>

                <!-- Estadísticas Rápidas -->
                <div class="row mb-4">
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-start border-primary border-4 shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs fw-bold text-primary text-uppercase mb-1">
                                            Total Instrumentos
                                        </div>
                                        <div class="h5 mb-0 fw-bold text-gray-800" id="totalCount">0</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="bi bi-tools fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-start border-success border-4 shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs fw-bold text-success text-uppercase mb-1">
                                            Disponibles
                                        </div>
                                        <div class="h5 mb-0 fw-bold text-gray-800" id="availableCount">0</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="bi bi-check-circle fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-start border-warning border-4 shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs fw-bold text-warning text-uppercase mb-1">
                                            Prestados
                                        </div>
                                        <div class="h5 mb-0 fw-bold text-gray-800" id="borrowedCount">0</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="bi bi-arrow-left-right fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="col-xl-3 col-md-6 mb-4">
                        <div class="card border-start border-danger border-4 shadow h-100 py-2">
                            <div class="card-body">
                                <div class="row no-gutters align-items-center">
                                    <div class="col mr-2">
                                        <div class="text-xs fw-bold text-danger text-uppercase mb-1">
                                            Mantenimiento
                                        </div>
                                        <div class="h5 mb-0 fw-bold text-gray-800" id="maintenanceCount">0</div>
                                    </div>
                                    <div class="col-auto">
                                        <i class="bi bi-wrench fa-2x text-gray-300"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Tabs de Filtros -->
                <ul class="nav nav-tabs filter-tabs mb-4" id="myTab" role="tablist">
                    <li class="nav-item" role="presentation">
                        <button class="nav-link active" id="all-tab" data-bs-toggle="tab" data-bs-target="#all" type="button" role="tab">
                            <i class="bi bi-grid me-1"></i> Todos
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="available-tab" data-bs-toggle="tab" data-bs-target="#available" type="button" role="tab">
                            <i class="bi bi-check-circle me-1"></i> Disponibles
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="borrowed-tab" data-bs-toggle="tab" data-bs-target="#borrowed" type="button" role="tab">
                            <i class="bi bi-arrow-left-right me-1"></i> Prestados
                        </button>
                    </li>
                    <li class="nav-item" role="presentation">
                        <button class="nav-link" id="maintenance-tab" data-bs-toggle="tab" data-bs-target="#maintenance" type="button" role="tab">
                            <i class="bi bi-wrench me-1"></i> Mantenimiento
                        </button>
                    </li>
                </ul>

                <!-- Contenido de los Tabs -->
                <div class="tab-content" id="myTabContent">
                    <!-- Tab Todos -->
                    <div class="tab-pane fade show active" id="all" role="tabpanel">
                        <div class="card shadow mb-4">
                            <div class="card-header py-3 d-flex justify-content-between align-items-center">
                                <h6 class="m-0 fw-bold text-primary">Todos los Instrumentos</h6>
                                <div class="input-group" style="width: 300px;">
                                    <input type="text" class="form-control" placeholder="Buscar instrumento..." id="searchInput" onkeyup="searchInstruments()">
                                    <button class="btn btn-outline-primary" type="button">
                                        <i class="bi bi-search"></i>
                                    </button>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-hover table-bordered" id="instrumentosTable">
                                        <thead class="table-light">
                                            <tr>
                                                <th>ID</th>
                                                <th>Nombre</th>
                                                <th>Categoría</th>
                                                <th>Estado</th>
                                                <th>Ubicación</th>
                                                <th>Fecha Registro</th>
                                                <th>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody id="tableBody">
                                            <!-- Los datos se cargarán con JavaScript -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Tab Disponibles -->
                    <div class="tab-pane fade" id="available" role="tabpanel">
                        <div class="row" id="availableInstruments">
                            <!-- Se cargarán con JavaScript -->
                        </div>
                    </div>
                    
                    <!-- Tab Prestados -->
                    <div class="tab-pane fade" id="borrowed" role="tabpanel">
                        <div class="row" id="borrowedInstruments">
                            <!-- Se cargarán con JavaScript -->
                        </div>
                    </div>
                    
                    <!-- Tab Mantenimiento -->
                    <div class="tab-pane fade" id="maintenance" role="tabpanel">
                        <div class="row" id="maintenanceInstruments">
                            <!-- Se cargarán con JavaScript -->
                        </div>
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- Modal para Agregar Instrumento -->
    <div class="modal fade" id="modalAgregar" tabindex="-1" aria-labelledby="modalAgregarLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header bg-primary text-white">
                    <h5 class="modal-title" id="modalAgregarLabel">
                        <i class="bi bi-plus-circle me-2"></i>Agregar Nuevo Instrumento
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="formAgregarInstrumento" onsubmit="return agregarInstrumento(event)">
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="nombre" class="form-label">Nombre del Instrumento *</label>
                                <input type="text" class="form-control" id="nombre" required placeholder="Ej: Microscopio Óptico">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="categoria" class="form-label">Categoría *</label>
                                <select class="form-select" id="categoria" required>
                                    <option value="">Seleccionar categoría</option>
                                    <option value="Óptico">Óptico</option>
                                    <option value="Electrónico">Electrónico</option>
                                    <option value="Mecánico">Mecánico</option>
                                    <option value="Químico">Químico</option>
                                    <option value="Biológico">Biológico</option>
                                    <option value="Medición">Medición</option>
                                    <option value="Diagnóstico">Diagnóstico</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="estado" class="form-label">Estado *</label>
                                <select class="form-select" id="estado" required>
                                    <option value="">Seleccionar estado</option>
                                    <option value="DISPONIBLE">DISPONIBLE</option>
                                    <option value="PRESTADO">PRESTADO</option>
                                    <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                                </select>
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="ubicacion" class="form-label">Ubicación *</label>
                                <input type="text" class="form-control" id="ubicacion" required placeholder="Ej: Laboratorio A, Estante 3">
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label for="descripcion" class="form-label">Descripción</label>
                            <textarea class="form-control" id="descripcion" rows="3" placeholder="Descripción detallada del instrumento..."></textarea>
                        </div>
                        
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="marca" class="form-label">Marca</label>
                                <input type="text" class="form-control" id="marca" placeholder="Marca del instrumento">
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="modelo" class="form-label">Modelo/Serial</label>
                                <input type="text" class="form-control" id="modelo" placeholder="Número de modelo o serial">
                            </div>
                        </div>
                        
                        <div class="alert alert-info">
                            <i class="bi bi-info-circle me-2"></i>
                            Los campos marcados con * son obligatorios.
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="submit" form="formAgregarInstrumento" class="btn btn-primary">
                        <i class="bi bi-check-circle me-2"></i>Guardar Instrumento
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal para Importar Excel -->
    <div class="modal fade" id="modalImportar" tabindex="-1" aria-labelledby="modalImportarLabel" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header bg-info text-white">
                    <h5 class="modal-title" id="modalImportarLabel">
                        <i class="bi bi-upload me-2"></i>Importar desde Excel
                    </h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form id="formImportarExcel" enctype="multipart/form-data">
                        <div class="mb-3">
                            <label for="excelFile" class="form-label">Seleccionar archivo Excel</label>
                            <input class="form-control" type="file" id="excelFile" accept=".xlsx,.xls" required>
                            <div class="form-text">Formatos aceptados: .xlsx, .xls</div>
                        </div>
                        
                        <div class="alert alert-warning">
                            <i class="bi bi-exclamation-triangle me-2"></i>
                            <strong>Importante:</strong> El archivo debe tener las columnas: Nombre, Categoría, Estado, Ubicación
                        </div>
                        
                        <div class="text-center">
                            <a href="/plantilla_instrumentos.xlsx" class="btn btn-outline-primary btn-sm">
                                <i class="bi bi-download me-1"></i>Descargar Plantilla
                            </a>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                    <button type="submit" form="formImportarExcel" class="btn btn-info text-white">
                        <i class="bi bi-upload me-2"></i>Importar
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Modal para Editar Instrumento -->
<!-- Modal para Editar Instrumento -->
<div class="modal fade" id="modalEditar" tabindex="-1" aria-labelledby="modalEditarLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header bg-warning text-white">
                <h5 class="modal-title" id="modalEditarLabel">
                    <i class="bi bi-pencil me-2"></i>Editar Instrumento
                </h5>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <!-- IMPORTANTE: Este div debe tener id="formEditarInstrumento" -->
                <form id="formEditarInstrumento">
                    <input type="hidden" id="editId">
                    <!-- Los campos se llenarán dinámicamente con JavaScript -->
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                <button type="button" class="btn btn-warning text-white" onclick="actualizarInstrumento()" id="btnGuardarCambios">
                    <i class="bi bi-save me-2"></i>Guardar Cambios
                </button>
            </div>
        </div>
    </div>
</div>
    <!-- Bootstrap JS Bundle -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        let allInstruments = [];
        let currentUserRole = '';
        
        // Cargar información del usuario y datos iniciales
        document.addEventListener('DOMContentLoaded', function() {
            loadUserInfo();
            loadInstruments();
            
            // Configurar el formulario de importación
            document.getElementById('formImportarExcel').addEventListener('submit', function(e) {
                e.preventDefault();
                importarExcel();
            });
        });
        
        // Cargar información del usuario
        async function loadUserInfo() {
            try {
                const response = await fetch('/api/usuario-actual');
                if (!response.ok) {
                    window.location.href = '/login.html';
                    return;
                }
                const user = await response.json();
                document.getElementById('userName').textContent = user.nombre || 'Usuario';
                currentUserRole = user.tipo_usuario || '';
            } catch (error) {
                console.error('Error cargando información del usuario:', error);
                window.location.href = '/login.html';
            }
        }
        
        // Cargar todos los instrumentos
        async function loadInstruments() {
            try {
                const response = await fetch('/api/instrumentos/buscar?q=');
                if (!response.ok) throw new Error('Error en la respuesta');
                
                allInstruments = await response.json();
                updateStats();
                renderTable(allInstruments);
                renderCards();
                populateFilters();
            } catch (error) {
                console.error('Error cargando instrumentos:', error);
                showAlert('Error al cargar los instrumentos', 'danger');
            }
        }
        
        // Actualizar estadísticas
        function updateStats() {
            const total = allInstruments.length;
            const available = allInstruments.filter(i => i.estado === 'DISPONIBLE').length;
            const borrowed = allInstruments.filter(i => i.estado === 'PRESTADO').length;
            const maintenance = allInstruments.filter(i => i.estado === 'MANTENIMIENTO').length;
            
            document.getElementById('totalCount').textContent = total;
            document.getElementById('availableCount').textContent = available;
            document.getElementById('borrowedCount').textContent = borrowed;
            document.getElementById('maintenanceCount').textContent = maintenance;
        }
        
        // Renderizar tabla con control de permisos por rol - VERSIÓN CORREGIDA
// VERSIÓN SUPER SIMPLE - elimina todo el if/else complejo
// Renderizar tabla con control de permisos por rol - VERSIÓN ORIGINAL CORREGIDA
function renderTable(instruments) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    if (instruments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4">
                    <i class="bi bi-inbox display-4 text-muted"></i>
                    <p class="mt-3 text-muted">No hay instrumentos registrados</p>
                </td>
            </tr>
        `;
        return;
    }
    
    instruments.forEach(instrument => {
        let statusClass = '';
        let statusText = '';
        switch(instrument.estado) {
            case 'DISPONIBLE':
                statusClass = 'status-available';
                statusText = 'Disponible';
                break;
            case 'PRESTADO':
                statusClass = 'status-borrowed';
                statusText = 'Prestado';
                break;
            case 'MANTENIMIENTO':
                statusClass = 'status-maintenance';
                statusText = 'Mantenimiento';
                break;
        }
        
        const row = document.createElement('tr');
        
        let accionesHTML = '';
        
        if (currentUserRole === 'ADMIN') {
            accionesHTML = `
                <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})" title="Ver">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="editInstrument(${instrument.id})" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteInstrument(${instrument.id})" title="Eliminar">
                    <i class="bi bi-trash"></i>
                </button>
            `;
        } else if (currentUserRole === 'ASISTENTE') {
            accionesHTML = `
                <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})" title="Ver">
                    <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="editInstrument(${instrument.id})" title="Editar">
                    <i class="bi bi-pencil"></i>
                </button>
            `;
        } else if (currentUserRole === 'AUDITOR') {
            accionesHTML = `
                <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})" title="Ver">
                    <i class="bi bi-eye"></i>
                </button>
            `;
        }
        
        row.innerHTML = `
            <td class="fw-bold">${instrument.id}</td>
            <td>
                <strong>${instrument.nombre}</strong>
                ${instrument.marca ? `<br><small class="text-muted">${instrument.marca}</small>` : ''}
            </td>
            <td>
                <span class="badge bg-info">${instrument.categoria}</span>
            </td>
            <td>
                <span class="status-badge ${statusClass}">${statusText}</span>
            </td>
            <td>${instrument.ubicacion}</td>
            <td>${new Date().toLocaleDateString()}</td>
            <td class="action-buttons">
                ${accionesHTML}
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

        // Renderizar tarjetas para las vistas de tabs
        function renderCards() {
            renderCardSet('availableInstruments', 'DISPONIBLE');
            renderCardSet('borrowedInstruments', 'PRESTADO');
            renderCardSet('maintenanceInstruments', 'MANTENIMIENTO');
        }
        
        function renderCardSet(containerId, estado) {
            const container = document.getElementById(containerId);
            const filtered = allInstruments.filter(i => i.estado === estado);
            
            if (filtered.length === 0) {
                container.innerHTML = `
                    <div class="col-12">
                        <div class="alert alert-info text-center">
                            <i class="bi bi-info-circle me-2"></i>
                            No hay instrumentos ${estado.toLowerCase()}.
                        </div>
                    </div>
                `;
                return;
            }
            
            let cardsHTML = '';
            filtered.forEach(instrument => {
                let statusClass = '';
                let statusIcon = '';
                
                switch(estado) {
                    case 'DISPONIBLE':
                        statusClass = 'border-success';
                        statusIcon = 'bi-check-circle text-success';
                        break;
                    case 'PRESTADO':
                        statusClass = 'border-warning';
                        statusIcon = 'bi-arrow-left-right text-warning';
                        break;
                    case 'MANTENIMIENTO':
                        statusClass = 'border-danger';
                        statusIcon = 'bi-wrench text-danger';
                        break;
                }
                
                let botonesHTML = '';
                
                if (currentUserRole === 'ADMIN') {
                    botonesHTML = `
                        <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editInstrument(${instrument.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteInstrument(${instrument.id})">
                            <i class="bi bi-trash"></i>
                        </button>
                    `;
                } else if (currentUserRole === 'ASISTENTE') {
                    botonesHTML = `
                        <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-warning" onclick="editInstrument(${instrument.id})">
                            <i class="bi bi-pencil"></i>
                        </button>
                    `;
                } else if (currentUserRole === 'AUDITOR') {
                    botonesHTML = `
                        <button class="btn btn-sm btn-outline-primary" onclick="viewInstrument(${instrument.id})">
                            <i class="bi bi-eye"></i>
                        </button>
                    `;
                }
                
                cardsHTML += `
                    <div class="col-md-6 col-lg-4 mb-4">
                        <div class="card instrument-card h-100 ${statusClass}">
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h6 class="mb-0"><i class="bi ${statusIcon} me-2"></i>${instrument.nombre}</h6>
                                <span class="badge bg-secondary">#${instrument.id}</span>
                            </div>
                            <div class="card-body">
                                <p class="card-text">
                                    <strong>Categoría:</strong> ${instrument.categoria}<br>
                                    <strong>Ubicación:</strong> ${instrument.ubicacion}<br>
                                    ${instrument.descripcion ? `<strong>Descripción:</strong> ${instrument.descripcion.substring(0, 100)}...` : ''}
                                </p>
                            </div>
                            <div class="card-footer bg-transparent">
                                <div class="d-flex justify-content-between">
                                    ${botonesHTML}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = cardsHTML;
        }
        
        // Llenar filtros con opciones únicas
        function populateFilters() {
            const categories = [...new Set(allInstruments.map(i => i.categoria))];
            const locations = [...new Set(allInstruments.map(i => i.ubicacion))];
            
            const categorySelect = document.getElementById('filterCategory');
            const locationSelect = document.getElementById('filterLocation');
            
            // Limpiar opciones
            while (categorySelect.options.length > 1) categorySelect.remove(1);
            while (locationSelect.options.length > 1) locationSelect.remove(1);
            
            categories.forEach(cat => {
                if (cat) {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    categorySelect.appendChild(option);
                }
            });
            
            locations.forEach(loc => {
                if (loc) {
                    const option = document.createElement('option');
                    option.value = loc;
                    option.textContent = loc;
                    locationSelect.appendChild(option);
                }
            });
        }
        
        // Filtrar instrumentos
        function filterInstruments(estado) {
            if (estado === 'all') {
                renderTable(allInstruments);
            } else {
                const filtered = allInstruments.filter(i => i.estado === estado);
                renderTable(filtered);
            }
        }
        
        function filterByCategory() {
            const category = document.getElementById('filterCategory').value;
            if (!category) {
                renderTable(allInstruments);
                return;
            }
            
            const filtered = allInstruments.filter(i => i.categoria === category);
            renderTable(filtered);
        }
        
        function filterByLocation() {
            const location = document.getElementById('filterLocation').value;
            if (!location) {
                renderTable(allInstruments);
                return;
            }
            
            const filtered = allInstruments.filter(i => i.ubicacion === location);
            renderTable(filtered);
        }
        
        // Buscar instrumentos
        function searchInstruments() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            if (!searchTerm) {
                renderTable(allInstruments);
                return;
            }
            
            const filtered = allInstruments.filter(i => 
                (i.nombre && i.nombre.toLowerCase().includes(searchTerm)) ||
                (i.categoria && i.categoria.toLowerCase().includes(searchTerm)) ||
                (i.ubicacion && i.ubicacion.toLowerCase().includes(searchTerm)) ||
                (i.descripcion && i.descripcion.toLowerCase().includes(searchTerm))
            );
            
            renderTable(filtered);
        }
        
        // Agregar nuevo instrumento
        async function agregarInstrumento(event) {
            event.preventDefault();
            
            const instrumento = {
                nombre: document.getElementById('nombre').value,
                categoria: document.getElementById('categoria').value,
                estado: document.getElementById('estado').value,
                ubicacion: document.getElementById('ubicacion').value,
                descripcion: document.getElementById('descripcion').value,
                marca: document.getElementById('marca').value,
                modelo: document.getElementById('modelo').value
            };
            
            try {
                const response = await fetch('/api/instrumentos', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(instrumento)
                });
                
                if (response.ok) {
                    showAlert('Instrumento agregado exitosamente', 'success');
                    document.getElementById('formAgregarInstrumento').reset();
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modalAgregar'));
                    modal.hide();
                    loadInstruments();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Error al agregar instrumento');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert(error.message || 'Error al agregar instrumento', 'danger');
            }
        }
        
        // Ver instrumento
        function viewInstrument(id) {
            const instrument = allInstruments.find(i => i.id === id);
            if (instrument) {
                const modalHTML = `
                    <div class="modal fade" id="modalVer${id}" tabindex="-1">
                        <div class="modal-dialog modal-lg">
                            <div class="modal-content">
                                <div class="modal-header bg-info text-white">
                                    <h5 class="modal-title">Detalles del Instrumento</h5>
                                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="row">
                                        <div class="col-md-4">
                                            <div class="text-center">
                                                <i class="bi bi-tools display-1 text-info"></i>
                                            </div>
                                        </div>
                                        <div class="col-md-8">
                                            <h4>${instrument.nombre}</h4>
                                            <hr>
                                            <div class="row">
                                                <div class="col-6">
                                                    <p><strong>ID:</strong> ${instrument.id}</p>
                                                    <p><strong>Categoría:</strong> ${instrument.categoria}</p>
                                                    <p><strong>Estado:</strong> ${instrument.estado}</p>
                                                    <p><strong>Ubicación:</strong> ${instrument.ubicacion}</p>
                                                </div>
                                                <div class="col-6">
                                                    ${instrument.marca ? `<p><strong>Marca:</strong> ${instrument.marca}</p>` : ''}
                                                    ${instrument.modelo ? `<p><strong>Modelo:</strong> ${instrument.modelo}</p>` : ''}
                                                    <p><strong>Fecha Registro:</strong> ${new Date().toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            ${instrument.descripcion ? `
                                                <div class="mt-3">
                                                    <strong>Descripción:</strong>
                                                    <p class="mt-2">${instrument.descripcion}</p>
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                const modalContainer = document.createElement('div');
                modalContainer.innerHTML = modalHTML;
                document.body.appendChild(modalContainer);
                
                const modalElement = document.getElementById(`modalVer${id}`);
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
                
                modalElement.addEventListener('hidden.bs.modal', function() {
                    modalContainer.remove();
                });
            }
        }
        
        // Editar instrumento
// Editar instrumento - VERSIÓN SIMPLIFICADA Y SEGURA
// Editar instrumento - VERSIÓN COMPLETA QUE LLENA EL FORMULARIO
// Editar instrumento - VERSIÓN CON DEPURACIÓN DETALLADA
function editInstrument(id) {
    console.log("🔍 === INICIANDO editInstrument() ===");
    console.log("ID recibido:", id, "Tipo:", typeof id);
    
    try {
        // 1. Verificar que allInstruments existe
        console.log("1. allInstruments existe?", Array.isArray(allInstruments));
        console.log("2. Total instrumentos:", allInstruments ? allInstruments.length : "undefined");
        
        if (!allInstruments || !Array.isArray(allInstruments)) {
            throw new Error("allInstruments no es un array válido");
        }
        
        // 2. Buscar el instrumento
        console.log("3. Buscando instrumento con ID:", id);
        const instrument = allInstruments.find(i => {
            console.log("  Comparando:", i.id, "con", id, "tipo i.id:", typeof i.id);
            return i.id == id; // Usar == para comparar diferentes tipos (string vs number)
        });
        
        console.log("4. Instrumento encontrado:", instrument);
        
        if (!instrument) {
            console.error("❌ No se encontró instrumento con ID:", id);
            console.log("Lista de IDs disponibles:", allInstruments.map(i => i.id));
            throw new Error("Instrumento no encontrado con ID: " + id);
        }
        
        // 3. Verificar que el formulario existe
        console.log("5. Buscando formulario con ID 'formEditarInstrumento'");
        const form = document.getElementById('formEditarInstrumento');
        console.log("6. Formulario encontrado?", form !== null);
        
        if (!form) {
            throw new Error("No se encontró el formulario con ID 'formEditarInstrumento'");
        }
        
        // 4. Guardar el ID (VERIFICAR QUE EL ELEMENTO EXISTA)
        console.log("7. Buscando campo 'editId'");
        const editIdField = document.getElementById('editId');
        if (editIdField) {
            editIdField.value = id;
            console.log("8. Campo editId establecido a:", id);
        } else {
            console.warn("⚠️ No se encontró campo 'editId', continuando...");
        }
        
        // 5. Crear el HTML del formulario con cuidado
        console.log("9. Creando HTML del formulario...");
        
        // Asegurarnos de que los valores no sean undefined
        const nombre = instrument.nombre || '';
        const categoria = instrument.categoria || '';
        const estado = instrument.estado || 'DISPONIBLE';
        const ubicacion = instrument.ubicacion || '';
        const marca = instrument.marca || '';
        const modelo = instrument.modelo || '';
        const descripcion = instrument.descripcion || '';
        
        console.log("10. Valores a usar:");
        console.log("  - Nombre:", nombre);
        console.log("  - Categoría:", categoria);
        console.log("  - Estado:", estado);
        console.log("  - Ubicación:", ubicacion);
        
       const formHTML = `
    <input type="hidden" id="editId" value="${id}">
    <div class="row">
        <div class="col-md-6 mb-3">
            <label class="form-label">Nombre *</label>
            <input type="text" class="form-control" id="editNombre"
                   value="${nombre.replace(/"/g, '&quot;')}"
                   required>
        </div>
        <div class="col-md-6 mb-3">
            <label class="form-label">Categoría *</label>
            <input type="text" class="form-control" id="editCategoria"
                   value="${categoria.replace(/"/g, '&quot;')}"
                   required>
        </div>
    </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Nombre *</label>
                    <input type="text" class="form-control" id="editNombre" 
                           value="${nombre.replace(/"/g, '&quot;')}" 
                           required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Categoría *</label>
                    <input type="text" class="form-control" id="editCategoria" 
                           value="${categoria.replace(/"/g, '&quot;')}" 
                           required>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Estado *</label>
                    <select class="form-select" id="editEstado" required>
                        <option value="">Seleccionar estado</option>
                        <option value="DISPONIBLE" ${estado === 'DISPONIBLE' ? 'selected' : ''}>DISPONIBLE</option>
                        <option value="PRESTADO" ${estado === 'PRESTADO' ? 'selected' : ''}>PRESTADO</option>
                        <option value="MANTENIMIENTO" ${estado === 'MANTENIMIENTO' ? 'selected' : ''}>MANTENIMIENTO</option>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Ubicación *</label>
                    <input type="text" class="form-control" id="editUbicacion" 
                           value="${ubicacion.replace(/"/g, '&quot;')}" 
                           required>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Marca</label>
                    <input type="text" class="form-control" id="editMarca" 
                           value="${marca.replace(/"/g, '&quot;')}">
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Modelo/Serial</label>
                    <input type="text" class="form-control" id="editModelo" 
                           value="${modelo.replace(/"/g, '&quot;')}">
                </div>
            </div>
            <div class="mb-3">
                <label class="form-label">Descripción</label>
                <textarea class="form-control" id="editDescripcion" rows="3">${descripcion.replace(/"/g, '&quot;')}</textarea>
            </div>
            <div class="alert alert-info">
                <i class="bi bi-info-circle me-2"></i>
                Los campos marcados con * son obligatorios.
            </div>
        `;
        
        console.log("11. Insertando HTML en el formulario...");
        form.innerHTML = formHTML;
        console.log("✅ HTML insertado correctamente");
        
        // 6. Mostrar el modal
        console.log("12. Buscando modal con ID 'modalEditar'");
        const modalElement = document.getElementById('modalEditar');
        console.log("13. Modal encontrado?", modalElement !== null);
        
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            console.log("14. Mostrando modal...");
            modal.show();
            console.log("✅ Modal mostrado correctamente");
            
            // Limpiar el evento anterior y agregar nuevo
            modalElement.removeEventListener('shown.bs.modal', focusFirstField);
            function focusFirstField() {
                const nombreField = document.getElementById('editNombre');
                if (nombreField) {
                    nombreField.focus();
                    console.log("✅ Campo 'editNombre' enfocado");
                }
            }
            modalElement.addEventListener('shown.bs.modal', focusFirstField);
            
        } else {
            throw new Error("No se encontró el modal con ID 'modalEditar'");
        }
        
        console.log("🎉 === editInstrument() COMPLETADO CON ÉXITO ===");
        
    } catch (error) {
        console.error("💥 === ERROR EN editInstrument() ===");
        console.error("Mensaje:", error.message);
        console.error("Stack:", error.stack);
        console.error("Estado actual:");
        console.error("- allInstruments:", allInstruments);
        console.error("- ID buscado:", id);
        
        // Mostrar alerta más informativa
        showAlert(`Error al cargar el formulario: ${error.message}`, "danger");
    }
}

        
        // Actualizar instrumento con validación de roles
        // Actualizar instrumento - VERSIÓN CORREGIDA
// Actualizar instrumento - VERSIÓN SIMPLIFICADA
// Actualizar instrumento - VERSIÓN FUNCIONAL
async function actualizarInstrumento() {
    console.log("💾 actualizarInstrumento() llamada");
    
    const id = document.getElementById('editId').value;
    console.log("📝 ID a actualizar:", id);
    
    // Recoger todos los valores
    const instrumento = {
        nombre: document.getElementById('editNombre').value,
        categoria: document.getElementById('editCategoria').value,
        estado: document.getElementById('editEstado').value,
        ubicacion: document.getElementById('editUbicacion').value,
        descripcion: document.getElementById('editDescripcion').value || '',
        marca: document.getElementById('editMarca').value || '',
        modelo: document.getElementById('editModelo').value || ''
    };
    
    console.log("📦 Datos a enviar:", instrumento);
    
    // Validaciones
    if (!instrumento.nombre || !instrumento.categoria || !instrumento.estado || !instrumento.ubicacion) {
        showAlert("Por favor, completa todos los campos obligatorios", "warning");
        return;
    }
    
    if (currentUserRole === 'ASISTENTE' && instrumento.estado === 'MANTENIMIENTO') {
        showAlert("Los asistentes no pueden poner instrumentos en mantenimiento", "warning");
        return;
    }
    
    try {
        console.log(`📡 Enviando PUT a /api/instrumentos/${id}`);
        
        const response = await fetch(`/api/instrumentos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(instrumento)
        });
        
        console.log("📨 Status de respuesta:", response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log("✅ Respuesta del servidor:", data);
            
            // Cerrar modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('modalEditar'));
            modal.hide();
            
            // Mostrar mensaje de éxito
            showAlert("¡Instrumento actualizado correctamente!", "success");
            
            // Recargar datos después de 1 segundo
            setTimeout(() => {
                loadInstruments();
            }, 1000);
            
        } else {
            const errorData = await response.json().catch(() => ({}));
            console.error("❌ Error del servidor:", errorData);
            showAlert("Error: " + (errorData.error || "Error desconocido"), "danger");
        }
        
    } catch (error) {
        console.error("💥 Error en fetch:", error);
        showAlert("Error de conexión: " + error.message, "danger");
    }
}

        // Eliminar instrumento
        async function deleteInstrument(id) {
            if (!confirm('¿Estás seguro de eliminar este instrumento?')) return;
            
            try {
                const response = await fetch(`/api/instrumentos/${id}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    showAlert('Instrumento eliminado exitosamente', 'success');
                    loadInstruments();
                } else {
                    const error = await response.json();
                    throw new Error(error.error || 'Error al eliminar instrumento');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert(error.message || 'Error al eliminar instrumento', 'danger');
            }
        }
        
        // Importar Excel
        async function importarExcel() {
            const fileInput = document.getElementById('excelFile');
            if (!fileInput.files.length) {
                showAlert('Selecciona un archivo', 'warning');
                return;
            }
            
            const formData = new FormData();
            formData.append('excelFile', fileInput.files[0]);
            
            try {
                const response = await fetch('/cargar-instrumentos', {
                    method: 'POST',
                    body: formData
                });
                
                if (response.ok) {
                    showAlert('Archivo importado exitosamente', 'success');
                    const modal = bootstrap.Modal.getInstance(document.getElementById('modalImportar'));
                    modal.hide();
                    loadInstruments();
                } else {
                    throw new Error('Error al importar archivo');
                }
            } catch (error) {
                console.error('Error:', error);
                showAlert('Error al importar archivo', 'danger');
            }
        }
        
        // Descargar Excel
        function descargarExcel() {
            window.location.href = '/descargar-instrumentos';
        }
        
        // Refrescar tabla
        function refreshTable() {
            loadInstruments();
            showAlert('Datos actualizados', 'info');
        }
        
        // Mostrar alerta
        function showAlert(message, type) {
            const alertHTML = `
                <div class="alert alert-${type} alert-dismissible fade show position-fixed top-0 end-0 m-3" style="z-index: 9999;">
                    ${message}
                    <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
                </div>
            `;
            
            const alertContainer = document.createElement('div');
            alertContainer.innerHTML = alertHTML;
            document.body.appendChild(alertContainer);
            
            setTimeout(() => {
                alertContainer.remove();
            }, 5000);
        }
        
        // Ocultar botones de acciones según rol
        function ajustarInterfazPorRol() {
            const userRole = currentUserRole;
            
            if (userRole === 'AUDITOR') {
                const btnAgregar = document.querySelector('button[data-bs-target="#modalAgregar"]');
                const btnImportar = document.querySelector('button[data-bs-target="#modalImportar"]');
                const linkAgregar = document.querySelector('a[href="#modalAgregar"]');
                
                if (btnAgregar) btnAgregar.style.display = 'none';
                if (btnImportar) btnImportar.style.display = 'none';
                if (linkAgregar) linkAgregar.style.display = 'none';
                
                document.querySelectorAll('.btn-outline-danger').forEach(btn => {
                    btn.style.display = 'none';
                });
            } else if (userRole === 'ASISTENTE') {
                document.querySelectorAll('.btn-outline-danger').forEach(btn => {
                    btn.style.display = 'none';
                });
            }
        }
        
        // Ejecutar ajustes de interfaz
        setTimeout(ajustarInterfazPorRol, 1000);
    </script>
</body>
<!-- Botón de prueba MANUAL -->
<div style="position: fixed; top: 10px; right: 10px; z-index: 9999;">
    <button onclick="testEdit()" class="btn btn-success">
        <i class="bi bi-play-circle"></i> Probar Edición
    </button>
</div>

<script>
function testEdit() {
    console.log("=== PRUEBA MANUAL ===");
    
    // Verificar que la función existe
    console.log("editInstrument es función:", typeof editInstrument);
    
    // Llamar a la función con un ID de prueba
    if (allInstruments && allInstruments.length > 0) {
        editInstrument(allInstruments[0].id);
    } else {
        // Forzar una prueba
        editInstrument(1);
    }
}
</script>
</html>
```
9. **Escribe el  `login.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-5">
                <div class="card shadow">
                    <div class="card-body p-4">
                        <div class="text-center mb-4">
                            <i class="bi bi-heart-pulse text-primary" style="font-size: 3rem;"></i>
                            <h2 class="mt-3">Sistema Médico</h2>
                            <p class="text-muted">Inicia sesión en tu cuenta</p>
                        </div>
                        
                        <!-- Formulario login - IMPORTANTE: campos 'correo' y 'password' -->
                        <form action="/login" method="POST">
                            <div class="mb-3">
                                <label class="form-label">Correo Electrónico</label>
                                <input type="email" 
                                       class="form-control" 
                                       name="correo" 
                                       required
                                       placeholder="tu@correo.com">
                            </div>
                            
                            <div class="mb-4">
                                <label class="form-label">Contraseña</label>
                                <input type="password" 
                                       class="form-control" 
                                       name="password" 
                                       required
                                       placeholder="Tu contraseña">
                            </div>
                            
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary btn-lg">
                                    <i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión
                                </button>
                            </div>
                        </form>
                        
                        <div class="text-center mt-4">
                            <p class="mb-2">¿No tienes cuenta?</p>
                            <a href="/registro.html" class="btn btn-outline-primary">
                                <i class="bi bi-person-plus"></i> Regístrate aquí
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

```

10. **Escribe el  `navbar.html`**:

```
<nav class="navbar navbar-expand-lg navbar-dark bg-dark">
  <div class="container-fluid">
    <a class="navbar-brand" href="index.html">Laboratorio</a>

    <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
      data-bs-target="#navbarNav">
      <span class="navbar-toggler-icon"></span>
    </button>

    <div class="collapse navbar-collapse" id="navbarNav">
      <ul class="navbar-nav">

        <li class="nav-item">
          <a class="nav-link" href="login.html">Login</a>
        </li>

        <li class="nav-item">
          <a class="nav-link" href="instrumentos.html">Instrumentos (CRUD)</a>
        </li>

        <li class="nav-item">
          <a class="nav-link" href="busqueda.html">Búsqueda</a>
        </li>

      </ul>
    </div>
  </div>
</nav>

```

11. **Escribe el  `registro.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Registro</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-md-6 col-lg-5">
                <div class="card shadow">
                    <div class="card-header bg-primary text-white text-center py-3">
                        <h4><i class="bi bi-person-plus"></i> Registro de Usuario</h4>
                    </div>
                    <div class="card-body p-4">
                        <!-- SOLO UN FORMULARIO -->
                        <form action="/registro" method="POST">
                            <div class="mb-3">
                                <label class="form-label">Nombre Completo</label>
                                <input type="text" 
                                       class="form-control" 
                                       name="username" 
                                       required
                                       placeholder="Tu nombre">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Correo Electrónico</label>
                                <input type="email" 
                                       class="form-control" 
                                       name="correo" 
                                       required
                                       placeholder="ejemplo@correo.com">
                            </div>
                            
                            <div class="mb-3">
                                <label class="form-label">Contraseña</label>
                                <input type="password" 
                                       class="form-control" 
                                       name="password" 
                                       required
                                       placeholder="Mínimo 8 caracteres">
                            </div>
                            
                            <div class="mb-4">
                                <label class="form-label">Código de Acceso</label>
                                <input type="text" 
                                       class="form-control" 
                                       name="codigos_de_acceso" 
                                       required
                                       placeholder="Ej: ADMIN123, ASIS123, AUDI123">
                                <div class="form-text">
                                    Solicita tu código al administrador
                                </div>
                            </div>
                            
                            <div class="d-grid">
                                <button type="submit" class="btn btn-primary btn-lg">
                                    <i class="bi bi-check-circle"></i> Registrar
                                </button>
                            </div>
                        </form>
                        
                        <div class="text-center mt-4">
                            <p class="mb-0">¿Ya tienes cuenta?</p>
                            <a href="/login.html" class="btn btn-outline-secondary btn-sm mt-2">
                                <i class="bi bi-box-arrow-in-right"></i> Iniciar Sesión
                            </a>
                        </div>
                    </div>
                </div>
                
                <!-- Códigos de ejemplo -->
                <div class="card mt-3">
                    <div class="card-body">
                        <h6><i class="bi bi-key"></i> Códigos de prueba:</h6>
                        <div class="row text-center">
                            <div class="col-4">
                                <span class="badge bg-primary">ADMIN123</span>
                                <small class="d-block">Admin</small>
                            </div>
                            <div class="col-4">
                                <span class="badge bg-success">ASIS123</span>
                                <small class="d-block">Asistente</small>
                            </div>
                            <div class="col-4">
                                <span class="badge bg-warning">AUDI123</span>
                                <small class="d-block">Auditor</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>

```
12. **Escribe el  `layout.html`**:

```
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><%= title %> - Sistema Médico</title>
    
    <!-- Bootstrap 5 -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css">
    
    <!-- CSS Personalizado -->
    <link rel="stylesheet" href="/css/styles.css">
    
    <!-- Favicon -->
    <link rel="icon" type="image/x-icon" href="/img/favicon.ico">
</head>
<body>
    <!-- Navbar -->
    <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
        <div class="container">
            <a class="navbar-brand" href="/">
                <i class="bi bi-heart-pulse"></i> Sistema Médico
            </a>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navbarNav">
                <ul class="navbar-nav ms-auto">
                    <li class="nav-item">
                        <a class="nav-link" href="/"><i class="bi bi-house"></i> Inicio</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/login.html"><i class="bi bi-box-arrow-in-right"></i> Login</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/registro.html"><i class="bi bi-person-plus"></i> Registro</a>
                    </li>
                </ul>
            </div>
        </div>
    </nav>

    <!-- Contenido Principal -->
    <main class="container my-5">
        <%- body %>
    </main>

    <!-- Footer -->
    <footer class="bg-dark text-white py-4 mt-5">
        <div class="container text-center">
            <p class="mb-0">&copy; 2024 Sistema Médico. Todos los derechos reservados.</p>
        </div>
    </footer>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- Scripts personalizados -->
    <script src="/js/app.js"></script>
</body>
</html>
```
12. **Escribe en `instrumentos.xlsx`**:

```
<�e��ޖ����1�Zޖ�f����*'

```
13. **Escribe en `styles.css`**:

```
body {
    background: #f4f4f4;
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 0;
}

.container {
    width: 90%;
    max-width: 800px;
    margin: 40px auto;
    background: white;
    padding: 30px;
    border-radius: 8px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
}

h1, h2, h3, h4 {
    text-align: center;
}

button, input[type="submit"] {
    background-color: #007bff;
    color: white;
    padding: 10px 18px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
}

button:hover, input[type="submit"]:hover {
    background-color: #0056b3;
}

input, select {
    width: 100%;
    padding: 8px;
    margin-top: 8px;
    margin-bottom: 16px;
    border: 1px solid #ccc;
    border-radius: 5px;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 20px;
}

th, td {
    border: 1px solid #ddd;
    padding: 10px;
}

th {
    background-color: #007bff;
    color: white;
}

```
14. **Instalar `bootstrap`**:
instala dependencia y agrega en tu `server.js` y `index` lo siguiente:

```
npm i bootstrap@5.3.8

```
```
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

```
```
<!-- Bootstrap CSS -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- Bootstrap JS (opcional, para modales, dropdowns, etc.) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>

```
15. Disfruta**
