/* ============================================
   SMARTLOAN AI — MULTI-STEP APPLICATION WIZARD
   Step navigation, per-field validation, live DTI
   ============================================ */
(function () {
  const form = document.getElementById('wizard-form');
  if (!form) return;

  const steps = document.querySelectorAll('.wizard-step');
  const stepLabels = document.querySelectorAll('.step-label');
  const progressFill = document.getElementById('progress-fill');
  const TOTAL_STEPS = steps.length;
  let currentStep = 1;

  function showStep(n) {
    steps.forEach(s => s.classList.add('hidden'));
    document.querySelector(`.wizard-step[data-step="${n}"]`).classList.remove('hidden');

    stepLabels.forEach(l => l.classList.remove('active'));
    document.querySelector(`.step-label[data-label="${n}"]`).classList.add('active');

    progressFill.style.width = `${(n / TOTAL_STEPS) * 100}%`;
    currentStep = n;
    window.scrollTo({ top: form.offsetTop - 100, behavior: 'smooth' });
  }

  /* ---------- Validation ---------- */
  function validateStep(stepEl) {
    let valid = true;
    const fields = stepEl.querySelectorAll('input[required], select[required]');

    fields.forEach(field => {
      const errorEl = field.parentElement.querySelector('.field-error');
      let msg = '';

      if (!field.value.trim()) {
        msg = 'This field is required';
      } else if (field.type === 'number') {
        const val = parseFloat(field.value);
        const min = field.hasAttribute('min') ? parseFloat(field.min) : null;
        const max = field.hasAttribute('max') ? parseFloat(field.max) : null;
        if (isNaN(val)) msg = 'Enter a valid number';
        else if (min !== null && val < min) msg = `Minimum value is ${min}`;
        else if (max !== null && val > max) msg = `Maximum value is ${max}`;
      }

      if (msg) {
        valid = false;
        field.classList.add('border-red-500');
        if (errorEl) errorEl.textContent = msg;
      } else {
        field.classList.remove('border-red-500');
        if (errorEl) errorEl.textContent = '';
      }
    });

    return valid;
  }

  /* ---------- Next / Back buttons ---------- */
  document.querySelectorAll('.next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepEl = document.querySelector(`.wizard-step[data-step="${currentStep}"]`);
      if (!validateStep(stepEl)) return;

      if (currentStep === TOTAL_STEPS - 1) updateReviewSummary();
      if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
    });
  });

  document.querySelectorAll('.prev-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentStep > 1) showStep(currentStep - 1);
    });
  });

  /* ---------- Live Debt-to-Income Ratio calculation ---------- */
  const dtiInputs = document.querySelectorAll('.dti-input');
  const dtiValueEl = document.getElementById('dti-value');
  const dtiBarEl = document.getElementById('dti-bar');

  function calculateDTI() {
    const monthlyIncome = parseFloat(form.monthlyIncome.value) || 0;
    const coApplicantIncome = parseFloat(form.coApplicantIncome.value) || 0;
    const existingEMI = parseFloat(form.existingEMI.value) || 0;

    const totalIncome = monthlyIncome + coApplicantIncome;
    const dti = totalIncome > 0 ? (existingEMI / totalIncome) * 100 : 0;
    const clamped = Math.min(100, Math.max(0, dti));

    if (dtiValueEl) dtiValueEl.textContent = `${dti.toFixed(1)}%`;
    if (dtiBarEl) dtiBarEl.style.width = `${clamped}%`;

    // color feedback based on project-defined thresholds
    if (dtiBarEl) {
      dtiBarEl.classList.remove('bg-red-500', 'bg-amber-500');
      if (dti > 50) dtiBarEl.classList.add('bg-red-500');
      else if (dti > 30) dtiBarEl.classList.add('bg-amber-500');
    }

    return dti;
  }

  dtiInputs.forEach(input => input.addEventListener('input', calculateDTI));

  /* ---------- Review step summary ---------- */
  function updateReviewSummary() {
    const dti = calculateDTI();
    const reviewValueEl = document.getElementById('dti-value-review');
    const reviewBarEl = document.getElementById('dti-bar-review');
    if (reviewValueEl) reviewValueEl.textContent = `${dti.toFixed(1)}%`;
    if (reviewBarEl) {
      reviewBarEl.style.width = `${Math.min(100, dti)}%`;
      reviewBarEl.classList.remove('bg-red-500', 'bg-amber-500');
      if (dti > 50) reviewBarEl.classList.add('bg-red-500');
      else if (dti > 30) reviewBarEl.classList.add('bg-amber-500');
    }
  }

  /* ---------- Final submit validation (validate all steps) ---------- */
  form.addEventListener('submit', (e) => {
    let allValid = true;
    steps.forEach(stepEl => {
      if (!validateStep(stepEl)) allValid = false;
    });
    if (!allValid) {
      e.preventDefault();
      // jump to first invalid step
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const stepEl = document.querySelector(`.wizard-step[data-step="${i}"]`);
        if (stepEl.querySelector('.border-red-500')) {
          showStep(i);
          break;
        }
      }
    }
  });

    /* ---------- AUTO-SAVE DRAFT ---------- */
  const draftStatusEl = document.getElementById('draft-status');
  const draftIdInput = document.getElementById('draftId');
  const currentStepInput = document.getElementById('currentStepInput');
  let autoSaveTimer = null;

  function saveDraftNow() {
    currentStepInput.value = currentStep;
    const formData = new FormData(form);
    const payload = {};
    formData.forEach((value, key) => { payload[key] = value; });
    payload.draftId = draftIdInput.value;

    fetch('/loan/apply/draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          draftIdInput.value = data.draftId;
          if (draftStatusEl) draftStatusEl.textContent = 'Draft saved just now';
        }
      })
      .catch(() => {});
  }

  function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    if (draftStatusEl) draftStatusEl.textContent = 'Saving...';
    autoSaveTimer = setTimeout(saveDraftNow, 1500); // debounced auto-save
  }

  form.addEventListener('input', scheduleAutoSave);
  form.addEventListener('change', scheduleAutoSave);

  // Also save whenever the user moves to a new step
  document.querySelectorAll('.next-btn, .prev-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(saveDraftNow, 300));
  });


  showStep(1);
})();