document.addEventListener('DOMContentLoaded', () => {
  lucide.createIcons();

  // Elements
  const uploadPanel = document.getElementById('upload-panel');
  const workspacePanel = document.getElementById('workspace-panel');
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');
  const btnAddMore = document.getElementById('btn-add-more');
  const btnClearAll = document.getElementById('btn-clear-all');
  const imageGrid = document.getElementById('image-grid');
  const pageCountBadge = document.getElementById('page-count-badge');
  const btnGeneratePdf = document.getElementById('btn-generate-pdf');

  const settingPageSize = document.getElementById('setting-page-size');
  const settingOrientation = document.getElementById('setting-orientation');
  const settingMargin = document.getElementById('setting-margin');

  const processingModal = document.getElementById('processing-modal');
  const progressBar = document.getElementById('progress-bar');
  const processingStatus = document.getElementById('processing-status');

  // Master image list: [{ id, file, url, rotation }]
  let images = [];

  // Initialize SortableJS on Image Grid
  new Sortable(imageGrid, {
    animation: 200,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    handle: '.drag-handle',
    onEnd: () => {
      syncOrderFromDOM();
    }
  });

  // Dropzone listeners
  dropZone.addEventListener('click', () => fileInput.click());
  btnAddMore.addEventListener('click', () => fileInput.click());

  ['dragenter', 'dragover'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    });
  });

  dropZone.addEventListener('drop', (e) => {
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      fileInput.value = ''; // Reset input to allow re-uploading same file
    }
  });

  btnClearAll.addEventListener('click', () => {
    images.forEach(img => URL.revokeObjectURL(img.url));
    images = [];
    renderGrid();
  });

  // Process incoming files
  function handleFiles(files) {
    const validFiles = files.filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      alert('Please upload valid image files (JPG, PNG, WEBP).');
      return;
    }

    validFiles.forEach(file => {
      images.push({
        id: 'img_' + Math.random().toString(36).substr(2, 9),
        file: file,
        url: URL.createObjectURL(file),
        rotation: 0
      });
    });

    renderGrid();
  }

  // Render Grid Cards
  function renderGrid() {
    if (images.length === 0) {
      uploadPanel.classList.remove('hidden');
      workspacePanel.classList.add('hidden');
      return;
    }

    uploadPanel.classList.add('hidden');
    workspacePanel.classList.remove('hidden');
    pageCountBadge.textContent = `${images.length} Image${images.length > 1 ? 's' : ''}`;

    imageGrid.innerHTML = '';

    images.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'image-card group';
      card.dataset.id = item.id;

      card.innerHTML = `
        <!-- Page Number & Actions Bar -->
        <div class="drag-handle p-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between cursor-grab active:cursor-grabbing">
          <span class="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-slate-500"></i>
            Page ${index + 1}
          </span>
          <div class="flex items-center space-x-1">
            <button type="button" class="btn-rotate p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition" title="Rotate 90°">
              <i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i>
            </button>
            <button type="button" class="btn-delete p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition" title="Delete page">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Thumbnail Container -->
        <div class="thumb-container">
          <img src="${item.url}" class="thumb-img" style="transform: rotate(${item.rotation}deg);" alt="preview">
        </div>

        <!-- File Name Footer -->
        <div class="p-2.5 bg-slate-950/70 text-[11px] text-slate-400 truncate border-t border-slate-800/80">
          ${item.file.name}
        </div>
      `;

      // Card Events
      card.querySelector('.btn-rotate').addEventListener('click', (e) => {
        e.stopPropagation();
        item.rotation = (item.rotation + 90) % 360;
        card.querySelector('.thumb-img').style.transform = `rotate(${item.rotation}deg)`;
      });

      card.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        URL.revokeObjectURL(item.url);
        images = images.filter(img => img.id !== item.id);
        renderGrid();
      });

      imageGrid.appendChild(card);
    });

    lucide.createIcons();
  }

  // Sync internal array order when cards are dragged
  function syncOrderFromDOM() {
    const cardElements = Array.from(imageGrid.children);
    const reordered = [];

    cardElements.forEach((card, index) => {
      const id = card.dataset.id;
      const found = images.find(img => img.id === id);
      if (found) reordered.push(found);
      
      // Update page label text
      const pageLabel = card.querySelector('.drag-handle span');
      if (pageLabel) {
        pageLabel.innerHTML = `<i data-lucide="grip-vertical" class="w-3.5 h-3.5 text-slate-500"></i> Page ${index + 1}`;
      }
    });

    images = reordered;
    lucide.createIcons();
  }

  // Generate & Download PDF
  btnGeneratePdf.addEventListener('click', async () => {
    if (images.length === 0) return;

    processingModal.classList.remove('hidden');
    progressBar.style.width = '10%';
    processingStatus.textContent = 'Preparing PDF document...';

    try {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageSize = settingPageSize.value;
      const orientation = settingOrientation.value;
      const marginType = settingMargin.value;

      // Margins in points (72 points = 1 inch)
      const marginMap = { none: 0, small: 18, normal: 36 };
      const margin = marginMap[marginType] || 0;

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const progress = Math.round(((i + 1) / images.length) * 85);
        progressBar.style.width = `${progress}%`;
        processingStatus.textContent = `Processing image ${i + 1} of ${images.length}...`;

        // Load image to handle rotation and format
        const processedImageBytes = await processImageForPdf(item);

        let embeddedImage;
        if (item.file.type === 'image/png') {
          try {
            embeddedImage = await pdfDoc.embedPng(processedImageBytes);
          } catch {
            embeddedImage = await pdfDoc.embedJpg(processedImageBytes);
          }
        } else {
          embeddedImage = await pdfDoc.embedJpg(processedImageBytes);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageWidth, pageHeight;

        if (pageSize === 'fit') {
          pageWidth = imgWidth + (margin * 2);
          pageHeight = imgHeight + (margin * 2);
        } else {
          // Standard dimensions: A4 (595.28 x 841.89) / Letter (612 x 792)
          let baseW = pageSize === 'letter' ? 612 : 595.28;
          let baseH = pageSize === 'letter' ? 792 : 841.89;

          if (orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight)) {
            pageWidth = Math.max(baseW, baseH);
            pageHeight = Math.min(baseW, baseH);
          } else {
            pageWidth = Math.min(baseW, baseH);
            pageHeight = Math.max(baseW, baseH);
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate aspect-ratio fit inside page margins
        const availableW = pageWidth - (margin * 2);
        const availableH = pageHeight - (margin * 2);

        const scale = Math.min(availableW / imgWidth, availableH / imgHeight);
        const drawW = imgWidth * scale;
        const drawH = imgHeight * scale;

        const posX = margin + (availableW - drawW) / 2;
        const posY = margin + (availableH - drawH) / 2;

        page.drawImage(embeddedImage, {
          x: posX,
          y: posY,
          width: drawW,
          height: drawH,
        });
      }

      progressBar.style.width = '95%';
      processingStatus.textContent = 'Finalizing PDF file...';

      const pdfBytes = await pdfDoc.save();
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const downloadUrl = URL.createObjectURL(pdfBlob);

      // Trigger instant download
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `SnapPDF_${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      progressBar.style.width = '100%';
      setTimeout(() => {
        processingModal.classList.add('hidden');
      }, 500);

    } catch (err) {
      console.error(err);
      alert('Error creating PDF: ' + err.message);
      processingModal.classList.add('hidden');
    }
  });

  // Helper: Renders image on canvas to bake rotation and convert clean JPG bytes
  function processImageForPdf(item) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (item.rotation === 90 || item.rotation === 270) {
          canvas.width = img.naturalHeight;
          canvas.height = img.naturalWidth;
        } else {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }

        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((item.rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

        canvas.toBlob((blob) => {
          blob.arrayBuffer().then(resolve).catch(reject);
        }, 'image/jpeg', 0.92);
      };
      img.onerror = reject;
      img.src = item.url;
    });
  }
});