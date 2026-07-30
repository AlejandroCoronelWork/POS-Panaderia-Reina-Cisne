# Reina del Cisne POS 🥖📊

Un sistema de Punto de Venta (POS) web diseñado a medida para la gestión operativa, control de inventario y auditoría financiera de un negocio minorista (Panadería). Construido con una arquitectura Serverless utilizando Firebase, optimizado para alta concurrencia y despliegue rápido.

## 🚀 Características Principales

### 🛒 Módulo de Ventas e Inventario (Tiempo Real)
* **Control Atómico de Stock:** Deducción de inventario mediante transacciones atómicas (`increment`) para prevenir condiciones de carrera (race conditions) en escenarios de múltiples cajeros.
* **Reactividad UI:** Integración de Firebase `onSnapshot` para refrescar el catálogo de productos y estados ("Agotado") instantáneamente en todos los dispositivos conectados, sin necesidad de recargar la página.
* **Gestión de Créditos (Fiados):** Flujo especializado para registrar y descontar stock de cuentas por cobrar.

### 💰 Control de Caja y Finanzas
* **Apertura Estricta de Turno:** Barrera de autenticación que exige el registro del fondo de caja (Cash Float) inicial antes de habilitar el terminal de ventas.
* **Dashboard Financiero:** Cálculo en tiempo real de ingresos por ventas y efectivo físico esperado en caja.
* **Corte Z (Cierre de Caja):** Flujo de cierre de jornada que congela transacciones, bloquea el POS para evitar ventas fuera de horario y genera un resumen de la sesión.

### 🔐 Seguridad y Auditoría
* **Forzado de Credenciales:** Políticas de seguridad que exigen el cambio obligatorio de contraseña temporal en el primer inicio de sesión del empleado.
* **Trazabilidad IP:** Captura silenciosa de la IP pública (vía API de ipify) en cada transacción procesada para auditorías internas de seguridad.
* **Protección de Rutas (DOM):** Ocultamiento estructural de vistas protegidas hasta la resolución y validación del token de Firebase Auth.
* **Auditoría de Horarios:** Motor analítico que procesa el arreglo de transacciones del día para determinar la primera y última venta de cada usuario, generando un "Horario Activo" real por empleado.

### 🎨 UI/UX y Exportación
* **Tema "Premium Bakery":** Interfaz de usuario diseñada con colores cálidos (crema/café) y sombras suaves, eliminando el blanco puro para reducir la fatiga visual de los operadores durante turnos largos.
* **Reportes PDF Inteligentes:** Exportación de historial de ventas mediante `jsPDF-autotable`, configurado para excluir campos de auditoría interna (como direcciones IP) en los reportes públicos o contables.

## 🛠️ Stack Tecnológico
* **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES6+).
* **UI Framework:** Bootstrap 5 (Componentes, Modales, Sistema de Rejilla).
* **Backend as a Service (BaaS):** Firebase SDK Modular (Authentication, Cloud Firestore).
* **Librerías Externas:** `jsPDF`, `jsPDF-autotable` (Generación de reportes), API REST `ipify` (Trazabilidad).

## ⚙️ Configuración y Despliegue

1. Clona el repositorio:
   git clone https://github.com/tu-usuario/reina-del-cisne-pos.git

2. Reemplaza el objeto firebaseConfig en tu archivo de inicialización con las credenciales de tu proyecto de Firebase.
3. Asegúrate de habilitar Email/Password Authentication y crear las colecciones productos, ventas, caja_diaria y usuarios en Firestore.
4. Despliega usando Firebase Hosting (opcional):
   firebase deploy

---
Desarrollado para optimizar los procesos de Panadería Reina del Cisne.