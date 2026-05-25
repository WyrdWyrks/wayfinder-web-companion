import React, { createContext, useCallback, useContext, useState } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';

type ToastContextType = {
    showError: (message: string) => void;
};

const ToastContext = createContext<ToastContextType>({ showError: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('');

    const showError = useCallback((msg: string) => {
        setMessage(msg);
        setOpen(true);
    }, []);

    return (
        <ToastContext.Provider value={{ showError }}>
            {children}
            <Snackbar
                open={open}
                autoHideDuration={6000}
                onClose={() => setOpen(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={() => setOpen(false)} severity="error" variant="filled" sx={{ width: '100%' }}>
                    {message}
                </Alert>
            </Snackbar>
        </ToastContext.Provider>
    );
}

export function useToast() {
    return useContext(ToastContext);
}
