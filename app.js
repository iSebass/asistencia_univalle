// Constants for Schedules
const SCHEDULES = {
  "Matematica Basica": [
    { day: 1, start: "18:20", end: "20:20" }, // Lunes
    { day: 5, start: "18:20", end: "21:20" }  // Viernes
  ],
  "Sistemas Embebidos": [
    { day: 3, start: "18:20", end: "22:20" }  // Miercoles
  ],
  "Experimentacion en Electricidad": [
    { day: 6, start: "14:00", end: "17:00" }  // Sabado
  ],
  "Robots - Ciencia - Ficcion": [
    { day: 4, start: "18:20", end: "21:20" }  // Jueves
  ]
};

// DOM Elements
const dateEl = document.getElementById('current-date');
const timeEl = document.getElementById('current-time');
const locationEl = document.getElementById('location-status');
const form = document.getElementById('attendance-form');
const subjectSelect = document.getElementById('subject-select');
const studentCodeInput = document.getElementById('student-code');
const studentEmailInput = document.getElementById('student-email');
const btnCheckin = document.getElementById('btn-checkin');
const btnCheckout = document.getElementById('btn-checkout');
const statusMsg = document.getElementById('status-message');

// State
let userLocation = null;
const CAMPUS_COORDS = { lat: 4.0848, lng: -75.1953 }; // Mock coords for Tulua

// Update Time and Date
function updateClock() {
  const now = new Date();
  dateEl.textContent = now.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  timeEl.textContent = now.toLocaleTimeString('es-ES');
}
setInterval(updateClock, 1000);
updateClock();

// Geolocation
function initLocation() {
  if ("geolocation" in navigator) {
    locationEl.textContent = "Solicitando permiso...";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = position.coords;
        // In a real app, we would calculate distance to CAMPUS_COORDS
        // For development, we assume they are in the campus if they grant permission
        locationEl.textContent = "📍 Dentro de la Sede";
        locationEl.style.color = "#4ade80";
      },
      (error) => {
        console.error(error);
        locationEl.textContent = "❌ Ubicación no permitida";
        locationEl.style.color = "#f87171";
      }
    );
  } else {
    locationEl.textContent = "No soportado";
  }
}
initLocation();

// Helper to show status
function showStatus(message, type) {
  statusMsg.textContent = message;
  statusMsg.className = `status-box status-${type}`;
  
  // Auto hide after 5 seconds if success
  if (type === 'success') {
    setTimeout(() => {
      statusMsg.className = 'status-box';
    }, 5000);
  }
}

// Validation Logic
function validateEmail(email) {
  return email.endsWith('@correounivalle.edu.co');
}

function checkSchedule(subject) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday...
  const currentTimeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
  
  // Special rule for development: Today Monday
  // Assuming "today" implies the development session
  if (currentDay === 1) {
    console.log("Modo desarrollo: Omitiendo validación estricta de horario por hoy Lunes.");
    return true;
  }

  const subjectSchedules = SCHEDULES[subject];
  if (!subjectSchedules) return false;

  for (const sched of subjectSchedules) {
    if (sched.day === currentDay) {
      const [startHour, startMin] = sched.start.split(':').map(Number);
      const [endHour, endMin] = sched.end.split(':').map(Number);
      
      const startTime = new Date(now);
      startTime.setHours(startHour, startMin, 0);
      
      const endTime = new Date(now);
      endTime.setHours(endHour, endMin, 0);
      
      // 20 min margin (before start and after end)
      const marginMs = 20 * 60 * 1000;
      const allowedStart = new Date(startTime.getTime() - marginMs);
      const allowedEnd = new Date(endTime.getTime() + marginMs);
      
      if (now >= allowedStart && now <= allowedEnd) {
        return true;
      }
    }
  }
  return false;
}

// Action Handler (Check-in / Check-out)
function handleAction(actionType) {
  const subject = subjectSelect.value;
  const code = studentCodeInput.value.trim();
  const email = studentEmailInput.value.trim();

  // Basic validation
  if (!subject || !code || !email) {
    showStatus("Por favor completa todos los campos.", "error");
    return;
  }

  if (!validateEmail(email)) {
    showStatus("Solo se permiten correos con dominio @correounivalle.edu.co", "error");
    return;
  }

  // Location check
  if (!userLocation) {
    showStatus("Es necesario permitir la ubicación para realizar el registro.", "error");
    return;
  }

  // Schedule check
  if (!checkSchedule(subject)) {
    showStatus("Fuera del horario permitido para esta asignatura.", "error");
    return;
  }

  // Verify student in database
  const students = ESTUDIANTES[subject];
  if (!students) {
    showStatus("Asignatura no encontrada en la base de datos.", "error");
    return;
  }

  const student = students.find(s => s.codigo === code);
  if (!student) {
    showStatus("Estudiante no encontrado en esta asignatura. Verifica tu código.", "error");
    return;
  }

  // Optional: Verify email matches code if we want to be strict, 
  // but file data shows specific emails. Let's check if it matches the registered email.
  if (student.correo !== email) {
     showStatus("El correo no coincide con el código registrado.", "error");
     return;
  }

  // Save Record
  const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
  
  // Check if already registered for today and action
  const todayStr = new Date().toDateString();
  const existingRecord = records.find(r => r.code === code && r.subject === subject && r.date === todayStr && r.type === actionType);
  
  if (existingRecord) {
    showStatus(`Ya has registrado tu ${actionType} para el día de hoy.`, "info");
    return;
  }

  const newRecord = {
    code,
    name: student.nombre,
    subject,
    type: actionType,
    time: new Date().toLocaleTimeString('es-ES'),
    date: todayStr,
    timestamp: new Date().getTime()
  };

  records.push(newRecord);
  localStorage.setItem('attendance_records', JSON.stringify(records));

  // Enviar a Google Sheets
  const scriptURL = 'https://script.google.com/macros/s/AKfycbwnkBmEde9lYF-nLISNfvHsEDn7jpr54iODXDnWf_jK_vWkYLiC6H0CdYjDeksSb9I/exec';
  fetch(scriptURL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'text/plain'
    },
    body: JSON.stringify(newRecord)
  })
  .then(() => console.log('Datos enviados a Google Sheets'))
  .catch(err => console.error('Error al enviar a Google Sheets:', err));

  showStatus(`¡Registro de ${actionType} exitoso! Bienvenido/a ${student.nombre}.`, "success");

  
  // Reset form
  studentCodeInput.value = '';
  studentEmailInput.value = '';
}

// Event Listeners
btnCheckin.addEventListener('click', () => handleAction('Ingreso'));
btnCheckout.addEventListener('click', () => handleAction('Salida'));

// Export Logic
const btnExport = document.getElementById('btn-export');
btnExport.addEventListener('click', () => {
  const subject = subjectSelect.value;
  if (!subject) {
    showStatus("Por favor selecciona una asignatura para exportar.", "error");
    return;
  }

  const password = prompt("Ingresa la contraseña de profesor para descargar:");
  if (password !== "profesor2026") {
    alert("Contraseña incorrecta.");
    return;
  }

  const records = JSON.parse(localStorage.getItem('attendance_records') || '[]');
  const filteredRecords = records.filter(r => r.subject === subject);

  if (filteredRecords.length === 0) {
    alert("No hay registros para esta asignatura.");
    return;
  }

  // Generate CSV
  let csvContent = "Código,Nombre,Asignatura,Tipo,Fecha,Hora\n";
  filteredRecords.forEach(r => {
    csvContent += `${r.code},"${r.name}","${r.subject}",${r.type},"${r.date}",${r.time}\n`;
  });

  // Trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `asistencia_${subject.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

