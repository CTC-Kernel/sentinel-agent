import '@testing-library/jest-dom';

import React from 'react';

// Global mocks if needed
global.React = React;

// ResizeObserver mock
global.ResizeObserver = class ResizeObserver {
    observe() { }
    unobserve() { }
    disconnect() { }
};
