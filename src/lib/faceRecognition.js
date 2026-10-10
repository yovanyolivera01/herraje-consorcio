// Lógica de reconocimiento facial — separada de los componentes de cámara
// (modalCara.jsx captura y guarda; modalReconocimiento.jsx usa este archivo
// para identificar QUIÉN es la persona frente a la cámara). Sin JSX, para
// poder probarla o reusarla sin arrastrar componentes de React.
import * as faceapi from 'face-api.js'

// Distancia euclidiana entre dos descriptores (128 floats de face-api.js).
// < UMBRAL_RECONOCIMIENTO ⇒ se asume la misma persona. 0.5 es más estricto
// que el 0.6 que suele recomendarse — preferible pedir que reintenten a
// marcar la asistencia de alguien más por una coincidencia floja.
export const UMBRAL_RECONOCIMIENTO = 0.5

// empleados.cara se guarda como texto (JSON.stringify de un array de 128
// floats) — ver sp_actualizar_cara_empleado. Devuelve null si el empleado
// no tiene rostro capturado o el texto está corrupto, en vez de tronar.
export function parsearDescriptor(cara) {
    if (!cara) return null
    try {
        const arr = JSON.parse(cara)
        if (!Array.isArray(arr) || arr.length !== 128) return null
        return new Float32Array(arr)
    } catch {
        return null
    }
}

// Encuentra el empleado más parecido SIN filtrar por umbral — útil para
// diagnosticar un "no reconocido": saber qué tan cerca estuvo (0.52 vs 0.5
// es un problema de umbral/iluminación; 0.9 es que de verdad no hay match).
export function mejorCoincidencia(descriptor, empleados) {
    let mejor = null

    for (const empleado of empleados) {
        const referencia = parsearDescriptor(empleado.cara)
        if (!referencia) continue

        const distancia = faceapi.euclideanDistance(descriptor, referencia)
        if (!mejor || distancia < mejor.distancia) {
            mejor = { empleado, distancia }
        }
    }

    return mejor
}

// Compara un descriptor recién capturado contra la lista de empleados y
// regresa el más parecido, si su distancia está dentro del umbral.
// empleados: filas de v_empleados (o cualquier objeto con .cara y datos del
// empleado). Ignora a quienes no tienen cara capturada.
export function reconocerEmpleado(descriptor, empleados, umbral = UMBRAL_RECONOCIMIENTO) {
    const mejor = mejorCoincidencia(descriptor, empleados)
    if (!mejor || mejor.distancia > umbral) return null
    return mejor
}
