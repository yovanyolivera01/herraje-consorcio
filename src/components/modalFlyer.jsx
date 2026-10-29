import { useEffect } from 'react'
import flyerConsultaPedidos from '../assets/images/flyer-consulta-pedidos.png'

// Clave de sessionStorage: Login.jsx la activa al iniciar sesión y el modal
// la borra al cerrarse, así el aviso sale una vez por inicio de sesión y no
// al navegar ni al refrescar después de cerrarlo.
export const FLYER_KEY = 'hc_mostrar_flyer'

// Modal con el flyer de aviso: guía rápida de Consulta de pedidos.
// Solo se cierra con la X (o Escape / clic fuera de la imagen).
export default function ModalFlyer({ onClose }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose()
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return (
        <div
            className="modal-overlay"
            style={{ zIndex: 300 }}
            onClick={e => e.target === e.currentTarget && onClose()}
        >
            <div
                style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar aviso"
                    title="Cerrar"
                    style={{
                        position: 'absolute', top: 8, right: 8, width: 36, height: 36,
                        borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 20, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                >
                    ✕
                </button>
                <img
                    src={flyerConsultaPedidos}
                    alt="Guía rápida: cómo consultar un pedido"
                    style={{
                        display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 40px)',
                        borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    }}
                />
            </div>
        </div>
    )
}
