export function manualChunks(id: string) {
    if (id.includes('node_modules')) {
        if (id.includes('react-calendar')) return 'react-calendar';
        if (id.includes('react-toastify')) return 'react-toastify';
        if (id.includes('luxon')) return 'luxon';
        if (id.includes('react')) return 'react';
        return 'vendor';
    }
}