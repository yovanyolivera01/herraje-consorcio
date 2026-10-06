# Certificado HTTPS de desarrollo

`navigator.mediaDevices.getUserMedia()` (la cámara — usada por `ModalCara`
para capturar el rostro con face-api.js) solo existe en un **contexto
seguro**: `https://` o `http://localhost`. Si abres la app desde la IP de
LAN (p.ej. `http://192.168.0.240:5173`), el navegador ni siquiera expone
`navigator.mediaDevices` — por eso la cámara falla ahí aunque en
`localhost` funcione.

Este folder resuelve eso con un certificado autofirmado para desarrollo,
usado solo por `npm run dev` (nunca en producción).

## Generar / regenerar el certificado

```bash
bash certs/generate-dev-cert.sh
```

Detecta las IPs de este equipo automáticamente e incluye `localhost` +
`127.0.0.1`. Vuelve a correrlo si cambias de red (tu IP de LAN cambió) y
el navegador empieza a rechazar el certificado.

## Uso

HTTPS es **opt-in**, no el default — `npm run dev` normal sigue sirviendo
por HTTP (así es como corren los tests de Playwright y el flujo de
trabajo normal). Solo actívalo cuando necesites probar la cámara desde
otro dispositivo en la LAN:

```bash
VITE_USE_HTTPS=true npm run dev
```

Y abre `https://<tu-ip>:5173` desde ese dispositivo. La primera vez el
navegador muestra una advertencia de "sitio no seguro" (es un certificado
autofirmado, no uno de una autoridad reconocida): acepta/continúa para
confiar en él en ese dispositivo.

En `http://localhost:5173` (sin HTTPS) la cámara ya funciona normal —
"contexto seguro" incluye `localhost` por definición del navegador. Solo
hace falta HTTPS para abrir la app desde una IP de LAN.

## Nunca subir `.pem` al repo

Los `.pem` (certificado + llave privada) están en `.gitignore`. Son
específicos de esta máquina/red — cada quien genera los suyos.
