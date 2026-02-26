export function manualChunks(id: string) {
    // Keep the React ecosystem together to avoid circular chunk graphs
    // like: vendor -> react -> vendor.
    if (
        id === 'react' ||
        id === 'react-dom' ||
        id.includes('/react/') ||
        id.includes('\\react\\') ||
        id.includes('/react-dom/') ||
        id.includes('\\react-dom\\') ||
        id.includes('react/jsx-runtime') ||
        id.includes('react/jsx-dev-runtime') ||
        id.includes('scheduler') ||
        id.includes('use-sync-external-store')
    ) {
        return 'vendor';
    }

    if (id.includes('node_modules')) {
        if (id.includes('chart.js')) return 'vendor-charts';
        if (id.includes('@fortawesome') || id.includes('@icons-pack/react-simple-icons')) return 'vendor-icons';
        if (id.includes('react-calendar')) return 'vendor-calendar';
        if (id.includes('react-toastify')) return 'vendor-toast';
        if (id.includes('react-slick') || id.includes('slick-carousel')) return 'vendor-carousel';
        if (id.includes('react-router') || id.includes('@remix-run/router')) return 'vendor-router';
        if (id.includes('axios')) return 'vendor-http';
        if (id.includes('luxon')) return 'luxon';
        return 'vendor';
    }
}
