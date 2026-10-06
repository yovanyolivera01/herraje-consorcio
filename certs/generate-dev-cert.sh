#!/usr/bin/env bash
# Genera un certificado HTTPS autofirmado para el servidor de desarrollo
# de Vite (localhost + tu IP de LAN/Tailscale actual). Es necesario porque
# los navegadores solo exponen navigator.mediaDevices.getUserMedia() (la
# cámara, usada por ModalCara / face-api.js) en un "contexto seguro":
# https:// o http://localhost — nunca en una IP de LAN por HTTP plano.
#
# Uso: bash certs/generate-dev-cert.sh [IP_EXTRA...]
#   Sin argumentos, detecta las IPs de este equipo automáticamente.
#   Vuelve a correrlo si cambias de red (la IP de LAN cambió) y el
#   navegador empieza a rechazar el certificado.
#
# Requiere openssl (ya viene con Git Bash en Windows).

set -e
cd "$(dirname "$0")"

if [ "$#" -gt 0 ]; then
  IPS=("$@")
else
  # IPv4 no-loopback de este equipo (Windows, vía PowerShell)
  IPS=($(powershell.exe -NoProfile -Command \
    "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.IPAddress -notlike '169.254.*' -and \$_.IPAddress -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddress" \
    2>/dev/null | tr -d '\r'))
fi

{
  echo "[req]"
  echo "distinguished_name = req_distinguished_name"
  echo "x509_extensions = v3_req"
  echo "prompt = no"
  echo
  echo "[req_distinguished_name]"
  echo "CN = herraje-consorcio-dev"
  echo
  echo "[v3_req]"
  echo "keyUsage = keyEncipherment, dataEncipherment, digitalSignature"
  echo "extendedKeyUsage = serverAuth"
  echo "subjectAltName = @alt_names"
  echo
  echo "[alt_names]"
  echo "DNS.1 = localhost"
  echo "IP.1 = 127.0.0.1"
  i=2
  for ip in "${IPS[@]}"; do
    echo "IP.$i = $ip"
    i=$((i + 1))
  done
} > san.cnf

openssl req -x509 -newkey rsa:2048 -keyout dev-key.pem -out dev-cert.pem \
  -days 825 -nodes -config san.cnf -extensions v3_req

rm -f san.cnf

echo
echo "Certificado generado para: localhost, 127.0.0.1, ${IPS[*]}"
echo "Reinicia 'npm run dev' y abre https://<tu-ip>:5173 — el navegador"
echo "mostrará una advertencia de 'sitio no seguro' la primera vez (es un"
echo "certificado autofirmado): acepta/continúa para confiar en él."
