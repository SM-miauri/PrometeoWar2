# Bosque en Guerra (servidor)

Juego multijugador para jugar con amigos desde cualquier celular o compu, sin cuentas.

## Probarlo en tu compu
1. Instalá Node.js (versión 18 o más).
2. En esta carpeta: `npm install` y después `npm start`.
3. Abrí http://localhost:3000 en dos pestañas para ver a los dos jugadores.

## Publicarlo gratis en Render
1. Creá un repositorio nuevo en GitHub y subí estos archivos manteniendo la estructura:
   `package.json`, `server.js` y la carpeta `public` con `index.html` adentro.
2. En render.com: New → Web Service → conectá ese repositorio.
3. Configuración: Runtime **Node**, Build Command `npm install`, Start Command `npm start`, plan **Free**.
4. Cuando termine de desplegar, Render te da una URL (https://algo.onrender.com). Esa es la que le pasás a tus amigos.

Nota: el plan gratis se duerme si nadie juega por un rato. La primera vez que alguien entra puede tardar cerca de 1 minuto en despertar. Abrí el link antes de juntarse a jugar.

## Ajustes rápidos (en server.js)
- Daño de armas: `WEAP_DMG`. Defensa: `ARM_RED`.
- Duración del equipo: `GEAR_MS` (30000 = 30 s). Reaparición de ítems: `ITEM_RESPAWN_MS`.
- Velocidad de ataque: `ATK_CD`. Alcance: `RANGE`.
- Velocidad de movimiento: `SPD` en public/index.html.
