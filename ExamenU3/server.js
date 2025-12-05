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