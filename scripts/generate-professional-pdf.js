import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix 29/14: Use __dirname equivalent for reliable file path resolution
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

// Configuration PDF professionnelle
const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: 'a4'
});

// Configuration avancée
const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 20;
const contentWidth = pageWidth - 2 * margin;
const lineHeight = 5;
const smallLineHeight = 4;
let yPosition = margin;
let pageNumber = 1;

// Couleurs professionnelles
const colors = {
  primary: [0, 51, 102],      // Bleu foncé
  secondary: [51, 102, 153],    // Bleu moyen
  accent: [0, 128, 255],       // Bleu vif
  text: [51, 51, 51],           // Gris foncé
  light: [245, 245, 245],        // Gris très clair
  success: [0, 128, 0]           // Vert
  // Fix 28: Removed unused 'warning' and 'error' color definitions
};

// Polices
const fonts = {
  title: { size: 24, style: 'bold' },
  heading1: { size: 18, style: 'bold' },
  heading2: { size: 14, style: 'bold' },
  heading3: { size: 12, style: 'bold' },
  heading4: { size: 11, style: 'bold' },
  body: { size: 10, style: 'normal' },
  small: { size: 8, style: 'normal' },
  code: { size: 9, style: 'normal' }
};

// Fonctions utilitaires
function addNewPage() {
  doc.addPage();
  yPosition = margin;
  pageNumber++;
  addHeader();
  addFooter();
}

function addHeader() {
  // Header bleu
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 15, 'F');
  
  // Logo/texte header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Sentinel GRC v2.0', margin, 10);
  
  // Numéro de page
  doc.text(`Page ${pageNumber}`, pageWidth - margin - 20, 10);
}

function addFooter() {
  // Footer
  doc.setFillColor(...colors.light);
  doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
  
  doc.setTextColor(...colors.text);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('© 2026 Sentinel GRC - Tous droits réservés', margin, pageHeight - 8);
  doc.text('Plateforme Intégrée de Gouvernance, Risques et Conformité', pageWidth - margin - 80, pageHeight - 8);
}

function checkPageBreak(requiredHeight) {
  if (yPosition + requiredHeight > pageHeight - 25) {
    addNewPage();
    return true;
  }
  return false;
}

function addText(text, fontSize = 10, fontStyle = 'normal', color = colors.text, lineHeightMultiplier = 1) {
  checkPageBreak(lineHeight * lineHeightMultiplier * 2);
  
  doc.setFontSize(fontSize);
  doc.setFont('helvetica', fontStyle);
  doc.setTextColor(...color);
  
  const lines = doc.splitTextToSize(text, contentWidth);
  
  lines.forEach(line => {
    if (yPosition > pageHeight - 20) {
      addNewPage();
    }
    doc.text(line, margin, yPosition);
    yPosition += lineHeight * lineHeightMultiplier;
  });
  
  yPosition += 2; // Espacement après paragraphe
}

function addTitle(text, level = 1) {
  const titleConfig = fonts[`heading${level}`] || fonts.heading1;
  const spacing = { 1: 8, 2: 6, 3: 5, 4: 4, 5: 3 }[level] || 3;
  
  checkPageBreak(spacing * 2);
  
  // Ligne de séparation pour les titres principaux
  if (level <= 2) {
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
  }
  
  addText(text, titleConfig.size, titleConfig.style, colors.primary, 1.2);
  yPosition += spacing;
  
  if (level <= 2) {
    doc.setDrawColor(...colors.primary);
    doc.setLineWidth(0.3);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 3;
  }
}

function addSubtitle(text) {
  addText(text, fonts.heading3.size, 'bold', colors.secondary);
  yPosition += 2;
}

function addBullet(text, level = 0) {
  const bullets = ['•', '○', '▪', '▫'];
  const bullet = bullets[level] || '•';
  const indent = level * 8;
  
  checkPageBreak(lineHeight * 2);
  
  doc.setFontSize(fonts.body.size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.text);
  
  const bulletText = `${bullet} ${text}`;
  const lines = doc.splitTextToSize(bulletText, contentWidth - indent);
  
  lines.forEach((line, index) => {
    if (index === 0) {
      doc.text(line, margin + indent, yPosition);
    } else {
      doc.text(line, margin + indent + 10, yPosition);
    }
    yPosition += lineHeight;
  });
  
  yPosition += 1;
}

function addCodeBlock(text) {
  // Fix 22: Calculate dynamic height for code blocks
  doc.setFontSize(fonts.code.size);
  const codeLines = doc.splitTextToSize(text, contentWidth - 10);
  const blockHeight = codeLines.length * smallLineHeight + 4;
  
  checkPageBreak(blockHeight + 4);
  
  // Fond pour le code
  doc.setFillColor(...colors.light);
  doc.rect(margin, yPosition - 2, contentWidth, blockHeight, 'F');
  
  // Bordure
  doc.setDrawColor(...colors.secondary);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition - 2, contentWidth, blockHeight);
  
  // Texte du code
  doc.setFont('courier', 'normal');
  doc.setTextColor(...colors.text);
  
  const lines = codeLines;
  lines.forEach(line => {
    doc.text(line, margin + 5, yPosition + 3);
    yPosition += smallLineHeight;
  });
  
  yPosition += 5;
}

function addTable(headers, data, options = {}) {
  checkPageBreak(60);
  
  const defaultOptions = {
    startY: yPosition,
    theme: 'grid',
    styles: { 
      fontSize: 9, 
      cellPadding: 4,
      font: 'helvetica',
      textColor: colors.text
    },
    headStyles: { 
      fillColor: colors.primary, 
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    alternateRowStyles: { fillColor: colors.light },
    margin: { left: margin, right: margin },
    ...options
  };
  
  autoTable(doc, {
    head: [headers],
    body: data,
    ...defaultOptions
  });
  
  yPosition = doc.lastAutoTable.finalY + 8;
}

function addBox(content, title = '', boxColor = colors.light) {
  checkPageBreak(40);
  
  // Fix 21: Calculate dynamic height based on content
  const boxLines = doc.splitTextToSize(content, contentWidth - 10);
  const boxHeight = boxLines.length * 5 + 8; // 5mm per line + padding
  
  // Fond de la boîte
  doc.setFillColor(...boxColor);
  doc.rect(margin, yPosition - 2, contentWidth, boxHeight, 'F');
  
  // Fix 20: Use 'S' (stroke) for border, not 'F' (fill)
  doc.setDrawColor(...colors.secondary);
  doc.setLineWidth(0.5);
  doc.rect(margin, yPosition - 2, contentWidth, boxHeight, 'S');
  
  // Titre si fourni
  if (title) {
    doc.setFontSize(fonts.heading4.size);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...colors.primary);
    doc.text(title, margin + 5, yPosition + 5);
    yPosition += 8;
  }
  
  // Contenu
  doc.setFontSize(fonts.small.size);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...colors.text);
  
  boxLines.forEach(line => {
    doc.text(line, margin + 5, yPosition);
    yPosition += smallLineHeight;
  });
  
  yPosition += 5;
}

function addSeparator() {
  doc.setDrawColor(...colors.secondary);
  doc.setLineWidth(0.3);
  doc.line(margin, yPosition, pageWidth - margin, yPosition);
  yPosition += 5;
}

// Fix 19: Removed duplicate checkPageBorder - using checkPageBreak instead

// Page de garde professionnelle
function createCoverPage() {
  // Fond dégradé simulé avec rectangles
  for (let i = 0; i < 20; i++) {
    const alpha = 1 - (i / 20);
    const gray = Math.floor(245 - (i * 3));
    doc.setFillColor(gray, gray, gray + 10);
    doc.rect(0, i * 15, pageWidth, 15, 'F');
  }
  
  // Bandeau bleu principal
  doc.setFillColor(...colors.primary);
  doc.rect(0, 0, pageWidth, 120, 'F');
  
  // Titre principal
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('Whitepaper', pageWidth / 2, 50, { align: 'center' });
  
  doc.setFontSize(28);
  doc.text('Sentinel GRC v2.0', pageWidth / 2, 80, { align: 'center' });
  
  doc.setFontSize(16);
  doc.text('Plateforme Intégrée de Gouvernance, Risques et Conformité', pageWidth / 2, 105, { align: 'center' });
  
  // Zone de contenu principal
  doc.setTextColor(...colors.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  
  const coverInfo = [
    '',
    '',
    'Version 2.0 - Janvier 2026',
    '',
    'Document Professionnel',
    '',
    'Sentinel GRC est la plateforme française de gestion',
    'de la sécurité des systèmes d\'information (SSI)',
    'conforme aux normes ISO 27001 et ISO 27005.',
    '',
    'Ce document présente la stratégie complète,',
    'l\'architecture technique et le modèle économique',
    'de la solution souveraine de cybersécurité.'
  ];
  
  let yPos = 150;
  coverInfo.forEach(line => {
    doc.text(line, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  });
  
  // Footer avec badges
  doc.setFillColor(...colors.primary);
  doc.rect(0, pageHeight - 40, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text('🇫🇷 Solution 100% Souveraine', pageWidth / 2 - 60, pageHeight - 25);
  doc.text('🛡️ Qualification SecNumCloud', pageWidth / 2 + 40, pageHeight - 25);
  
  doc.setFontSize(9);
  doc.text('Hébergement France • Conformité RGPD • Sans CLOUD Act', pageWidth / 2, pageHeight - 10, { align: 'center' });
}

// Table des matières
function createTableOfContents() {
  addNewPage();
  addTitle('Table des Matières', 1);
  
  const toc = [
    ['1.', 'Résumé Exécutif', '3'],
    ['2.', 'Introduction', '4'],
    ['3.', 'Analyse de Marché', '5'],
    ['4.', 'Architecture Technique', '12'],
    ['5.', 'Modules Fonctionnels', '16'],
    ['6.', 'Conformité Réglementaire', '20'],
    ['7.', 'Sécurité et Permissions', '22'],
    ['8.', 'Innovation Technologique', '24'],
    ['9.', 'Cas d\'Usage', '26'],
    ['10.', 'Avantages Concurrentiels', '28'],
    ['11.', 'Business Model', '35'],
    ['12.', 'Feuille de Route', '42']
  ];
  
  // En-têtes du tableau
  addTable(['Chapitre', 'Titre', 'Page'], toc, {
    headStyles: { fillColor: colors.primary, textColor: 255 },
    bodyStyles: { fontSize: 10 }
  });
}

// Parser Markdown amélioré
function parseMarkdownToPDF(content) {
  const lines = content.split('\n');
  let inCodeBlock = false;
  let currentTable = { headers: [], data: [] };
  let inTable = false;
  let skipNextLine = false;
  
  // Fix 23: Add skipUntilIndex for ASCII box parsing
  let skipUntilIndex = -1;
  
  lines.forEach((line, index) => {
    // Fix 23: Skip lines consumed by ASCII box parsing
    if (index <= skipUntilIndex) return;
    
    // Skip lignes vides après traitement
    if (skipNextLine) {
      skipNextLine = false;
      return;
    }
    
    // Pages de code
    if (line.startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      return;
    }
    
    if (inCodeBlock) {
      addCodeBlock(line);
      return;
    }
    
    // Titres
    if (line.startsWith('# ')) {
      addTitle(line.substring(2).trim(), 1);
    } else if (line.startsWith('## ')) {
      addTitle(line.substring(3).trim(), 2);
    } else if (line.startsWith('### ')) {
      addTitle(line.substring(4).trim(), 3);
    } else if (line.startsWith('#### ')) {
      addTitle(line.substring(5).trim(), 4);
    } else if (line.startsWith('##### ')) {
      addTitle(line.substring(6).trim(), 5);
    }
    // Listes
    else if (line.trim().startsWith('- ')) {
      addBullet(line.trim().substring(2), 0);
    } else if (line.trim().startsWith('  - ')) {
      addBullet(line.trim().substring(4), 1);
    } else if (line.trim().startsWith('    - ')) {
      addBullet(line.trim().substring(6), 2);
    }
    // Fix 25: Fixed markdown table parsing - correct header/separator/data detection
    else if (line.includes('|') && !inTable) {
      // First line with | is the header row
      inTable = true;
      const headers = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      currentTable.headers = headers;
    } else if (line.includes('|') && line.includes('-') && inTable && currentTable.data.length === 0) {
      // Separator line (e.g., |---|---|) - skip it
    } else if (line.includes('|') && inTable) {
      // Data rows
      const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
      if (cells.length > 0) {
        currentTable.data.push(cells);
      }
    } else if (inTable && line.trim() === '') {
      // Fin du tableau
      if (currentTable.headers.length > 0 && currentTable.data.length > 0) {
        addTable(currentTable.headers, currentTable.data);
      }
      inTable = false;
      currentTable = { headers: [], data: [] };
    }
    // Boîtes et cadres (ASCII art)
    else if (line.includes('┌') || line.includes('│') || line.includes('└')) {
      // Traiter comme une boîte spéciale
      if (line.includes('┌')) {
        // Début de boîte - collecter les lignes
        let boxContent = [];
        let boxTitle = '';
        let endIndex = index;
        
        while (endIndex < lines.length && !lines[endIndex].includes('└')) {
          if (lines[endIndex].includes('│') && !lines[endIndex].includes('┌') && !lines[endIndex].includes('└')) {
            const boxLineContent = lines[endIndex].replace(/│/g, '').trim();
            if (boxLineContent && !boxTitle) {
              boxTitle = boxLineContent;
            } else if (boxLineContent) {
              boxContent.push(boxLineContent);
            }
          }
          endIndex++;
        }
        
        // Fix 23: Skip all consumed lines
        skipUntilIndex = endIndex;
        
        if (boxContent.length > 0) {
          addBox(boxContent.join(' '), boxTitle);
        }
      }
    }
    // Lignes de séparation
    else if (/\u2501{10,}/.test(line)) {
      addSeparator();
    }
    // Texte normal
    else if (line.trim() !== '' && !line.startsWith('---')) {
      // Nettoyer le markdown
      let cleanText = line
        .replace(/\*\*(.*?)\*\*/g, '$1') // Gras
        .replace(/\*(.*?)\*/g, '$1')     // Italique
        .replace(/`(.*?)`/g, '$1')       // Code inline
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Liens
        .replace(/^> /g, '')            // Citations
        .trim();
      
      if (cleanText) {
        addText(cleanText);
      }
    }
    // Lignes vides
    else if (line.trim() === '') {
      yPosition += 3;
    }
  });
}

// Génération du PDF
console.log('🎨 Génération du PDF professionnel en cours...');

// Fix 24: Removed wasted addHeader()/addFooter() calls before cover page

// Page de garde
createCoverPage();

// Table des matières
createTableOfContents();

// Contenu principal
addNewPage();
parseMarkdownToPDF(whitepaperContent);

// Fix 26: Fix doc.save for Node.js environment
const fileName = 'WHITEPAPER_SENTINEL_GRC_PROFESSIONNEL.pdf';
const buffer = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync(fileName, buffer);
console.log(`PDF generated: ${fileName}`);

console.log(`✅ PDF professionnel généré avec succès : ${fileName}`);
console.log(`📊 Statistiques avancées :`);
console.log(`   - ${pageNumber} pages`);
console.log(`   - Format A4 professionnel`);
console.log(`   - Design corporate`);
console.log(`   - Navigation optimisée`);
console.log(`   - Taille estimée : ~3-4 MB`);
