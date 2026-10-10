import { useState, useEffect, useRef } from "react"
import * as faceapi from "face-api.js"

// Los pesos de los modelos de face-api.js NO vienen incluidos en el paquete
// npm (solo el código JS) — hay que colocarlos manualmente en public/models
// para que este componente funcione. Se necesitan, del repo oficial
// https://github.com/justadudewhohacks/face-api.js-models:
//   tiny_face_detector_model-*
//   face_landmark_68_model-*
//   face_recognition_model-*
const MODELS_URL = '/models'

// scoreThreshold más bajo que el default (0.5) — el detector "tiny" es
// menos preciso y con una webcam de escritorio conviene ser más tolerante;
// mejor mostrar el recuadro un poco antes que dejar al usuario sin feedback.
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 })

// Umbral de confianza exigido para PERMITIR GUARDAR (más estricto que el 0.4
// de arriba, que solo sirve para dibujar el recuadro en vivo). Guardar una
// cara borrosa/mal iluminada con score bajo arruina el reconocimiento
// futuro de ese empleado — mejor pedir que reintente aquí que descubrirlo
// después en el kiosco.
const MIN_SCORE_GUARDAR = 0.5

// Si se captura la cara de un empleado y luego se abre el modal para OTRO
// de inmediato, el stream del primero se detuvo hace apenas instantes — el
// driver/OS de la cámara puede tardar un poco en liberarla y getUserMedia
// falla con NotReadableError/AbortError aunque el permiso ya esté dado.
// Sin reintento eso se veía como "no detecta la cámara con otro empleado".
async function abrirCamaraConReintento(intentos = 3) {
    // Fuera de HTTPS/localhost el navegador oculta navigator.mediaDevices
    // por completo (p.ej. al abrir http://100.91.211.64:3001) — sin esta
    // validación el error era un críptico "Cannot read properties of undefined".
    if (!navigator.mediaDevices?.getUserMedia) {
        const e = new Error('El navegador bloquea la cámara en conexiones no seguras. Abre la app desde HTTPS o desde localhost.')
        e.name = 'InsecureContext'
        throw e
    }
    for (let i = 0; i < intentos; i++) {
        try {
            return await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            })
        } catch (e) {
            const transitorio = e.name === 'NotReadableError' || e.name === 'AbortError' || e.name === 'TrackStartError'
            if (!transitorio || i === intentos - 1) throw e
            await new Promise(r => setTimeout(r, 400))
        }
    }
}

let modelosPromise = null
// Carga los modelos una sola vez aunque el modal se abra varias veces.
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

// Modal para capturar el rostro de un empleado con la cámara y obtener su
// descriptor facial (128 floats de face-api.js). onSave recibe el descriptor
// ya serializado como JSON string, listo para updateEmpleadoCara(id, cara).
export default function ModalCara({ empleado, onClose, onSave }) {
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const streamRef = useRef(null)
    const loopRef = useRef(null) // id del setInterval de detección en vivo

    const [estado, setEstado] = useState('cargando') // cargando | camara | detectando | capturado | error
    const [rostroVisible, setRostroVisible] = useState(false) // hay un rostro detectado AHORA en el video
    const [error, setError] = useState(null)
    const [descriptor, setDescriptor] = useState(null)
    const [loading, setLoading] = useState(false)

    const canceladoRef = useRef(false) // el modal se desmontó mientras la cámara arrancaba

    const iniciarCamara = async () => {
        const stream = await abrirCamaraConReintento()
        // En StrictMode (dev) el efecto corre dos veces: si el primer montaje
        // ya fue limpiado cuando getUserMedia responde, ese stream quedaba
        // huérfano con la cámara abierta y el segundo intento fallaba con
        // NotReadableError ("la cámara no funciona").
        if (canceladoRef.current) {
            stream.getTracks().forEach(t => t.stop())
            return
        }
        streamRef.current = stream
        // El <video> está montado siempre (ver JSX) así que la ref ya existe
        // aquí — antes se asignaba solo si estado==='camara', pero el <video>
        // aún no se montaba en ese momento y la asignación se perdía en
        // silencio (por eso no se veía imagen).
        if (videoRef.current) {
            videoRef.current.srcObject = stream
            await videoRef.current.play?.().catch(() => {})
        }
        setEstado('camara')
    }

    useEffect(() => {
        let cancelado = false
        canceladoRef.current = false

        async function iniciar() {
            try {
                await cargarModelos()
                if (cancelado) return
                await iniciarCamara()
            } catch (e) {
                if (!cancelado) {
                    setError(
                        e.name === 'NotAllowedError'
                            ? 'Se necesita permiso de la cámara para capturar el rostro'
                            : e.name === 'InsecureContext'
                                ? e.message
                                : e.name === 'NotFoundError'
                                    ? 'No se encontró ninguna cámara conectada'
                                    : `No se pudo iniciar la cámara o los modelos: ${e.message}`
                    )
                    setEstado('error')
                }
            }
        }
        iniciar()

        return () => {
            cancelado = true
            canceladoRef.current = true
            streamRef.current?.getTracks().forEach(t => t.stop())
        }
    }, [])

    // Bucle de detección en vivo: mientras la cámara esté activa, intenta
    // detectar un rostro cada 300ms y dibuja el recuadro sobre el video.
    // Antes se hacía un solo intento al hacer click en "Capturar", sin
    // ninguna señal de si el modelo veía algo — si el video todavía no
    // tenía frames listos (videoWidth/videoHeight en 0 justo después de
    // getUserMedia) ese único intento fallaba siempre y no había forma de
    // saber por qué. Con el bucle, "Capturar" solo se habilita cuando
    // realmente hay un rostro visible.
    useEffect(() => {
        if (estado !== 'camara') return

        loopRef.current = setInterval(async () => {
            const video = videoRef.current
            if (!video || video.readyState < 2 || video.videoWidth === 0) return

            try {
                const deteccion = await faceapi.detectSingleFace(video, DETECTOR_OPTIONS).withFaceLandmarks()
                setRostroVisible(!!deteccion)
                dibujarDeteccion(deteccion, video)
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

    const detener = () => {
        clearInterval(loopRef.current)
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
    }

    const handleCapturar = async () => {
        clearInterval(loopRef.current)
        setEstado('detectando')
        setError(null)
        try {
            const deteccion = await faceapi
                .detectSingleFace(videoRef.current, DETECTOR_OPTIONS)
                .withFaceLandmarks()
                .withFaceDescriptor()

            if (!deteccion) {
                setError('No se detectó ningún rostro. Centra tu cara frente a la cámara e intenta de nuevo.')
                setEstado('camara')
                return
            }

            if (deteccion.detection.score < MIN_SCORE_GUARDAR) {
                console.log('[captura] rechazada por score bajo', { score: deteccion.detection.score, minimo: MIN_SCORE_GUARDAR })
                setError(`La imagen no es lo suficientemente clara (confianza ${(deteccion.detection.score * 100).toFixed(0)}%). Mejora la iluminación, acércate a la cámara y vuelve a intentar.`)
                setEstado('camara')
                return
            }

            setDescriptor(Array.from(deteccion.descriptor))
            detener()
            setEstado('capturado')
        } catch (e) {
            setError(`Error al detectar el rostro: ${e.message}`)
            setEstado('camara')
        }
    }

    const handleReintentar = async () => {
        setDescriptor(null)
        setError(null)
        setRostroVisible(false)
        setEstado('cargando')
        try {
            await iniciarCamara()
        } catch (e) {
            setError(`No se pudo reiniciar la cámara: ${e.message}`)
            setEstado('error')
        }
    }

    const handleGuardar = async () => {
        setLoading(true)
        try {
            await onSave(JSON.stringify(descriptor))
        } finally {
            setLoading(false)
        }
    }

    const handleClose = () => {
        detener()
        onClose()
    }

    // Mientras la cámara está activa, el fondo se pone blanco: el monitor
    // actúa como luz frontal y mejora la iluminación del rostro al capturar.
    const pantallaBlanca = estado === 'cargando' || estado === 'camara' || estado === 'detectando'

    return (
        <div
            className="modal-overlay"
            style={pantallaBlanca ? { background: '#ffffff' } : undefined}
            onClick={e => e.target === e.currentTarget && handleClose()}
        >
            <div
                className="modal"
                style={pantallaBlanca ? { background: '#ffffff', color: '#111827', boxShadow: 'none' } : undefined}
                onClick={e => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2 className="modal-title" style={pantallaBlanca ? { color: '#111827' } : undefined}>
                        Capturar rostro{empleado ? ` · ${empleado.nombre}` : ''}
                    </h2>
                    <button className="btn-icon" onClick={handleClose}>✕</button>
                </div>

                <div className="modal-body">
                    {estado === 'cargando' && (
                        <p style={{ color: 'var(--text-muted)' }}>Cargando cámara y modelos...</p>
                    )}

                    {/* El <video> se monta siempre (nunca se quita del DOM) para que
                        videoRef.current ya exista cuando el stream llega — solo se
                        oculta con CSS según el estado. */}
                    <div
                        style={{
                            display: (estado === 'camara' || estado === 'detectando') ? 'flex' : 'none',
                            flexDirection: 'column', gap: 10, alignItems: 'center',
                        }}
                    >
                        <div style={{ position: 'relative', width: '100%', maxWidth: 360, overflow: 'hidden', borderRadius: 8 }}>
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
                            {/* Guía visual: la webcam de laptop suele tener mucho campo de
                                visión alrededor de la cara — este óvalo marca dónde centrarla. */}
                            <div style={{
                                position: 'absolute', top: '50%', left: '50%',
                                width: '52%', height: '72%',
                                transform: 'translate(-50%, -50%)',
                                borderRadius: '50%',
                                border: `3px solid ${rostroVisible ? '#22c55e' : 'rgba(255,255,255,0.75)'}`,
                                boxShadow: '0 0 0 2000px rgba(255,255,255,0.35)',
                                pointerEvents: 'none',
                                transition: 'border-color 0.2s',
                            }} />
                        </div>
                        <span className={`badge ${rostroVisible ? 'badge-green' : 'badge-gray'}`}>
                            {rostroVisible ? '✅ Rostro detectado' : 'Centra tu rostro frente a la cámara'}
                        </span>
                    </div>

                    {estado === 'capturado' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                            <span className="badge badge-green">✅ Rostro capturado correctamente</span>
                        </div>
                    )}

                    {error && <div className="form-error" style={{ marginTop: 10 }}>❌ {error}</div>}
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-outline" onClick={handleClose} disabled={loading}>
                        Cancelar
                    </button>

                    {estado === 'capturado' ? (
                        <>
                            <button type="button" className="btn btn-outline" onClick={handleReintentar} disabled={loading}>
                                Reintentar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleGuardar} disabled={loading}>
                                {loading ? 'Guardando...' : 'Guardar'}
                            </button>
                        </>
                    ) : (
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={handleCapturar}
                            disabled={estado !== 'camara' || !rostroVisible}
                        >
                            {estado === 'detectando' ? 'Detectando...' : '📷 Capturar'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
