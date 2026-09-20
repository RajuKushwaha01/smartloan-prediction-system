(function () {
  const amountSlider = document.getElementById('amount-slider');
  const rateSlider = document.getElementById('rate-slider');
  const tenureSlider = document.getElementById('tenure-slider');

  const amountDisplay = document.getElementById('amount-display');
  const rateDisplay = document.getElementById('rate-display');
  const tenureDisplay = document.getElementById('tenure-display');

  const emiResult = document.getElementById('emi-result');
  const interestResult = document.getElementById('interest-result');
  const totalResult = document.getElementById('total-result');

  function formatINR(num) {
    return '₹' + Math.round(num).toLocaleString('en-IN');
  }

  function calculateEMI(principal, annualRatePercent, tenureMonths) {
    const r = annualRatePercent / 12 / 100;
    if (r === 0) return principal / tenureMonths;
    return (principal * r * Math.pow(1 + r, tenureMonths)) / (Math.pow(1 + r, tenureMonths) - 1);
  }

  function update() {
    const principal = Number(amountSlider.value);
    const rate = Number(rateSlider.value);
    const tenure = Number(tenureSlider.value);

    amountDisplay.textContent = formatINR(principal);
    rateDisplay.textContent = rate.toFixed(1) + '%';
    tenureDisplay.textContent = tenure + ' months';

    const emi = calculateEMI(principal, rate, tenure);
    const totalRepayment = emi * tenure;
    const totalInterest = totalRepayment - principal;

    emiResult.textContent = formatINR(emi);
    interestResult.textContent = formatINR(totalInterest);
    totalResult.textContent = formatINR(totalRepayment);
  }

  [amountSlider, rateSlider, tenureSlider].forEach(slider => {
    slider.addEventListener('input', update);
  });

  update(); // initial render
})();