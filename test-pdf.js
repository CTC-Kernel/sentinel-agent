// Test simple pour vérifier la génération PDF
import { PdfService } from './src/services/PdfService.js';

// Test basique de création PDF
try {
    const doc = PdfService.generateExecutiveReport(
        {
            title: 'Test Report',
            subtitle: 'Test subtitle',
            filename: 'test.pdf',
            organizationName: 'Test Org',
            save: false
        },
        (doc, y) => {
            doc.text('Test content', 14, y);
        }
    );
    
    console.log('✅ PDF generation test passed');
    console.log('PDF blob size:', doc.output('blob').size, 'bytes');
} catch (error) {
    console.error('❌ PDF generation test failed:', error);
}
