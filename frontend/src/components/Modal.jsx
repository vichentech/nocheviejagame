import React from 'react';
import { FaTimes } from 'react-icons/fa';

const Modal = ({ isOpen, onClose, title, message, type = 'alert', onConfirm, children }) => {
    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', maxWidth: '400px', width: '90%', position: 'relative' }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: '10px', right: '10px', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
                >
                    <FaTimes />
                </button>
                <h3 style={{ marginBottom: '1rem', color: 'var(--secondary)' }}>{title}</h3>

                {children ? (
                    <div style={{ marginBottom: '1rem' }}>{children}</div>
                ) : (
                    <p style={{ marginBottom: '2rem' }}>{message}</p>
                )}

                {!children && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                        {type === 'confirm' && (
                            <button className="btn-secondary" onClick={onClose}>Cancelar</button>
                        )}
                        <button className="btn-primary" onClick={() => {
                            if (onConfirm) onConfirm();
                            onClose();
                        }}>
                            {type === 'confirm' ? 'Confirmar' : 'Aceptar'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Modal;
