# Víveres Stalin - Sistema Web POS

Sistema de Punto de Venta (POS), Facturación, Control de Inventario, Fiados y Tienda en Línea para **Víveres Stalin**.

## Características
- **Punto de Venta (POS):** Cobro rápido, búsqueda de productos por código de barras o teclado, cálculo de vuelto e impresión térmica de tickets de 80mm.
- **Tienda en Línea para Clientes:** Catálogo digital, carrito de compras, selección de forma de pago (Efectivo o Transferencia) y temporizador de recogida.
- **Gestión de Fiados:** Control de cuentas corrientes, abonos y ventas a crédito.
- **Inventario:** Entradas de reposición y ajustes de stock.
- **Turnos de Caja:** Apertura, cuadre y cierre de turno.

## Tecnologías
- **Frontend:** React + Vite + Tailwind CSS + React Router.
- **Backend API:** Django REST Framework + Supabase PostgreSQL.

## Configuración Local
1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Crear archivo `.env` a partir de `.env.example`:
   ```env
   VITE_API_URL=http://127.0.0.1:8000/api
   ```
3. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```

## Despliegue en Vercel
1. Conectar el repositorio de GitHub en Vercel.
2. Configurar la variable de entorno en Vercel:
   - `VITE_API_URL`: URL del backend desplegado.
3. El archivo `vercel.json` se encarga de gestionar el routing SPA de React.
