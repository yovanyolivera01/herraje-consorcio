import { useState, useEffect, useRef } from "react"
import * as faceapi from "face-api.js"
import { reconocerEmpleado } from "../lib/faceRecognition"
import { registrarAsistenciaAutomatica } from "../lib/registro"

// Mismos pesos que modalCara.jsx — ver ese archivo para dónde conseguirlos
// (public/models, no vienen incluidos en el paquete npm de face-api.js).
const MODELS_URL = '/models'
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })

let modelosPromise = null
function cargarModelos() {
    if (!modelosPromise) {
        modelosPromise = Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
        ])
    }
    return modelosPromise
}

// Cuántos ticks seguidos (300ms cada uno) tiene que verse un rostro estable
// antes de intentar reconocerlo — evita disparar el reconocimiento con un
// frame borroso de alguien que solo está pasando frente a la cámara.
const TICKS_PARA_RECONOCER = 3

// Modal de reconocimiento automático: abre la cámara, y en cuanto detecta
// un rostro estable intenta identificar DE QUIÉN es comparándolo contra los
// descriptores ya guardados (empleados.cara) — a diferencia de modalCara.jsx,
// que solo captura y guarda el rostro de un empleado ya elegido a mano, este
// componente es el que decide "quién es" sin que el usuario se seleccione.
// En cuanto reconoce a alguien, YA marca su asistencia (registrarAsistenciaAutomatica):
// la primera vez del día usa sp_registro (POST /registro, entrada), la
// segunda usa sp_update_registro (PUT /registro/:id, salida) — no hace
// falta un click aparte para confirmar, ya se identificó frente a la cámara.
// onReconocido(empleado, accion) se dispara ya con la asistencia marcada;
// el padre solo necesita enterarse de qué pasó (p.ej. para refrescar su UI).
export default function ModalReconocimiento({ empleados, onClose, onReconocido }) {
    const videoRef  = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const loopRef   = useRef(null)
    const ticksRef  = useRef(0)
    const procesandoRef = useRef(false) // evita relanzar el reconocimiento mientras uno ya está en curso

    // cargando | camara | reconociendo | registrado | no_reconocido | error
    const [estado, setEstado]   = useState('cargando')
    const [error, setError]     = useState(null)
    const [resultado, setResultado] = useState(null) // { empleado, distancia, accion }

    const detener = () => {
        clearInterval(loopRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }

    const iniciarCamara = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        streamRef.current = stream
        if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play?.().catch(() => {})
        }
        ticksRef.current = 0
        procesandoRef.current = false
        setResultado(null)
        setEstado('camara')
    }

    useEffect(() => {
        let cancelado = false

        async function iniciar() {
            try {
                await cargarModelos()
                if (cancelado) return
                await iniciarCamara()
            } catch (e) {
                if (!cancelado) {
                    setError(
                        e.name === 'NotAllowedError'
                            ? 'Se necesita permiso de la cámara para reconocer el rostro'
                            : `No se pudo iniciar la cámara o los modelos: ${e.message}`
                    )
                    setEstado('error')
                }
            }
        }
        iniciar()

        return () => {
            cancelado = true
            detener()
        }
    }, [])

    // Bucle de detección en vivo, igual que en modalCara.jsx, pero aquí
    // cuenta cuántos ticks seguidos hay un rostro visible y, al llegar al
    // umbral, dispara el reconocimiento automáticamente — sin botón.
    useEffect(() => {
        if (estado !== 'camara') return

        loopRef.current = setInterval(async () => {
            const video = videoRef.current
            if (!video || video.readyState < 2 || video.videoWidth === 0 || procesandoRef.current) return

            try {
                const deteccion = await faceapi.detectSingleFace(video, DETECTOR_OPTIONS).withFaceLandmarks()
                dibujarDeteccion(deteccion, video)

                if (deteccion) {
                    ticksRef.current += 1
                    if (ticksRef.current >= TICKS_PARA_RECONOCER) {
                        procesandoRef.current = true
                        await reconocer()
                    }
                } else {
                    ticksRef.current = 0
                }
            } catch {
                // frame transitorio inválido — se ignora, el siguiente tick reintenta
            }
        }, 300)

        return () => clearInterval(loopRef.current)
    }, [estado])

    const dibujarDeteccion = (deteccion, video) => {
        const canvas = canvasRef.current
        if (!canvas) return
        canvas.width = video.clientWidth
        canvas.height = video.clientHeight
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        if (!deteccion) return

        const dims = faceapi.matchDimensions(canvas, { width: video.clientWidth, height: video.clientHeight }, true)
        const resized = faceapi.resizeResults(deteccion, dims)
        faceapi.draw.drawDetections(canvas, resized)
        faceapi.draw.drawFaceLandmarks(canvas, resized)
    }

    const reconocer = async () => {
        clearInterval(loopRef.current)
        setEstado('reconociendo')
        setError(null)
        try {
            const deteccion = await faceapi
                .detectSingleFace(videoRef.current, DETECTOR_OPTIONS)
                .withFaceLandmarks()
                .withFaceDescriptor()

            if (!deteccion) {
                // se perdió el rostro justo al capturar el descriptor completo
                ticksRef.current = 0
                procesandoRef.current = false
                setEstado('camara')
                return
            }

            const match = reconocerEmpleado(deteccion.descriptor, empleados)
            detener()
            if (!match) {
                setEstado('no_reconocido')
                return
            }

            // Ya se identificó a la persona — se marca su asistencia de una,
            // sin pedir confirmación aparte: primera vez del día = entrada
            // (sp_registro), segunda vez = salida (sp_update_registro).
            try {
                const { accion } = await registrarAsistenciaAutomatica(
                    match.empleado.empleado_id, match.empleado.id_turno
                )
                setResultado({ ...match, accion })
                setEstado('registrado')
                onReconocido(match.empleado, accion)
            } catch (e) {
                setError(`Se reconoció a ${match.empleado.nombre} pero no se pudo registrar: ${e.message}`)
                setEstado('camara')
                procesandoRef.current = false
            }
        } catch (e) {
            setError(`Error al reconocer el rostro: ${e.message}`)
            setEstado('camara')
            procesandoRef.current = false
        }
    }

    const handleReintentar = async () => {
        setError(null)
        setEstado('cargando')
        try {
            await iniciarCamara()
        } catch (e) {
            setError(`No se pudo reiniciar la cámara: ${e.message}`)
            setEstado('error')
        }
    }

    const handleClose = () => {
        detener()
        onClose()
    }

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && handleClose()}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Reconocer rostro</h2>
                    <button className="btn-icon" onClick={handleClose}>✕</button>
                </div>

                <div className="modal-body">
                    {estado === 'cargando' && (
                        <p style={{ color: 'var(--text-muted)' }}>Cargando cámara y modelos...</p>
                    )}

                    {/* Igual que en modalCara.jsx: el <video> se monta siempre para que
                        la ref ya exista cuando llega el stream — solo se oculta con CSS. */}
                    <div
                        style={{
                            display: (estado === 'camara' || estado === 'reconociendo') ? 'flex' : 'none',
                            flexDirection: 'column', gap: 10, alignItems: 'center',
                        }}
                    >
                        <div style={{ position: 'relative', width: '100%', maxWidth: 360 }}>
                            <video
                                ref={videoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{ width: '100%', borderRadius: 8, transform: 'scaleX(-1)', display: 'block' }}
                            />
                            <canvas
                                ref={canvasRef}
                                style={{
                                    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                                    transform: 'scaleX(-1)', pointerEvents: 'none',
                                }}
                            />
                        </div>
                        <span className="badge badge-gray">
                            {estado === 'reconociendo' ? 'Reconociendo...' : 'Centra tu rostro frente a la cámara'}
                        </span>
                    </div>

                    {estado === 'registrado' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <span className="badge badge-green">
                                {resultado.accion === 'entrada' ? `✅ Entrada registrada: ${resultado.empleado.nombre}`
                                    : resultado.accion === 'salida' ? `✅ Salida registrada: ${resultado.empleado.nombre}`
                                    : `${resultado.empleado.nombre} ya registró su entrada y salida hoy`}
                            </span>
                        </div>
                    )}

                    {estado === 'no_reconocido' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                            <span className="badge badge-red">❌ No se reconoció ningún empleado registrado</span>
                        </div>
                    )}

                    {error && <div className="form-error" style={{ marginTop: 10 }}>❌ {error}</div>}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-outline" onClick={handleClose}>
                        {estado === 'registrado' ? 'Cerrar' : 'Cancelar'}
                    </button>

                    {estado === 'no_reconocido' && (
                        <button type="button" className="btn btn-primary" onClick={handleReintentar}>
                            Reintentar
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
