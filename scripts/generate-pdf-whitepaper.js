import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix 14: Use __dirname equivalent for reliable file path resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Charger le contenu du whitepaper
let whitepaperContent;
try {
  whitepaperContent = fs.readFileSync(path.join(__dirname, '../WHITEPAPER_SENTINEL_GRC.md'), 'utf8');
} catch (err) {
  console.error('Failed to read whitepaper file:', err.message);
  process.exit(1);
}

// Configuration PDF
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4'
});

// Configuration des polices
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 20;
const contentWidth = pageWidth - 2 * margin;
const lineHeight = 6;
const fontSize = 10;

// Variables de suivi
let yPosition = margin;
let pageNumber = 1;

// Fonction pour ajouter une nouvelle page
function addNewPage() {
  doc.addPage();
  yPosition = margin;
  pageNumber++;
  addFooter();
}

// Fonction pour ajouter le footer
function addFooter() {
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 15, pageHeight - 10);
  doc.text('© 2026 Sentinel GRC - Tous droits réservés', margin, pageHeight - 10);
}

// Fonction pour ajouter du texte avec retour à la ligne automatique
function addText(text, fontSize = 10, fontStyle = 'normal', color = [0, 0, 0]) {
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  doc.setTextColor(...color);
  
  const lines = doc.splitTextToSize(text, contentWidth);
  
  lines.forEach(line => {
    if (yPosition > pageHeight - 30) {
      addNewPage();
    }
    doc.text(line, margin, yPosition);
    yPosition += lineHeight;
  });
  
  yPosition += 3; // Espacement après paragraphe
}

// Fonction pour ajouter un titre
function addTitle(text, level = 1) {
  const sizes = { 1: 20, 2: 16, 3: 14, 4: 12, 5: 11 };
  const size = sizes[level] || fontSize;
  
  if (yPosition > pageHeight - 40) {
    addNewPage();
  }
  
  addText(text, size, 'bold', [0, 51, 102]);
  yPosition += 5;
}

// Fonction pour ajouter un tableau
function addTable(headers, data) {
  if (yPosition > pageHeight - 60) {
    addNewPage();
  }
  
  autoTable(doc, {
    head: [headers],
    body: data,
    startY: yPosition,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [0, 51, 102], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    margin: { left: margin, right: margin }
  });
  
  yPosition = doc.lastAutoTable.finalY + 10;
}

// Page de garde
function createCoverPage() {
  // Fond bleu pour le header
  doc.setFillColor(0, 51, 102);
  doc.rect(0, 0, pageWidth, 100, 'F');
  
  // Titre principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('Whitepaper', pageWidth / 2, 40, { align: 'center' });
  
  doc.setFontSize(24);
  doc.text('Sentinel GRC v2.0', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Plateforme Intégrée de Gouvernance, Risques et Conformité', pageWidth / 2, 80, { align: 'center' });
  
  // Contenu principal
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const coverContent = [
    '',
    '',
    '',
    'Version 2.0 - Janvier 2026',
    '',
    'Document confidentiel - Usage interne uniquement',
    '',
    'Sentinel GRC est la plateforme professionnelle de gestion',
    'de la sécurité des systèmes d\'information (SSI) conforme',
    'aux normes ISO 27001 et ISO 27005.',
    '',
    'Ce document présente l\'architecture, les fonctionnalités',
    'et la stratégie commerciale de la solution.'
  ];
  
  let yPos = 130;
  coverContent.forEach(line => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  });
  
  // Footer page de garde
  doc.setFillColor(0, 51, 102);
  doc.rect(0, pageHeight - 30, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.text('🇫🇷 Solution Souveraine • 100% Cloud France • Qualification SecNumCloud', pageWidth / 2, pageHeight - 15, { align: 'center' });
}

// Parser Markdown et générer le PDF
function parseMarkdownToPDF(content) {
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentTable = null;
  
  lines.forEach(line => {
    // Pages de code
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      if (!inCodeBlock && currentTable) {
        // Finaliser le tableau
        addTable(currentTable.headers, currentTable.data);
        currentTable = null;
      }
      return;
    }
    
    if (inCodeBlock) {
      // Ignorer le contenu des blocs de code pour le PDF
      return;
    }
    
    // Titres
    if (line.startsWith('# ')) {
      addTitle(line.substring(2), 1);
    } else if (line.startsWith('## ')) {
      addTitle(line.substring(3), 2);
    } else if (line.startsWith('### ')) {
      addTitle(line.substring(4), 3);
    } else if (line.startsWith('#### ')) {
      addTitle(line.substring(5), 4);
    } else if (line.startsWith('##### ')) {
      addTitle(line.substring(6), 5);
    }
    // Fix 16: Fixed markdown table parsing - correct header/separator/data detection
    else if (line.includes('|') && !currentTable) {
      // First line with | is the header row
      currentTable = { headers: [], data: [] };
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      currentTable.headers = cells;
    } else if (line.includes('|') && line.includes('-') && currentTable && currentTable.data.length === 0) {
      // Separator line (e.g., |---|---|) - skip it
    } else if (line.includes('|') && currentTable) {
      // Data rows
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      currentTable.data.push(cells);
    }
    // Lignes vides
    else if (line.trim() === '') {
      yPosition += 5;
    }
    // Texte normal
    else if (line.trim() !== '') {
      // Nettoyer le markdown
      let cleanText = line
        .replace(/\*\*(.*?)\*\*/g, '$1') // Gras
        .replace(/\*(.*?)\*/g, '$1')     // Italique
        .replace(/`(.*?)`/g, '$1')       // Code inline
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Liens
      
      addText(cleanText);
    }
  });

  // Fix 17: Flush any remaining table at end of file
  if (currentTable) {
    addTable(currentTable.headers, currentTable.data);
    currentTable = null;
  }
}

// Génération du PDF
console.log('🎨 Génération du PDF en cours...');

// Page de garde
createCoverPage();

// Page 2 : Table des matières
addNewPage();
addTitle('Table des Matières', 1);

const toc = [
  '1. Résumé Exécutif',
  '2. Introduction',
  '3. Analyse de Marché',
  '4. Architecture Technique',
  '5. Modules Fonctionnels',
  '6. Conformité Réglementaire',
  '7. Sécurité et Permissions',
  '8. Innovation Technologique',
  '9. Cas d\'Usage',
  '10. Avantages Concurrentiels',
  '11. Business Model',
  '12. Feuille de Route'
];

// Fix 15: Items already contain numbers, don't double-number them
toc.forEach((item) => {
  addText(item, 11);
});

// Contenu principal
addNewPage();
parseMarkdownToPDF(whitepaperContent);

// Fix 18: Fix doc.save for Node.js environment
const fileName = 'WHITEPAPER_SENTINEL_GRC.pdf';
const buffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(fileName, buffer);
console.log(`PDF generated: ${fileName}`);

console.log(`✅ PDF généré avec succès : ${fileName}`);
console.log(`📊 Statistiques :`);
console.log(`   - ${pageNumber} pages`);
console.log(`   - Format A4`);
console.log(`   - Taille estimée : ~2-3 MB`);
