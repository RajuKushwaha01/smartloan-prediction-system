(function () {
  const sliders = ['loanAmount', 'monthlyIncome', 'monthlyExpenses', 'loanTenure', 'coApplicantIncome', 'existingEMI'];
  const employmentSelect = document.getElementById('sim-employmentType');

  function fmtINR(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }

  sliders.forEach(key => {
    const slider = document.getElementById(`sim-${key}`);
    const display = document.getElementById(`sim-${key}-display`);
    if (!slider || !display) return;
    slider.addEventListener('input', () => {
      display.textContent = key === 'loanTenure' ? `${slider.value} months` : fmtINR(slider.value);
    });
  });

  let lastSimResult = null;

  const runBtn = document.getElementById('run-simulation-btn');
  const saveBtn = document.getElementById('save-scenario-btn');
  const labelInput = document.getElementById('scenario-label-input');

  runBtn.addEventListener('click', async () => {
    runBtn.disabled = true;
    runBtn.textContent = 'Running...';

    const overrides = {};
    sliders.forEach(key => {
      const slider = document.getElementById(`sim-${key}`);
      if (slider) overrides[key] = Number(slider.value);
    });
    overrides.employmentType = employmentSelect.value;

    try {
      const res = await fetch(`/loan/simulate/${window.PREDICTION_ID}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(overrides)
      });
      const data = await res.json();
      lastSimResult = data;

      document.getElementById('sim-result').classList.add('hidden');
      const output = document.getElementById('sim-output');
      output.classList.remove('hidden');

      const pill = document.getElementById('sim-prediction-pill');
      pill.textContent = data.prediction;
      pill.className = 'status-pill ' + (data.prediction === 'Eligible' ? 'pill-green' : data.prediction === 'Review' ? 'pill-amber' : 'pill-red');

      document.getElementById('sim-probability').textContent = Math.round(data.probability * 100) + '%';
      document.getElementById('sim-emi').textContent = fmtINR(data.simulatedEMI) + '/mo';
      document.getElementById('sim-dti').textContent = data.simulatedDTI + '%';
      document.getElementById('sim-interpretation').textContent = data.interpretation;

      saveBtn.classList.remove('hidden');
      labelInput.classList.remove('hidden');
    } catch (e) {
      alert('Simulation failed. Please try again.');
    } finally {
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Simulation';
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!lastSimResult) return;
    saveBtn.disabled = true;

    try {
      const res = await fetch('/loan/simulate/scenario/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          predictionId: window.PREDICTION_ID,
          label: labelInput.value,
          changedInputs: JSON.stringify(lastSimResult.overrides),
          simulatedPrediction: lastSimResult.prediction,
          simulatedProbability: lastSimResult.probability,
          simulatedEMI: lastSimResult.simulatedEMI,
          simulatedDTI: lastSimResult.simulatedDTI
        })
      });
      const data = await res.json();
      if (data.success) {
        location.reload(); // simplest way to refresh scenario history list
      }
    } catch (e) {
      alert('Could not save scenario.');
    } finally {
      saveBtn.disabled = false;
    }
  });

  document.querySelectorAll('.delete-scenario-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this scenario?')) return;
      const id = btn.dataset.id;
      const res = await fetch(`/loan/simulate/scenario/${id}/delete`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        document.getElementById(`scenario-${id}`).remove();
      }
    });
  });
})();