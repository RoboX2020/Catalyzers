/**
 * FitGenius — Popup Script v2
 * Simplified flow: Height + Weight + Body Shape + Usual Size → Auto-estimated measurements
 */

document.addEventListener('DOMContentLoaded', () => {

  // ─── State ───
  let currentStep = 1;
  const totalSteps = 4;
  let photoData = null;
  let currentUnit = 'imperial'; // 'imperial' or 'metric'
  let estimatedMeasurements = null;

  // ─── Elements ───
  const stepDots = document.querySelectorAll('.step-dot');
  const stepContents = document.querySelectorAll('.step-content');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnSave = document.getElementById('btn-save');
  const statusBar = document.getElementById('status-bar');
  const statusText = statusBar.querySelector('.status-text');

  // ─── Load saved profile ───
  loadProfile();

  // ─── Step Navigation ───
  stepDots.forEach(dot => {
    dot.addEventListener('click', () => goToStep(parseInt(dot.dataset.step)));
  });

  btnNext.addEventListener('click', () => {
    if (currentStep < totalSteps) goToStep(currentStep + 1);
  });

  btnPrev.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  btnSave.addEventListener('click', saveProfile);

  function goToStep(step) {
    // Before leaving step 1, validate basics
    if (currentStep === 1 && step > 1) {
      const gender = document.querySelector('input[name="gender"]:checked');
      if (!gender) {
        setStatus('Please select your gender', 'error');
        return;
      }
    }

    // When entering step 2, populate body shapes
    if (step === 2) {
      populateBodyShapes();
      updateEstimate();
    }

    currentStep = step;

    // Update dots
    stepDots.forEach(dot => {
      const dotStep = parseInt(dot.dataset.step);
      dot.classList.remove('active');
      if (dotStep === step) dot.classList.add('active');
      if (dotStep < step) dot.classList.add('completed');
      else dot.classList.remove('completed');
    });

    // Update content
    stepContents.forEach(content => content.classList.remove('active'));
    document.getElementById(`step-${step}`).classList.add('active');

    // Update buttons
    btnPrev.disabled = step === 1;

    if (step === totalSteps) {
      btnNext.style.display = 'none';
      btnSave.style.display = 'none';
      loadHistory();
      loadReferenceProducts();
    } else if (step === 3) {
      btnNext.style.display = 'none';
      btnSave.style.display = 'inline-flex';
    } else {
      btnNext.style.display = 'inline-flex';
      btnSave.style.display = 'none';
    }
  }

  // ─── Gender change → update bottom sizes ───
  document.querySelectorAll('input[name="gender"]').forEach(input => {
    input.addEventListener('change', () => {
      updateBottomSizes();
      if (currentStep === 2) {
        populateBodyShapes();
        updateEstimate();
      }
    });
  });

  function updateBottomSizes() {
    const gender = getGender();
    const select = document.getElementById('usual-bottom-size');
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">Not sure</option>';

    if (gender === 'female') {
      ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20'].forEach(s => {
        select.innerHTML += `<option value="${s}" ${currentVal === s ? 'selected' : ''}>US ${s}</option>`;
      });
    } else {
      ['28', '30', '32', '34', '36', '38', '40', '42', '44'].forEach(s => {
        select.innerHTML += `<option value="${s}" ${currentVal === s ? 'selected' : ''}>W${s}</option>`;
      });
    }
  }

  // ─── Unit Toggle ───
  document.querySelectorAll('.unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const newUnit = btn.dataset.unit;
      if (newUnit === currentUnit) return;
      
      document.querySelectorAll('.unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      convertUnits(currentUnit, newUnit);
      currentUnit = newUnit;
    });
  });

  function convertUnits(from, to) {
    const heightFt = document.getElementById('height-ft');
    const heightIn = document.getElementById('height-in');
    const weight = document.getElementById('weight');

    if (from === 'imperial' && to === 'metric') {
      // Convert ft/in to total cm
      const totalInches = (parseFloat(heightFt.value) || 0) * 12 + (parseFloat(heightIn.value) || 0);
      if (totalInches > 0) {
        const cm = Math.round(totalInches * 2.54);
        heightFt.value = cm;
        heightIn.value = '';
        heightIn.parentElement.style.display = 'none';
        heightFt.placeholder = '178';
        heightFt.parentElement.querySelector('.input-unit').textContent = 'cm';
      }

      if (weight.value) {
        weight.value = Math.round(parseFloat(weight.value) * 0.453592);
      }
      weight.parentElement.querySelector('.input-unit').textContent = 'kg';
      weight.placeholder = '75';

    } else {
      // Convert cm to ft/in
      const cm = parseFloat(heightFt.value) || 0;
      if (cm > 0) {
        const totalInches = cm / 2.54;
        heightFt.value = Math.floor(totalInches / 12);
        heightIn.value = Math.round(totalInches % 12);
        heightIn.parentElement.style.display = '';
        heightFt.placeholder = '5';
        heightFt.parentElement.querySelector('.input-unit').textContent = 'ft';
      }

      if (weight.value) {
        weight.value = Math.round(parseFloat(weight.value) / 0.453592);
      }
      weight.parentElement.querySelector('.input-unit').textContent = 'lbs';
      weight.placeholder = '165';
    }
  }

  // ─── Body Shape Selection ───
  function populateBodyShapes() {
    const gender = getGender();
    const shapes = FG_BodyEstimator.getBodyShapes(gender);
    const grid = document.getElementById('body-shape-grid');
    
    // Preserve current selection
    const currentShape = document.querySelector('input[name="bodyShape"]:checked')?.value;
    
    grid.innerHTML = Object.entries(shapes).map(([key, shape]) => `
      <label class="body-shape-option">
        <input type="radio" name="bodyShape" value="${key}" ${key === currentShape || key === 'average' ? 'checked' : ''}>
        <div class="body-shape-card">
          <span class="body-shape-emoji">${shape.icon}</span>
          <div class="body-shape-name">${shape.label}</div>
          <div class="body-shape-desc">${shape.desc}</div>
        </div>
      </label>
    `).join('');

    // Attach change listeners
    grid.querySelectorAll('input[name="bodyShape"]').forEach(input => {
      input.addEventListener('change', updateEstimate);
    });
  }

  // ─── Estimate Measurements ───
  function updateEstimate() {
    const heightInches = getHeightInches();
    const weightLbs = getWeightLbs();
    const gender = getGender();
    const bodyShape = document.querySelector('input[name="bodyShape"]:checked')?.value || 'average';
    const usualSize = document.getElementById('usual-top-size').value;

    if (!heightInches || !weightLbs || !gender) {
      document.getElementById('estimate-preview').style.display = 'none';
      return;
    }

    estimatedMeasurements = FG_BodyEstimator.estimate({
      heightInches,
      weightLbs,
      gender,
      bodyShape,
      usualSize: usualSize || undefined
    });

    if (!estimatedMeasurements) return;

    // Show preview
    const preview = document.getElementById('estimate-preview');
    preview.style.display = 'block';

    const grid = document.getElementById('estimate-grid');
    const items = [
      { label: 'Chest', value: estimatedMeasurements.chest, key: 'chest' },
      { label: 'Waist', value: estimatedMeasurements.waist, key: 'waist' },
      { label: 'Hip', value: estimatedMeasurements.hip, key: 'hip' },
      { label: 'Shoulder', value: estimatedMeasurements.shoulder, key: 'shoulder' },
      { label: 'Inseam', value: estimatedMeasurements.inseam, key: 'inseam' },
      { label: 'Neck', value: estimatedMeasurements.neck, key: 'neck' }
    ];

    grid.innerHTML = items.map(item => `
      <div class="estimate-item">
        <div class="estimate-value">${item.value}"</div>
        <div class="estimate-label">${item.label}</div>
      </div>
    `).join('');

    // Populate advanced fields with estimates
    items.forEach(item => {
      const field = document.getElementById(item.key);
      if (field && !field.value) {
        field.value = item.value;
      }
    });
  }

  // Also re-estimate when height/weight/usual size changes
  ['height-ft', 'height-in', 'weight', 'usual-top-size'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (currentStep === 2) updateEstimate();
    });
  });

  // ─── Helper Functions ───
  function getGender() {
    const checked = document.querySelector('input[name="gender"]:checked');
    if (!checked) return 'male';
    return checked.value === 'female' ? 'female' : 'male';
  }

  function getHeightInches() {
    if (currentUnit === 'metric') {
      const cm = parseFloat(document.getElementById('height-ft').value);
      return cm ? cm / 2.54 : null;
    }
    const ft = parseFloat(document.getElementById('height-ft').value) || 0;
    const inches = parseFloat(document.getElementById('height-in').value) || 0;
    const total = ft * 12 + inches;
    return total > 0 ? total : null;
  }

  function getWeightLbs() {
    const val = parseFloat(document.getElementById('weight').value);
    if (!val) return null;
    return currentUnit === 'metric' ? val / 0.453592 : val;
  }

  // ─── Photo Upload (disabled — virtual try-on removed) ───
  const dropZone = document.getElementById('photo-drop-zone');
  const photoInput = document.getElementById('photo-input');
  const photoPlaceholder = document.getElementById('photo-placeholder');
  const photoPreview = document.getElementById('photo-preview');
  const photoImg = document.getElementById('photo-img');
  const photoRemove = document.getElementById('photo-remove');

  if (dropZone && photoInput) {
    dropZone.addEventListener('click', () => photoInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      if (e.dataTransfer.files.length > 0 && e.dataTransfer.files[0].type.startsWith('image/')) {
        handlePhotoFile(e.dataTransfer.files[0]);
      }
    });
    photoInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) handlePhotoFile(e.target.files[0]);
    });
  }
  if (photoRemove) {
    photoRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      photoData = null;
      if (photoImg) photoImg.src = '';
      if (photoPlaceholder) photoPlaceholder.style.display = 'block';
      if (photoPreview) photoPreview.style.display = 'none';
      if (photoInput) photoInput.value = '';
    });
  }

  function handlePhotoFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      photoData = e.target.result;
      if (photoImg) photoImg.src = photoData;
      if (photoPlaceholder) photoPlaceholder.style.display = 'none';
      if (photoPreview) photoPreview.style.display = 'block';
      setStatus('Photo uploaded ✓', 'success');
    };
    reader.readAsDataURL(file);
  }

  // ─── Save Profile ───
  function saveProfile() {
    const heightInches = getHeightInches();
    const weightLbs = getWeightLbs();
    const gender = getGender();
    const bodyShape = document.querySelector('input[name="bodyShape"]:checked')?.value || 'average';
    const usualTopSize = document.getElementById('usual-top-size').value;
    const usualBottomSize = document.getElementById('usual-bottom-size').value;
    const fitPreference = document.querySelector('input[name="fitPreference"]:checked')?.value || 'regular';

    if (!heightInches || !weightLbs) {
      setStatus('Please enter your height and weight', 'error');
      goToStep(1);
      return;
    }

    // Get measurements — use manual overrides if provided, otherwise estimates
    const estimated = FG_BodyEstimator.estimate({
      heightInches, weightLbs, gender, bodyShape,
      usualSize: usualTopSize || undefined
    });

    const measurements = {};
    ['chest', 'waist', 'hip', 'shoulder', 'inseam', 'neck', 'armLength'].forEach(key => {
      const manualField = document.getElementById(key);
      const manualVal = manualField ? parseFloat(manualField.value) : NaN;
      
      if (!isNaN(manualVal) && manualVal > 0) {
        measurements[key] = manualVal; // User's manual override
      } else if (estimated && estimated[key]) {
        measurements[key] = estimated[key]; // Auto-estimated
      }
    });

    measurements.height = heightInches;
    measurements.weight = weightLbs;

    const profile = {
      gender,
      bodyShape,
      usualTopSize,
      usualBottomSize,
      measurements,
      photo: photoData,
      fitPreference,
      sizeRegion: 'US',
      isEstimated: true,
      updatedAt: new Date().toISOString()
    };

    chrome.storage.local.set({ profile }, () => {
      // Also save API key if provided
      const apiKey = document.getElementById('gemini-api-key')?.value?.trim();
      if (apiKey) {
        chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey });
      }

      setStatus('✅ Profile saved! Browse clothing to get recommendations.', 'success');
      
      btnSave.innerHTML = '✅ Saved!';
      btnSave.style.background = 'linear-gradient(135deg, #00b894, #00cec9)';
      
      setTimeout(() => {
        btnSave.innerHTML = '💾 Save Profile';
        btnSave.style.background = '';
      }, 2500);
    });
  }

  // ─── Load Profile ───
  function loadProfile() {
    chrome.storage.local.get(['profile'], (data) => {
      if (data.profile) {
        const p = data.profile;
        const m = p.measurements || {};

        // Gender
        if (p.gender) {
          const radio = document.querySelector(`input[name="gender"][value="${p.gender}"]`);
          if (radio) radio.checked = true;
          updateBottomSizes();
        }

        // Height
        if (m.height) {
          const totalInches = m.height;
          document.getElementById('height-ft').value = Math.floor(totalInches / 12);
          document.getElementById('height-in').value = Math.round(totalInches % 12);
        }

        // Weight
        if (m.weight) {
          document.getElementById('weight').value = Math.round(m.weight);
        }

        // Usual sizes
        if (p.usualTopSize) document.getElementById('usual-top-size').value = p.usualTopSize;
        if (p.usualBottomSize) {
          setTimeout(() => { document.getElementById('usual-bottom-size').value = p.usualBottomSize; }, 50);
        }

        // Fit preference
        if (p.fitPreference) {
          const radio = document.querySelector(`input[name="fitPreference"][value="${p.fitPreference}"]`);
          if (radio) radio.checked = true;
        }

        // Photo
        if (p.photo) {
          photoData = p.photo;
          photoImg.src = p.photo;
          photoPlaceholder.style.display = 'none';
          photoPreview.style.display = 'block';
        }

        // Manual measurements
        ['chest', 'waist', 'hip', 'shoulder', 'inseam', 'neck'].forEach(key => {
          const field = document.getElementById(key);
          if (field && m[key]) field.value = m[key];
        });

        setStatus('Profile loaded ✓', 'success');
      } else {
        setStatus('Set up your profile in under 30 seconds!', '');
      }
    });

    // Load API key separately
    chrome.runtime.sendMessage({ type: 'GET_API_KEY' }, (response) => {
      if (response?.apiKey) {
        const keyField = document.getElementById('gemini-api-key');
        if (keyField) keyField.value = response.apiKey;
        const statusEl = document.getElementById('api-status');
        if (statusEl) {
          statusEl.textContent = '✅ Key saved';
          statusEl.style.color = 'var(--success)';
        }
      }
    });
  }

  // ─── API Key Test ───
  document.getElementById('btn-test-api')?.addEventListener('click', () => {
    const apiKey = document.getElementById('gemini-api-key')?.value?.trim();
    const statusEl = document.getElementById('api-status');
    
    if (!apiKey) {
      statusEl.textContent = '❌ Enter a key first';
      statusEl.style.color = 'var(--danger)';
      return;
    }

    statusEl.textContent = '⏳ Testing...';
    statusEl.style.color = 'var(--text-muted)';

    chrome.runtime.sendMessage({ type: 'TEST_API_KEY', apiKey }, (response) => {
      if (response?.success) {
        statusEl.textContent = '✅ Connected!';
        statusEl.style.color = 'var(--success)';
        // Auto-save if test passes
        chrome.runtime.sendMessage({ type: 'SAVE_API_KEY', apiKey });
      } else {
        statusEl.textContent = `❌ ${response?.error || 'Failed'}`;
        statusEl.style.color = 'var(--danger)';
      }
    });
  });

  // ─── History ───
  function loadHistory() {
    chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (response) => {
      const historyList = document.getElementById('history-list');
      const history = response?.history || [];

      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="history-empty">
            <span class="history-empty-icon">📋</span>
            <p>No recommendations yet. Browse clothing products to get started!</p>
          </div>
        `;
        return;
      }

      historyList.innerHTML = history.map(item => {
        const confClass = item.confidence >= 70 ? 'high' : item.confidence >= 45 ? 'medium' : 'low';
        const date = new Date(item.timestamp).toLocaleDateString();
        return `
          <div class="history-item">
            <div class="history-size">${item.size}</div>
            <div class="history-info">
              <div class="history-title">${item.title || 'Unknown Product'}</div>
              <div class="history-meta">${date} ${item.price ? '· ' + item.price : ''}</div>
            </div>
            <span class="history-confidence ${confClass}">${item.confidence}%</span>
          </div>
        `;
      }).join('');
    });
  }

  document.getElementById('btn-clear-history').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, () => {
      loadHistory();
      setStatus('History cleared', 'success');
    });
  });

  // ─── Reference Products (My Wardrobe) ───
  document.getElementById('btn-add-reference')?.addEventListener('click', addReferenceProduct);

  function addReferenceProduct() {
    const url = document.getElementById('ref-product-url').value.trim();
    const size = document.getElementById('ref-product-size').value;
    const fitFeedback = document.getElementById('ref-product-fit').value;

    if (!url) {
      setStatus('Please paste a product URL', 'error');
      return;
    }

    // Extract product title from URL (best effort)
    let title = 'Reference Product';
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'dp');
      // Try to get a readable title from the URL slug
      const slug = pathParts.find(p => p.length > 10 && p.includes('-'));
      if (slug) {
        title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (title.length > 60) title = title.substring(0, 60) + '...';
      } else {
        title = urlObj.hostname.replace('www.', '') + ' product';
      }
    } catch (e) {
      title = url.substring(0, 50) + '...';
    }

    // Determine clothing type from URL/title (heuristic)
    const urlLower = url.toLowerCase() + ' ' + title.toLowerCase();
    let clothingType = 'top';
    if (/pant|jean|trouser|short|chino|jogger/i.test(urlLower)) clothingType = 'pants';
    else if (/dress|gown|romper/i.test(urlLower)) clothingType = 'dress';
    else if (/jacket|coat|blazer/i.test(urlLower)) clothingType = 'jacket';
    else if (/hoodie|sweater|sweatshirt/i.test(urlLower)) clothingType = 'hoodie';
    else if (/shirt|tee|t-shirt/i.test(urlLower)) clothingType = 't-shirt';

    const refProduct = {
      url,
      title,
      size,
      purchasedSize: size,
      fitFeedback,
      clothingType,
      material: '',
      fitType: 'regular',
      gender: getGender() === 'female' ? 'women' : 'men',
      addedAt: new Date().toISOString()
    };

    // Adjust size based on fit feedback
    if (fitFeedback === 'slightly-tight' || fitFeedback === 'too-small') {
      refProduct.adjustedNote = 'Ran small for you';
    } else if (fitFeedback === 'slightly-loose' || fitFeedback === 'too-large') {
      refProduct.adjustedNote = 'Ran large for you';
    }

    // Save to storage
    chrome.storage.local.get(['referenceProducts'], (data) => {
      const refs = data.referenceProducts || [];
      refs.unshift(refProduct); // Add to front
      if (refs.length > 10) refs.pop(); // Max 10 references

      chrome.storage.local.set({ referenceProducts: refs }, () => {
        setStatus('✅ Added to My Wardrobe!', 'success');
        document.getElementById('ref-product-url').value = '';
        loadReferenceProducts();
      });
    });
  }

  function loadReferenceProducts() {
    chrome.storage.local.get(['referenceProducts'], (data) => {
      const refs = data.referenceProducts || [];
      const list = document.getElementById('reference-list');

      if (refs.length === 0) {
        list.innerHTML = '';
        return;
      }

      list.innerHTML = refs.map((ref, idx) => {
        const fitEmoji = ref.fitFeedback === 'perfect' ? '✅' 
          : ref.fitFeedback?.includes('tight') ? '🟡' 
          : ref.fitFeedback?.includes('loose') ? '🟡'
          : '🔴';
        return `
          <div class="reference-item">
            <div class="ref-size">${ref.size}</div>
            <div class="ref-info">
              <div class="ref-title">${ref.title}</div>
              <div class="ref-meta">${fitEmoji} ${ref.fitFeedback?.replace(/-/g, ' ') || 'Perfect fit'} · ${ref.clothingType}</div>
            </div>
            <button class="ref-remove" data-idx="${idx}" title="Remove">✕</button>
          </div>
        `;
      }).join('');

      // Attach remove listeners
      list.querySelectorAll('.ref-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          removeReference(idx);
        });
      });
    });
  }

  function removeReference(index) {
    chrome.storage.local.get(['referenceProducts'], (data) => {
      const refs = data.referenceProducts || [];
      refs.splice(index, 1);
      chrome.storage.local.set({ referenceProducts: refs }, () => {
        loadReferenceProducts();
        setStatus('Removed from Wardrobe', 'success');
      });
    });
  }

  // ─── Status ───
  function setStatus(message, type) {
    statusText.textContent = message;
    statusText.className = 'status-text' + (type ? ` ${type}` : '');
  }

  // ─── Init ───
  updateBottomSizes();
});

